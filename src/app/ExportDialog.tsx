"use client";

import { useState } from "react";
import { displayStatus, formatTenure, tenureYears, today, type Employee } from "@/lib/supabase";
import { downloadTable } from "@/lib/csv";

type Col = { key: string; label: string; value: (e: Employee) => string | null; sensitive?: boolean };

/** 내보낼 수 있는 열 — 대장 표 + 인사카드 기본값. 급여·주민번호는 스키마에 없어 애초에 없다 */
const COLS: Col[] = [
  { key: "employee_no", label: "사번", value: (e) => e.employee_no },
  { key: "name_ko", label: "한글성명", value: (e) => e.name_ko },
  { key: "name_en", label: "영문성명", value: (e) => e.name_en },
  { key: "status", label: "재직구분", value: (e) => displayStatus(e) },
  { key: "company", label: "소속", value: (e) => e.company },
  { key: "department", label: "부서명", value: (e) => e.department },
  { key: "position", label: "직급", value: (e) => e.position },
  { key: "employment_type", label: "고용형태", value: (e) => e.employment_type },
  { key: "hire_type", label: "채용구분", value: (e) => e.hire_type },
  { key: "hire_date", label: "입사일", value: (e) => e.hire_date },
  { key: "tenure", label: "근속", value: (e) => formatTenure(tenureYears(e)) },
  { key: "resign_date", label: "퇴사일", value: (e) => e.resign_date },
  { key: "contract_end_date", label: "계약종료일", value: (e) => e.contract_end_date },
  { key: "return_date", label: "복직예정일", value: (e) => e.return_date },
  { key: "birth_date", label: "생년월일", value: (e) => e.birth_date, sensitive: true },
  { key: "email", label: "메일계정", value: (e) => e.email, sensitive: true },
  { key: "phone", label: "휴대전화", value: (e) => e.phone, sensitive: true },
  { key: "emergency_contact", label: "비상연락망", value: (e) => e.emergency_contact, sensitive: true },
  { key: "residence", label: "거주지역", value: (e) => e.residence, sensitive: true },
];

const DEFAULT_ON = new Set([
  "employee_no", "name_ko", "status", "company", "department", "position", "employment_type", "hire_date", "tenure", "resign_date",
]);

/**
 * 엑셀 다운로드 — 컬럼 선택 (B6 · 체크리스트 3-5 "필요 정보 선택 다운로드").
 * 기본은 대장 표 열. 개인정보 열은 따로 묶어 켜야 나간다 — 4대보험·급여 연계처럼 목적이 있을 때만.
 */
export default function ExportDialog({
  rows,
  title,
  onClose,
}: {
  rows: Employee[];
  title: string;
  onClose: () => void;
}) {
  const [on, setOn] = useState<Set<string>>(new Set(DEFAULT_ON));

  const toggle = (k: string) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const setGroup = (cols: Col[], v: boolean) =>
    setOn((prev) => {
      const next = new Set(prev);
      cols.forEach((c) => (v ? next.add(c.key) : next.delete(c.key)));
      return next;
    });

  const basic = COLS.filter((c) => !c.sensitive);
  const personal = COLS.filter((c) => c.sensitive);
  const chosen = COLS.filter((c) => on.has(c.key));

  function run() {
    downloadTable(
      `${title}_${today().replace(/-/g, "")}.csv`,
      chosen.map((c) => c.label),
      rows.map((e) => chosen.map((c) => c.value(e))),
    );
    onClose();
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card modal narrow" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="엑셀 다운로드">
        <div className="card-head">
          <h3>엑셀 다운로드</h3>
          <span className="unit">{rows.length}명 · 현재 필터 결과</span>
        </div>

        <div className="export-group">
          <div className="export-group-head">
            <b>기본 정보</b>
            <button type="button" className="link-btn" onClick={() => setGroup(basic, true)}>모두</button>
            <button type="button" className="link-btn" onClick={() => setGroup(basic, false)}>없음</button>
          </div>
          <div className="export-cols">
            {basic.map((c) => (
              <label key={c.key} className="export-col">
                <input type="checkbox" checked={on.has(c.key)} onChange={() => toggle(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="export-group">
          <div className="export-group-head">
            <b>개인정보</b>
            <span className="hint">목적이 있을 때만 — 내보낸 파일의 관리 책임은 다운로드한 사람에게</span>
            <button type="button" className="link-btn" onClick={() => setGroup(personal, true)}>모두</button>
            <button type="button" className="link-btn" onClick={() => setGroup(personal, false)}>없음</button>
          </div>
          <div className="export-cols">
            {personal.map((c) => (
              <label key={c.key} className="export-col">
                <input type="checkbox" checked={on.has(c.key)} onChange={() => toggle(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="callout">
          형식은 <b>UTF-8 CSV</b>(엑셀에서 바로 열림) · 열 순서는 위 순서 · 주민번호·급여는 시스템에
          없어 내보낼 수 없습니다.
        </div>

        <div className="toolbar">
          <span className="hint">{chosen.length}개 열 선택</span>
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn primary" disabled={chosen.length === 0 || rows.length === 0} onClick={run}>
            다운로드 ({rows.length})
          </button>
        </div>
      </div>
    </div>
  );
}
