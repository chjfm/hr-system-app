"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DISPLAY_STATUSES,
  EMPLOYMENT_TYPES,
  displayStatus,
  distinct,
  formatTenure,
  isOnBoard,
  supabase,
  tenureYears,
  type DisplayStatus,
  type Department,
  type Employee,
  type EmployeeInput,
} from "@/lib/supabase";
import type { Leave } from "@/lib/leave";
import { COLUMNS, sortRows, type SortKey, type SortState } from "@/lib/sort";
import { monthlyMovement, quarterly } from "@/lib/movement";
import { detectIssues } from "@/lib/issues";
import { useSession } from "./AuthBar";
import MovementChart from "./MovementChart";
import CollapsibleCard from "./CollapsibleCard";
import TurnoverByDept from "./TurnoverByDept";
import ResidenceBreakdown from "./ResidenceBreakdown";
import BulkTransfer from "./BulkTransfer";
import EmployeeDetail from "./EmployeeDetail";
import IssueBoard from "./IssueBoard";
import LeaveByDept from "./LeaveByDept";
import MonthlyJoinLeave from "./MonthlyJoinLeave";
import EmployeeForm from "./EmployeeForm";
import ExportDialog from "./ExportDialog";
import Avatar from "./Avatar";
import OrgChart from "./OrgChart";

/* 표 안에서는 배지 대신 점+텍스트 — 158행에 색 배지를 깔면 표가 시끄럽다 */
const STATUS_DOT: Record<DisplayStatus, string> = {
  재직: "st ok",
  휴직: "st plan",
  퇴사예정: "st warn",
  퇴사: "st no",
};

const ALL = "전체";

