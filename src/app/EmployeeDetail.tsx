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

type Props = {
  employee: Employee;
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
};

export default function EmployeeDetail({ employee, canEdit, onEdit, onClose }: Props) {
  const [history, setHistory] = useState<Appointment[] | null>(null);
  const [changes, setChanges] = useState<ChangeRow[] | null>(null);

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
    return () => {
      alive = false;
    };
  }, [employee.employee_no]);

  const ds = displayStatus(employee);
  const tenure = formatTenure(tenureYears(employee));

  const fields: [string, string][] = [
    ["사번", employee.employee_no],
    ["한글성명", employee.name_ko],
    ["영문성명", employee.name_en ?? "–"],
    ["소속", employee.company],
    ["부서명", employee.department],
    ["직급", employee.position],
    ["채용구분", employee.hire_type ?? "–"],
    ["생년월일", employee.birth_date ?? "–"],
    ["입사일", employee.hire_date],
    ["근속", tenure + (ds === "퇴사" ? " (퇴사 시점)" : "")],
    ["퇴사일", employee.resign_date ?? "–"],
    ["메일계정", employee.email ?? "–"],
    ["휴대전화", employee.phone ?? "–"],
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

        <dl className="detail">
          {fields.map(([k, v]) => (
            <div key={k} className="detail-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          <div className="detail-row">
            <dt>재직구분</dt>
            <dd>
              <span className={STATUS_CHIP[ds]}>{ds}</span>
            </dd>
          </div>
        </dl>

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

        <div className="callout">
          입사·부서이동·승진·휴직·퇴사는 <b>저장하는 순간 이력이 자동으로 남습니다.</b> 수기로
          기록할 필요가 없고, 직원 정보는 삭제되지 않습니다 — 퇴사도 상태 변경으로만 처리됩니다.
        </div>

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
