"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DISPLAY_STATUSES,
  displayStatus,
  distinct,
  formatTenure,
  isOnBoard,
  supabase,
  tenureYears,
  today,
  type DisplayStatus,
  type Employee,
  type EmployeeInput,
} from "@/lib/supabase";
import { downloadCsv } from "@/lib/csv";
import EmployeeDetail from "./EmployeeDetail";
import EmployeeForm from "./EmployeeForm";

const STATUS_CHIP: Record<DisplayStatus, string> = {
  재직: "chip ok",
  휴직: "chip plan",
  퇴사예정: "chip warn",
  퇴사: "chip no",
};

const ALL = "전체";

export default function Home() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // R1 — 검색 + 필터 4종
  const [q, setQ] = useState("");
  const [company, setCompany] = useState(ALL);
  const [dept, setDept] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [position, setPosition] = useState(ALL);

  const [viewing, setViewing] = useState<Employee | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("employee_no", { ascending: true });

    if (error) setLoadError(error.message);
    else {
      setLoadError(null);
      setRows(data as Employee[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const companies = useMemo(() => distinct(rows, "company"), [rows]);
  const departments = useMemo(() => distinct(rows, "department"), [rows]);
  const positions = useMemo(() => distinct(rows, "position"), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (company !== ALL && r.company !== company) return false;
      if (dept !== ALL && r.department !== dept) return false;
      if (status !== ALL && displayStatus(r) !== status) return false;
      if (position !== ALL && r.position !== position) return false;
      if (!needle) return true;
      return [r.name_ko, r.name_en ?? "", r.employee_no, r.department, r.position]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, company, dept, status, position]);

  // R7 — 대시보드 자동 집계
  const summary = useMemo(() => {
    const byStatus: Record<DisplayStatus, number> = {
      재직: 0,
      휴직: 0,
      퇴사예정: 0,
      퇴사: 0,
    };
    const byDept = new Map<string, number>();
    for (const r of rows) {
      byStatus[displayStatus(r)] += 1;
      if (isOnBoard(r)) byDept.set(r.department, (byDept.get(r.department) ?? 0) + 1);
    }
    // 현원 = 지금 이 회사에 소속된 사람. 퇴사예정자는 아직 소속이다.
    const onBoard = byStatus.재직 + byStatus.휴직 + byStatus.퇴사예정;

    // isOnBoard를 그대로 넘기면 filter가 두 번째 인자로 index를 넣어 기준일이 깨진다
    const onBoardRows = rows.filter((r) => isOnBoard(r));
    const avgTenure = onBoardRows.length
      ? onBoardRows.reduce((s, r) => s + tenureYears(r), 0) / onBoardRows.length
      : 0;

    return {
      byStatus,
      onBoard,
      avgTenure,
      byDept: [...byDept.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  // 인원 변동 — 이번 달 / 올해 입·퇴사와 순증
  const movement = useMemo(() => {
    const t = today();
    const month = t.slice(0, 7);
    const year = t.slice(0, 4);
    const count = (prefix: string) => {
      const inn = rows.filter((r) => r.hire_date.startsWith(prefix)).length;
      // 퇴사일이 아직 안 온 사람은 나간 것으로 세지 않는다
      const out = rows.filter(
        (r) => r.resign_date?.startsWith(prefix) && r.resign_date <= t,
      ).length;
      return { inn, out, net: inn - out };
    };
    return { month: count(month), year: count(year), label: { month, year } };
  }, [rows]);

  /** 다음 사번 — 기존 최대값 +1 (GA26031 형식) */
  const nextEmployeeNo = useMemo(() => {
    const year = String(new Date().getFullYear()).slice(2);
    const max = rows.reduce((m, r) => {
      const n = Number(r.employee_no.slice(-3));
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `GA${year}${String(max + 1).padStart(3, "0")}`;
  }, [rows]);

  async function save(input: EmployeeInput) {
    const { error } = editing
      ? await supabase.from("employees").update(input).eq("id", editing.id)
      : await supabase.from("employees").insert(input);
    if (error) throw new Error(error.message);

    setEditing(null);
    setCreating(false);
    setViewing(null);
    await load();
  }

  const filterOn = q || [company, dept, status, position].some((v) => v !== ALL);

  return (
    <>
      <section className="kpis kpis-6">
        <div className="kpi lead">
          <span className="k">현원</span>
          <span className="v">{summary.onBoard}</span>
          <span className="s">재직+휴직+퇴사예정</span>
        </div>
        <div className="kpi">
          <span className="k">재직</span>
          <span className="v">{summary.byStatus.재직}</span>
          <span className="s">근무 중</span>
        </div>
        <div className="kpi">
          <span className="k">휴직</span>
          <span className="v">{summary.byStatus.휴직}</span>
          <span className="s">명</span>
        </div>
        <div className="kpi">
          <span className="k">퇴사예정</span>
          <span className="v">{summary.byStatus.퇴사예정}</span>
          <span className="s">아직 재직 중</span>
        </div>
        <div className="kpi">
          <span className="k">퇴사</span>
          <span className="v">{summary.byStatus.퇴사}</span>
          <span className="s">누적</span>
        </div>
        <div className="kpi">
          <span className="k">평균 근속</span>
          <span className="v">{summary.avgTenure.toFixed(1)}</span>
          <span className="s">년 · 현원 기준</span>
        </div>
      </section>

      <div className="row2">
        <div className="card">
          <div className="card-head">
            <h3>인원 변동</h3>
            <span className="unit">퇴사일 도래분만 · 명</span>
          </div>
          <div className="t-scroll">
            <table className="mini">
              <thead>
                <tr>
                  <th>기간</th>
                  <th>입사</th>
                  <th>퇴사</th>
                  <th>순증</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["이번 달", movement.label.month, movement.month],
                    ["올해", movement.label.year, movement.year],
                  ] as const
                ).map(([label, period, m]) => (
                  <tr key={label}>
                    <td>
                      {label}
                      <span className="sub-label">{period}</span>
                    </td>
                    <td>{m.inn}</td>
                    <td>{m.out}</td>
                    <td className={m.net > 0 ? "pos" : m.net < 0 ? "neg" : undefined}>
                      {m.net > 0 ? "+" : ""}
                      {m.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>부서별 인원</h3>
            <span className="unit">현원 기준 · 눌러서 필터 · 명</span>
          </div>
          <div className="deptlist">
            {summary.byDept.length === 0 && !loading ? (
              <span className="chip">데이터 없음</span>
            ) : (
              summary.byDept.map(([d, n]) => (
                <button
                  key={d}
                  className={`chip acc chip-btn${dept === d ? " on" : ""}`}
                  onClick={() => setDept(dept === d ? ALL : d)}
                >
                  {d} {n}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input"
          style={{ minWidth: 180 }}
          placeholder="이름·사번 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={company} onChange={(e) => setCompany(e.target.value)}>
          <option value={ALL}>소속 · 전체</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value={ALL}>부서 · 전체</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={ALL}>재직구분 · 전체</option>
          {DISPLAY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="input" value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value={ALL}>직급 · 전체</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {filterOn && (
          <button
            className="btn"
            onClick={() => {
              setQ("");
              setCompany(ALL);
              setDept(ALL);
              setStatus(ALL);
              setPosition(ALL);
            }}
          >
            초기화
          </button>
        )}
        <span className="grow" />
        <button
          className="btn"
          disabled={filtered.length === 0}
          onClick={() => downloadCsv(filtered, `직원명부_${today().replace(/-/g, "")}.csv`)}
        >
          엑셀 내보내기 ({filtered.length})
        </button>
        <button className="btn primary" onClick={() => setCreating(true)}>
          + 신규 입사자 등록
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>직원 대장</h3>
          <span className="unit">
            {filtered.length}명 표시
            {filtered.length !== rows.length && ` · 전체 ${rows.length}명`}
          </span>
        </div>

        {loadError ? (
          <div className="callout error">데이터를 불러오지 못했습니다 — {loadError}</div>
        ) : loading ? (
          <div className="t-empty">불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div className="t-empty">조건에 맞는 직원이 없습니다.</div>
        ) : (
          <div className="t-scroll">
            <table>
              <thead>
                <tr>
                  <th>사번</th>
                  <th>이름</th>
                  <th>소속</th>
                  <th>부서명</th>
                  <th>직급</th>
                  <th>입사일</th>
                  <th>근속</th>
                  <th>퇴사일</th>
                  <th>재직구분</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const ds = displayStatus(r);
                  return (
                    <tr key={r.id} className="rowlink" onClick={() => setViewing(r)}>
                      <td>{r.employee_no}</td>
                      <td>{r.name_ko}</td>
                      <td>{r.company}</td>
                      <td>{r.department}</td>
                      <td>{r.position}</td>
                      <td>{r.hire_date}</td>
                      <td>{formatTenure(tenureYears(r))}</td>
                      <td>{r.resign_date ?? "–"}</td>
                      <td>
                        <span className={STATUS_CHIP[ds]}>{ds}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="callout">
        행을 클릭하면 기본정보와 <b>발령이력 타임라인</b>이 열립니다. 퇴사일이 아직 오지 않은
        사람은 <b>퇴사예정</b>으로 구분해 현원에 포함합니다. 가상 회사
        &lsquo;가온컴퍼니&rsquo;의 더미데이터입니다.
      </div>

      {viewing && !editing && (
        <EmployeeDetail
          employee={viewing}
          onEdit={() => setEditing(viewing)}
          onClose={() => setViewing(null)}
        />
      )}

      {(creating || editing) && (
        <EmployeeForm
          employee={editing}
          companies={companies}
          departments={departments}
          positions={positions}
          nextEmployeeNo={nextEmployeeNo}
          onSave={save}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