export default function Home() {
  const { session } = useSession();
  const canEdit = !!session;

  const [rows, setRows] = useState<Employee[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [allLeaves, setAllLeaves] = useState<Leave[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // R1 — 검색 + 필터 4종
  const [q, setQ] = useState("");
  const [company, setCompany] = useState(ALL);
  const [dept, setDept] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [position, setPosition] = useState(ALL);
  const [etype, setEtype] = useState(ALL);

  // R11 — 전 컬럼 정렬
  const [sort, setSort] = useState<SortState>({ key: "employee_no", dir: "asc" });

  // R14 — 조직개편 일괄 발령 대상 선택
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const [viewing, setViewing] = useState<Employee | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  // B6 — 엑셀 다운로드 컬럼 선택
  const [exporting, setExporting] = useState(false);

  // 화면 분리 — 홈이 현황 파악과 사람 찾기 두 가지 일을 하고 있었다 (260825 개선 2)
  const [view, setView] = useState<"status" | "roster" | "org">("status");

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

  // 부서 마스터 (R13) — 목록 필터·등록·수정 폼·조직도가 여기서 부서를 가져온다
  const loadDepts = useCallback(async () => {
    const { data } = await supabase
      .from("departments")
      .select("*")
      .order("sort_order", { ascending: true });
    setDepts((data as Department[]) ?? []);
  }, []);

  useEffect(() => {
    // 최초 적재 — setState는 응답이 온 뒤(await 이후)에만 일어난다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    loadDepts();
    // 연차 사용 기록 (260826 4단계) — 현황 요약 집계용
    supabase
      .from("leaves")
      .select("*")
      .then(({ data }) => setAllLeaves((data as Leave[]) ?? []));
  }, [load, loadDepts]);

  const companies = useMemo(() => distinct(rows, "company"), [rows]);
  const positions = useMemo(() => distinct(rows, "position"), [rows]);

  /** 폼에서 고를 수 있는 부서 — 사용 중인 것. 단 이미 그 부서인 직원은 수정 시 보여야 한다 */
  const selectableDepts = useMemo(() => {
    const used = new Set(rows.map((r) => r.department));
    return depts.filter((d) => d.active || used.has(d.name));
  }, [depts, rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matched = rows.filter((r) => {
      if (company !== ALL && r.company !== company) return false;
      if (dept !== ALL && r.department !== dept) return false;
      if (status !== ALL && displayStatus(r) !== status) return false;
      if (position !== ALL && r.position !== position) return false;
      if (etype !== ALL && r.employment_type !== etype) return false;
      if (!needle) return true;
      return [r.name_ko, r.name_en ?? "", r.employee_no, r.department, r.position]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return sortRows(matched, sort);
  }, [rows, q, company, dept, status, position, etype, sort]);

  // R7 — 대시보드 자동 집계
  const summary = useMemo(() => {
    const byStatus: Record<DisplayStatus, number> = {
      재직: 0,
      휴직: 0,
      퇴사예정: 0,
      퇴사: 0,
    };
    const byDept = new Map<string, number>();
    const byEtype = new Map<string, number>();
    for (const r of rows) {
      byStatus[displayStatus(r)] += 1;
      if (isOnBoard(r)) {
        byDept.set(r.department, (byDept.get(r.department) ?? 0) + 1);
        byEtype.set(r.employment_type, (byEtype.get(r.employment_type) ?? 0) + 1);
      }
    }
    const onBoard = byStatus.재직 + byStatus.휴직 + byStatus.퇴사예정;
    const onBoardRows = rows.filter((r) => isOnBoard(r));
    const avgTenure = onBoardRows.length
      ? onBoardRows.reduce((s, r) => s + tenureYears(r), 0) / onBoardRows.length
      : 0;

    return {
      byStatus,
      onBoard,
      avgTenure,
      byDept: [...byDept.entries()].sort((a, b) => b[1] - a[1]),
      // 고용형태는 5종 고정 순서 — 많은 순으로 섞으면 매번 자리가 바뀐다
      byEtype: EMPLOYMENT_TYPES.map((t) => [t, byEtype.get(t) ?? 0] as const),
    };
  }, [rows]);

  // A1 — 인사 이슈 보드: 향후 30일 시점 감지 (employees 한 표에서 계산, 저장 없음)
  const issues = useMemo(() => detectIssues(rows), [rows]);

  // R12 — 12개월 추이 + 분기 병기
  const months = useMemo(() => monthlyMovement(rows), [rows]);
  const quarters = useMemo(() => quarterly(months), [months]);
  const year12 = useMemo(
    () => months.reduce(
      (s, m) => ({ inn: s.inn + m.inn, out: s.out + m.out, net: s.net + m.net }),
      { inn: 0, out: 0, net: 0 },
    ),
    [months],
  );

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

  /** 화면에 보이는 것만 선택 대상 — 필터를 바꾸면 안 보이는 선택은 정리한다 */
  const visibleIds = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);
  const pickedRows = useMemo(
    () => filtered.filter((r) => picked.has(r.id)),
    [filtered, picked],
  );
  const allVisiblePicked = filtered.length > 0 && filtered.every((r) => picked.has(r.id));

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setPicked((prev) => {
      if (allVisiblePicked) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  }

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const filterOn = q || [company, dept, status, position, etype].some((v) => v !== ALL);

  return (
    <>
      <nav className="tabs viewnav" role="tablist" aria-label="화면 선택">
        <button
          type="button"
          role="tab"
          aria-selected={view === "status"}
          className={view === "status" ? "tab on" : "tab"}
          onClick={() => setView("status")}
        >
          현황
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "roster"}
          className={view === "roster" ? "tab on" : "tab"}
          onClick={() => setView("roster")}
        >
          직원 대장
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "org"}
          className={view === "org" ? "tab on" : "tab"}
          onClick={() => setView("org")}
        >
          조직도
        </button>
      </nav>

      {view === "org" && (
        <OrgChart
          rows={rows}
          depts={depts}
          canEdit={canEdit}
          onOpenDept={(d) => {
            setDept(d);
            setView("roster");
          }}
          onChanged={async () => {
            await Promise.all([loadDepts(), load()]);
          }}
        />
      )}

      {view === "status" && (
      <>
      {/* P3 — 타이틀과 KPI가 한 그룹(12px), 그룹 사이는 24px */}
      <div className="vgroup">
      {/* P1 — 타이포 앵커: 페이지가 스스로 무엇인지 말한다 */}
      <div className="page-title">
        <h2>현황</h2>
        <p>오늘 손댈 일 → 현원 구성 → 추이 · 매일 아침 이 화면으로 시작합니다</p>
      </div>

      {/* [1] A1 — 인사 이슈 보드가 최상단. 현원은 안심 지표, 이슈는 손댈 일 */}
      <IssueBoard issues={issues} loading={loading} onOpen={setViewing} />

      {/* [2] KPI — 첫 칸 '이슈 N건'(lead 주황) = 손댈 일. 퇴사 누적·평균 근속은
          참고 지표라 KPI에서 빼고 인원 변동 카드 unit 문구로 내렸다 (260901 A-2) */}
      <section className="statbar">
        <div className="stat-lead">
          <span className="k">이슈</span>
          <span className="v">{issues.length}</span>
          <span className="s">건 · 향후 30일 손댈 일</span>
        </div>

        <div className="stat-rest">
          <div className="stat">
            <span className="k">현원</span>
            <span className="v">{summary.onBoard}</span>
            <span className="s">재직 + 휴직 + 퇴사예정</span>
          </div>
          <div className="stat">
            <span className="k">재직</span>
            <span className="v">{summary.byStatus.재직}</span>
            <span className="s">근무 중</span>
          </div>
          <div className="stat">
            <span className="k">휴직</span>
            <span className="v">{summary.byStatus.휴직}</span>
            <span className="s">명</span>
          </div>
          <div className="stat">
            <span className="k">퇴사예정</span>
            <span className="v">{summary.byStatus.퇴사예정}</span>
            <span className="s">아직 재직 중</span>
          </div>
        </div>
      </section>

      {/* [3] 면담 진행률(A4) | 부서별 연차 사용(A2) — A4 구현 전에는 A2 전폭 */}
      <LeaveByDept rows={rows} leaves={allLeaves} />

      {/* [4] 이달 입퇴사 (A3) */}
      <MonthlyJoinLeave rows={rows} onOpen={setViewing} />

      {/* [5] 구성 — 고용형태 | 부서별 현원 (매일 볼 필요 없는 구성 지표 묶음) */}
      <div className="row2 even">
        <div className="card">
          <div className="card-head">
            <h3>고용형태 구성</h3>
            <span className="unit">현원 기준 · 명</span>
          </div>
          <div className="etype-row">
            {summary.byEtype.map(([t, n]) => (
              <div key={t} className={n === 0 ? "etype dim" : "etype"}>
                <span className="k">{t}</span>
                <span className="v">{n}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>부서별 현원</h3>
            <span className="unit">현원 기준 · 많은 순 · 칩을 누르면 대장으로</span>
          </div>
          <div className="deptlist">
            {summary.byDept.length === 0 && !loading ? (
              <span className="chip">데이터 없음</span>
            ) : (
              summary.byDept.map(([d, n]) => (
                <button
                  key={d}
                  className="chip chip-btn"
                  onClick={() => {
                    setDept(d);
                    setView("roster");
                  }}
                >
                  {d} {n}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
      </>
      )}

      {view === "roster" && (
      <div className="vgroup">
      <div className="page-title">
        <h2>직원 대장</h2>
        <p>검색·필터로 찾고, 행을 클릭하면 인사카드가 열립니다</p>
      </div>

      {/* 직원 대장 화면 — 필터 행 + 부서 칩 + 표 (260825 방향서) */}
      <div className="card">
        <div className="card-head">
          <h3>직원 대장</h3>
          <span className="unit">
            {filtered.length}명 표시
            {filtered.length !== rows.length && ` · 전체 ${rows.length}명`} · 열 제목을 눌러 정렬
          </span>
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
            {depts.map((d) => (
              <option key={d.code} value={d.name}>
                {d.name}
                {d.active ? "" : " (폐지)"}
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
          <select className="input" value={etype} onChange={(e) => setEtype(e.target.value)}>
            <option value={ALL}>고용형태 · 전체</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
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
                setEtype(ALL);
              }}
            >
              초기화
            </button>
          )}
          <span className="grow" />
          <button className="btn" disabled={filtered.length === 0} onClick={() => setExporting(true)}>
            엑셀 다운로드 ({filtered.length})
          </button>
          {canEdit && pickedRows.length > 0 && (
            <button className="btn primary" onClick={() => setBulkOpen(true)}>
              조직개편 일괄 발령 ({pickedRows.length})
            </button>
          )}
          <button
            className="btn primary"
            disabled={!canEdit}
            title={canEdit ? undefined : "로그인이 필요합니다"}
            onClick={() => setCreating(true)}
          >
            + 신규 입사자 등록
          </button>
        </div>

        {/* 부서 칩 = 표의 필터 — 표 바로 위에 붙어 역할이 분명하다 */}
        <div className="deptlist">
          <span className="hint">부서별 현원 ·</span>
          {summary.byDept.length === 0 && !loading ? (
            <span className="chip">데이터 없음</span>
          ) : (
            summary.byDept.map(([d, n]) => (
              <button
                key={d}
                // 색 규율 — 칩 12개가 전부 주황이면 강조가 아니다. 선택된 것만 주황
                className={`chip chip-btn${dept === d ? " on" : ""}`}
                onClick={() => setDept(dept === d ? ALL : d)}
              >
                {d} {n}
              </button>
            ))
          )}
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
                  {canEdit && (
                    <th className="a-check">
                      <input
                        type="checkbox"
                        checked={allVisiblePicked}
                        onChange={toggleAllVisible}
                        aria-label="표시된 인원 전체 선택"
                      />
                    </th>
                  )}
                  {COLUMNS.map((c) => {
                    const on = sort.key === c.key;
                    return (
                      <th
                        key={c.key}
                        className={c.align === "right" ? "a-right" : c.align === "center" ? "a-center" : undefined}
                        aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <button
                          className={`th-sort${on ? " on" : ""}`}
                          onClick={() => toggleSort(c.key)}
                        >
                          {c.label}
                          <span className="arrow" aria-hidden="true">
                            {on ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const ds = displayStatus(r);
                  return (
                    <tr
                      key={r.id}
                      className="rowlink"
                      tabIndex={0}
                      role="button"
                      aria-label={`${r.name_ko} 상세 보기`}
                      onClick={() => setViewing(r)}
                      onKeyDown={(e) => {
                        // 행 클릭이 상세를 여는 유일한 경로라 키보드로도 열려야 한다
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setViewing(r);
                        }
                      }}
                    >
                      {canEdit && (
                        <td className="a-check" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={picked.has(r.id)}
                            onChange={() => togglePick(r.id)}
                            aria-label={`${r.name_ko} 선택`}
                          />
                        </td>
                      )}
                      <td>{r.employee_no}</td>
                      <td>
                        <span className="name-cell">
                          <Avatar src={r.photo_url} name={r.name_ko} size={24} />
                          {r.name_ko}
                        </span>
                      </td>
                      <td>{r.company}</td>
                      <td>{r.department}</td>
                      <td>{r.position}</td>
                      <td>{r.employment_type}</td>
                      <td className="a-right">{r.hire_date}</td>
                      <td className="a-right">{formatTenure(tenureYears(r))}</td>
                      <td className="a-right">{r.resign_date ?? "–"}</td>
                      <td className="a-center">
                        <span className={STATUS_DOT[ds]}>{ds}</span>
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
      </div>
      )}

      {view === "status" && (
      <div className="vgroup">
      <CollapsibleCard
        id="movement"
        title="인원 변동 — 최근 12개월"
        // 현황 탭 분리로 차트가 화면의 주인 — 접힌 채 비워두지 않는다 (사용자 저장값이 우선)
        defaultOpen
        meta={
          <span className="unit">
            입사 {year12.inn} · 퇴사 {year12.out} · 명 · 퇴사 누적 {summary.byStatus.퇴사} · 평균 근속{" "}
            {summary.avgTenure.toFixed(1)}년
            {/* 증감만 칩으로 승격 — 색과 함께 부호·숫자를 항상 병기한다 (R16) */}
            <span
              className={`chip delta ${year12.net > 0 ? "up" : year12.net < 0 ? "down" : ""}`}
            >
              증감 {year12.net > 0 ? "+" : ""}
              {year12.net}
            </span>
          </span>
        }
      >
        <MovementChart data={months} />

        <div className="t-scroll">
          <table className="mini quarters">
            <thead>
              <tr>
                <th>분기</th>
                {quarters.map((qt) => (
                  <th key={qt.label}>
                    {qt.label}
                    {qt.partial && <span className="sub-label">일부 기간</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>입사</td>
                {quarters.map((qt) => (
                  <td key={qt.label}>{qt.inn}</td>
                ))}
              </tr>
              <tr>
                <td>퇴사</td>
                {quarters.map((qt) => (
                  <td key={qt.label}>{qt.out}</td>
                ))}
              </tr>
              <tr>
                <td>증감</td>
                {quarters.map((qt) => (
                  <td
                    key={qt.label}
                    className={qt.net > 0 ? "pos" : qt.net < 0 ? "neg" : undefined}
                  >
                    {qt.net > 0 ? "+" : ""}
                    {qt.net}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <TurnoverByDept rows={rows} />
      <ResidenceBreakdown rows={rows} />
      </div>
      )}

      {viewing && !editing && (
        <EmployeeDetail
          employee={viewing}
          canEdit={canEdit}
          onEdit={() => setEditing(viewing)}
          onClose={() => setViewing(null)}
          onChanged={load}
        />
      )}

      {exporting && (
        <ExportDialog rows={filtered} title="직원명부" onClose={() => setExporting(false)} />
      )}

      {bulkOpen && (
        <BulkTransfer
          targets={pickedRows}
          departments={selectableDepts}
          onDone={async () => {
            setPicked(new Set());
            await load();
          }}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {(creating || editing) && (
        <EmployeeForm
          employee={editing}
          rows={rows}
          departments={selectableDepts}
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
