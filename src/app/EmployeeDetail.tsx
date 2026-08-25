"use client";

import { useEffect, useState } from "react";
import {
  displayStatus,
  formatTenure,
  supabase,
  tenureYears,
  type Appointment,
  type DisplayStatus,
  type Employee,
  type Performance,
} from "@/lib/supabase";

const KIND_CHIP: Record<Appointment["kind"], string> = {
  입사: "chip acc",
  승진: "chip ok",
  발령: "chip",
  휴직: "chip plan",
  복직: "chip ok",
  퇴사: "chip no",
};

const STATUS_CHIP: Record<DisplayStatus, string> = {
  재직: "chip ok",
  휴직: "chip plan",
  퇴사예정: "chip warn",
  퇴사: "chip no",
};

type ChangeRow = {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor_email: string | null;
  changed_at: string;
};

const FIELD_LABEL: Record<string, string> = {
  name_ko: "한글성명",
  name_en: "영문성명",
  company: "소속",
  department: "부서명",
  position: "직급",
  status: "재직구분",
  birth_date: "생년월일",
  hire_date: "입사일",
  resign_date: "퇴사일",
  email: "메일계정",
  phone: "휴대전화",
  hire_type: "채용구분",
};

/* ── 인사카드 탭 (항목사전 v0.1.0 구분 순서 — 260825 지시서) ──
   신규 항목은 DB 스키마 변경 없이 자리만 잡는다. 값이 생기는 시점은
   인터뷰로 항목 확정 후 — 그 전까지 '수집 예정' 배지가 자리를 표시한다. */
const TABS = ["기본", "조직", "고용·계약", "급여", "이력", "법정"] as const;
type Tab = (typeof TABS)[number];

/** 필드 자리의 세 가지 상태 — 현행 값 / 수집 예정 자리 / 마스킹 데모 */
type Slot =
  | { t: "value"; v: string }
  | { t: "pending" }
  | { t: "masked"; v: string };

const val = (v: string | null | undefined): Slot => ({ t: "value", v: v || "–" });
const PENDING: Slot = { t: "pending" };
const masked = (v: string): Slot => ({ t: "masked", v });

function SlotDd({ slot }: { slot: Slot }) {
  if (slot.t === "pending")
    return (
      <dd className="ph">
        – <span className="chip pend">수집 예정</span>
      </dd>
    );
  if (slot.t === "masked")
    return (
      <dd>
        <span className="masked" title="보기 권한 필요">
          {slot.v}
        </span>
      </dd>
    );
  return <dd>{slot.v}</dd>;
}

function SlotList({ rows }: { rows: [string, Slot][] }) {
  return (
    <dl className="detail">
      {rows.map(([k, slot]) => (
        <div key={k} className="detail-row">
          <dt>{k}</dt>
          <SlotDd slot={slot} />
        </div>
      ))}
    </dl>
  );
}

