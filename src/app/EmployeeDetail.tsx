"use client";

import { useEffect, useState } from "react";
import { supabase, type Appointment, type Employee } from "@/lib/supabase";

const KIND_CHIP: Record<Appointment["kind"], string> = {
  입사: "chip acc",
  승진: "chip ok",
  발령: "chip",
  휴직: "chip plan",
  복직: "chip ok",
  퇴사: "chip no",
};

const STATUS_CHIP: Record<string, string> = {
  재직: "chip ok",
  휴직: "chip plan",
  퇴사: "chip no",
};

type Props = {
  employee: Employee;
  onEdit: () => void;
  onClose: () => void;
};

export default function EmployeeDetail({ employee, onEdit, onClose }: Props) {
  const [history, setHistory] = useState<Appointment[] | null>(null);

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
    return () => {
      alive = false;
    };
  }, [employee.employee_no]);

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
    ["퇴사일", employee.resign_date ?? "–"],
    ["메일계정", employee.email ?? "–"],
    ["휴대전화", employee.phone ?? "–"],
  ];

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3>{employee.name_ko}</h3>
          <span className={STATUS_CHIP[employee.status]}>{employee.status}</span>
          <span className="unit">
            {employee.company} · {employee.department} · {employee.position}
          </span>
        </div>

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
              <span className={STATUS_CHIP[employee.status]}>{employee.status}</span>
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
              </li>
            ))}
          </ol>
        )}

        <div className="callout">
          입사·부서이동·승진·휴직·퇴사는 <b>저장하는 순간 이력이 자동으로 남습니다.</b> 수기로
          기록할 필요가 없고, 직원 정보는 삭제되지 않습니다 — 퇴사도 상태 변경으로만 처리됩니다.
        </div>

        <div className="toolbar">
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            닫기
          </button>
          <button className="btn primary" onClick={onEdit}>
            정보 수정
          </button>
        </div>
      </div>
    </div>
  );
}
