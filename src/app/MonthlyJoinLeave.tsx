"use client";

import { useMemo, useState } from "react";
import { displayStatus, today, type Employee } from "@/lib/supabase";
import { downloadTable } from "@/lib/csv";

type Kind = "입사" | "퇴사" | "퇴사예정";
type Row = { kind: Kind; e: Employee; date: string };

const KIND_DOT: Record<Kind, string> = { 입사: "st ok", 퇴사: "st no", 퇴사예정: "st warn" };

/**
 * 이달 입퇴사 (A3) — 재무팀 공유용 입퇴사자 명단(3-13)의 1차 형태.
 * 월을 바꿔 지난 달을 볼 수 있고, 엑셀 버튼은 대장과 같은 CSV 내보내기(B6 공용)를 쓴다.
 */
export default function MonthlyJoinLeave({
  rows,
  onOpen,
}: {
  rows: Employee[];
  onOpen: (e: Employee) => void;
}) {
  const [month, setMonth] = useState(today().slice(0, 7));

  const list = useMemo(() => {
    const t = today();
    const out: Row[] = [];
    for (const e of rows) {
      if (e.hire_date.startsWith(month)) out.push({ kind: "입사", e, date: e.hire_date });
      if (e.resign_date?.startsWith(month)) {
        out.push({ kind: displayStatus(e, t) === "퇴사예정" ? "퇴사예정" : "퇴사", e, date: e.resign_date });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.e.employee_no.localeCompare(b.e.employee_no));
  }, [rows, month]);

  const n = (k: Kind) => list.filter((r) => r.kind === k).length;

  function exportCsv() {
    downloadTable(
      `입퇴사_${month.replace("-", "")}.csv`,
      ["구분", "사번", "이름", "소속", "부서", "고용형태", "직급", "일자"],
      list.map((r) => [r.kind, r.e.employee_no, r.e.name_ko, r.e.company, r.e.department, r.e.employment_type, r.e.position, r.date]),
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>이달 입퇴사</h3>
        <span className="unit">
          입사 {n("입사")} · 퇴사 {n("퇴사")} · 퇴사예정 {n("퇴사예정")} · 명
        </span>
        <span className="head-meta">
          <input
            type="month"
            className="input period"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            aria-label="집계 월"
          />
          <button type="button" className="btn" disabled={list.length === 0} onClick={exportCsv}>
            엑셀 ({list.length})
          </button>
        </span>
      </div>

      {list.length === 0 ? (
        <div className="t-empty">{month.replace("-", "년 ")}월에 입사·퇴사한 사람이 없습니다.</div>
      ) : (
        <div className="t-scroll">
          <table>
            <thead>
              <tr>
                <th>구분</th>
                <th>사번</th>
                <th>이름</th>
                <th>부서</th>
                <th>고용형태</th>
                <th className="a-right">일자</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={`${r.kind}:${r.e.employee_no}`}
                  className="rowlink"
                  tabIndex={0}
                  role="button"
                  aria-label={`${r.e.name_ko} 인사카드 열기`}
                  onClick={() => onOpen(r.e)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onOpen(r.e);
                    }
                  }}
                >
                  <td>
                    <span className={KIND_DOT[r.kind]}>{r.kind}</span>
                  </td>
                  <td>{r.e.employee_no}</td>
                  <td>{r.e.name_ko}</td>
                  <td>{r.e.department}</td>
                  <td>{r.e.employment_type}</td>
                  <td className="a-right">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