/** 이력 탭의 빈 테이블 자리 — 헤더로 들어갈 컬럼을 미리 보여준다 */
function PendingTable({ title, cols }: { title: string; cols: string[] }) {
  return (
    <>
      <div className="card-head" style={{ marginTop: 4 }}>
        <h3>{title}</h3>
        <span className="chip pend">수집 예정</span>
        <span className="unit">항목 확정 후 입력</span>
      </div>
      <div className="t-scroll">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={cols.length} className="ph-cell">
                수집 예정 — 인사팀 인터뷰로 항목 확정 후 입력합니다
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

type Props = {
  employee: Employee;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
};

export default function EmployeeDetail({ employee, canEdit, onEdit, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("기본");
  const [history, setHistory] = useState<Appointment[] | null>(null);
  const [changes, setChanges] = useState<ChangeRow[] | null>(null);
  const [perf, setPerf] = useState<Performance[] | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("appointments")
      .select("*")
      .eq("employee_no", employee.employee_no)
      .order("appointed_on", { ascending: false })
      .then(({ data }) => {
        if (alive) setHistory((data as Appointment[]) ?? []);
      });
    supabase
      .from("change_log")
      .select("*")
      .eq("employee_no", employee.employee_no)
      .order("changed_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (alive) setChanges((data as ChangeRow[]) ?? []);
      });
    // R17 성과 이력 — 발령이력과 나란히 보여준다
    supabase
      .from("performance")
      .select("*")
      .eq("employee_no", employee.employee_no)
      .order("started_on", { ascending: false })
      .then(({ data }) => {
        if (alive) setPerf((data as Performance[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, [employee.employee_no]);

  const ds = displayStatus(employee);
  const tenure = formatTenure(tenureYears(employee));

  /* 기본 — 식별 4 + 인적. 주민번호는 실값 없이 마스킹 자리만 (S1 데모) */
  const basicRows: [string, Slot][] = [
    ["사번", val(employee.employee_no)],
    ["한글성명", val(employee.name_ko)],
    ["영문성명", val(employee.name_en)],
    ["주민등록번호", masked("●●●●●●-●······")],
    ["생년월일", val(employee.birth_date)],
    ["성별", PENDING],
    ["국적", PENDING],
    ["메일계정", val(employee.email)],
    ["휴대전화", val(employee.phone)],
    ["거주지역", val(employee.residence)],
    ["주소(상세)", PENDING],
    ["비상연락망", PENDING],
  ];

  /* 조직·역할 — 직위·직급·직책 3개념은 인터뷰에서 정리 (항목사전 §3) */
  const orgRows: [string, Slot][] = [
    ["소속", val(employee.company)],
    ["부서명", val(employee.department)],
    ["팀", PENDING],
    ["겸직조직", PENDING],
    ["직급", val(employee.position)],
    ["직책(보직)", PENDING],
    ["직무", PENDING],
    ["역할(R&R)", PENDING],
    ["상위자", PENDING],
  ];

  /* 고용·계약 — 재직구분·근속은 현행 파생 로직 유지 (R10) */
  const employRows: [string, Slot][] = [
    ["고용형태", PENDING],
    ["입사일", val(employee.hire_date)],
    ["근속", val(tenure + (ds === "퇴사" ? " (퇴사 시점)" : ""))],
    ["퇴사일", val(employee.resign_date)],
    ["퇴사사유", PENDING],
    ["채용구분", val(employee.hire_type)],
    ["경력기간(입사 전)", PENDING],
    ["계약기간(계약직)", PENDING],
    ["프로젝트명(계약직)", PENDING],
  ];

  /* 급여 — 1차 = 정보 보관까지. 계좌는 주민번호와 동일 보안 등급 (S1) */
  const payRows: [string, Slot][] = [
    ["연 기준급", PENDING],
    ["연 책임수당", PENDING],
    ["기본급", PENDING],
    ["시간외수당(월)", PENDING],
    ["책임수당(월)", PENDING],
    ["식대", PENDING],
    ["소득세 세계수", PENDING],
    ["기부금 참여", PENDING],
    ["은행", PENDING],
    ["계좌번호", masked("●●●-●●●●●●-●····")],
    ["예금주", PENDING],
    ["비고", PENDING],
  ];

  /* 법정·특수 — 신고 실무 근거 확인 후 이관/제외 판정 (항목사전 §7) */
  const legalRows: [string, Slot][] = [
    ["보훈 대상 여부", PENDING],
    ["보훈번호", PENDING],
    ["보훈 관계(가족)", PENDING],
    ["장애 여부·급수", PENDING],
    ["장애 등록번호", PENDING],
    ["병역 구분", PENDING],
    ["군별·병과·계급", PENDING],
    ["복무기간", PENDING],
  ];

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3>{employee.name_ko}</h3>
          <span className={STATUS_CHIP[ds]}>{ds}</span>
          <span className="unit">
            {employee.company} · {employee.department} · {employee.position} · 근속 {tenure}
          </span>
        </div>

        {ds === "퇴사예정" && (
          <div className="callout warn">
            <b>퇴사일({employee.resign_date})이 아직 오지 않았습니다.</b> 이 직원은 지금도
            재직 중이며 현원에 포함됩니다. 인수인계·잔여 연차 정산·4대보험 상실신고 일정을
            확인하세요.
          </div>
        )}

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "tab on" : "tab"}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "기본" && <SlotList rows={basicRows} />}

        {tab === "조직" && <SlotList rows={orgRows} />}

        {tab === "고용·계약" && (
          <>
            <SlotList rows={employRows} />
            <dl className="detail">
              <div className="detail-row">
                <dt>재직구분</dt>
                <dd>
                  <span className={STATUS_CHIP[ds]}>{ds}</span>
                </dd>
              </div>
            </dl>
          </>
        )}

        {tab === "급여" && (
          <>
            <SlotList rows={payRows} />
            <div className="callout">
              급여 항목은 <b>정보 보관 자리만</b> 잡았습니다. 값 입력·계산 기능은 없으며,
              편입 시기(1차 즉시 vs 급여마스터 이관 시)는 인사팀 인터뷰에서 확정합니다.
            </div>
          </>
        )}

        {tab === "이력" && (
          <>
            <div className="card-head" style={{ marginTop: 4 }}>
              <h3>발령이력</h3>
              <span className="unit">
                {history === null ? "불러오는 중…" : `${history.length}건 · 최신순`}
              </span>
            </div>

            {history === null ? (
              <div className="t-empty">불러오는 중…</div>
            ) : history.length === 0 ? (
              <div className="t-empty">기록된 발령이 없습니다.</div>
            ) : (
              <ol className="timeline">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="tl-date">{h.appointed_on}</span>
                    <span className={KIND_CHIP[h.kind]}>{h.kind}</span>
                    <span className="tl-detail">{h.detail}</span>
                    {h.actor_email && <span className="tl-actor">입력 {h.actor_email}</span>}
                  </li>
                ))}
              </ol>
            )}

            <div className="card-head" style={{ marginTop: 4 }}>
              <h3>성과 이력</h3>
              <span className="unit">
                {perf === null ? "불러오는 중…" : `${perf.length}건 · 최신순`}
              </span>
            </div>

            {perf === null ? (
              <div className="t-empty">불러오는 중…</div>
            ) : perf.length === 0 ? (
              <div className="t-empty">기록된 수행 이력이 없습니다.</div>
            ) : (
              <div className="t-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>기간</th>
                      <th>프로젝트 · 업무</th>
                      <th>역할</th>
                      <th>기여</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((r) => (
                      <tr key={r.id}>
                        <td className="nowrap">
                          {r.started_on}
                          <span className="sub-label">{r.ended_on ?? "진행 중"}</span>
                        </td>
                        <td>{r.project}</td>
                        <td>
                          <span className="chip">{r.role}</span>
                        </td>
                        <td>{r.contribution ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PendingTable
              title="사외 경력"
              cols={["회사명", "재직기간", "직위", "담당업무"]}
            />
            <PendingTable
              title="학력"
              cols={["학교명", "재학기간", "전공", "졸업구분"]}
            />
            <PendingTable title="자격증" cols={["자격명", "취득일", "발급기관"]} />

            <div className="card-head" style={{ marginTop: 4 }}>
              <h3>변경 기록</h3>
              <span className="unit">
                {changes === null ? "불러오는 중…" : `${changes.length}건 · 최신 20건`}
              </span>
            </div>

            {changes === null ? (
              <div className="t-empty">불러오는 중…</div>
            ) : changes.length === 0 ? (
              <div className="t-empty">이 시스템 도입 이후 변경된 항목이 없습니다.</div>
            ) : (
              <div className="t-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>변경 시각</th>
                      <th>항목</th>
                      <th>이전</th>
                      <th>변경 후</th>
                      <th>변경자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((c) => (
                      <tr key={c.id}>
                        <td>{c.changed_at.slice(0, 16).replace("T", " ")}</td>
                        <td>{FIELD_LABEL[c.field] ?? c.field}</td>
                        <td>{c.old_value ?? "–"}</td>
                        <td>{c.new_value ?? "–"}</td>
                        <td>{c.actor_email ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "법정" && (
          <>
            <SlotList rows={legalRows} />
            <div className="callout">
              보훈·장애·병역은 <b>신고 실무 근거가 확인될 때만</b> 이관합니다. 근거가 없으면
              제외 — 인사팀 인터뷰에서 판정합니다.
            </div>
          </>
        )}

        {tab === "이력" && (
          <div className="callout">
            입사·부서이동·승진·휴직·퇴사는 <b>저장하는 순간 이력이 자동으로 남습니다.</b>{" "}
            수기로 기록할 필요가 없고, 직원 정보는 삭제되지 않습니다 — 퇴사도 상태 변경으로만
            처리됩니다.
          </div>
        )}

        <div className="toolbar">
          {!canEdit && (
            <span className="hint">수정하려면 우측 상단에서 로그인하세요</span>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            닫기
          </button>
          <button className="btn primary" onClick={onEdit} disabled={!canEdit}>
            정보 수정
          </button>
        </div>
      </div>
    </div>
  );
}
