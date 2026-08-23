"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  distinct,
  STATUSES,
  supabase,
  type Employee,
  type EmployeeInput,
} from "@/lib/supabase";
import EmployeeDetail from "./EmployeeDetail";
import EmployeeForm from "./EmployeeForm";

const STATUS_CHIP: Record<string, string> = {
  재직: "chip ok",
  휴직: "chip plan",
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
      if (status !== ALL && r.status !== status) return false;
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
    const byStatus: Record<string, number> = { 재직: 0, 휴직: 0, 퇴사: 0 };
    const byDept = new Map<string, number>();
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status !== "퇴사") byDept.set(r.department, (byDept.get(r.department) ?? 0) + 1);
    }
    return { byStatus, byDept: [...byDept.entries()].sort((a, b) => b[1] - a[1]) };
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
      <section className="kpis kpis-5">
        <div className="kpi">
          <span className="k">총원</span>
          <span className="v">{rows.length}</span>
          <span className="s">등록 인원</span>
        </div>
        <div className="kpi lead">
          <span className="k">재직</span>
          <span className="v">{summary.byStatus.재직}</span>
          <span className="s">명</span>
        </div>
        <div className="kpi">
          <span className="k">휴직</span>
          <span className="v">{summary.byStatus.휴직}</span>
          <span className="s">명</span>
        </div>
        <div className="kpi">
          <span className="k">퇴사</span>
          <span className="v">{summary.byStatus.퇴사}</span>
          <span className="s">누적</span>
        </div>
        <div className="kpi">
          <span className="k">부서 수</span>
          <span className="v">{summary.byDept.length}</span>
          <span className="s">재직자 기준</span>
        </div>
      </section>

      <div className="card">
        <div className="card-head">
          <h3>부서별 인원</h3>
          <span className="unit">퇴사자 제외 · 명</span>
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

      <div className="toolbar">
        <input
          className="input"
          style={{ minWidth: 200 }}
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
          {STATUSES.map((s) => (
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
                  <th>퇴사일</th>
                  <th>재직구분</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="rowlink" onClick={() => setViewing(r)}>
                    <td>{r.employee_no}</td>
                    <td>{r.name_ko}</td>
                    <td>{r.company}</td>
                    <td>{r.department}</td>
                    <td>{r.position}</td>
                    <td>{r.hire_date}</td>
                    <td>{r.resign_date ?? "–"}</td>
                    <td>
                      <span className={STATUS_CHIP[r.status]}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="callout">
        행을 클릭하면 기본정보 12항목과 <b>발령이력 타임라인</b>이 열립니다. 가상 회사
        &lsquo;가온컴퍼니&rsquo;의 더미데이터이며 실제 직원 정보는 포함돼 있지 않습니다.
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
