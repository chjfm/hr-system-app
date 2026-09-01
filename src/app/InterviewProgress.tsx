"use client";

import { useMemo, useState } from "react";
import type { Employee } from "@/lib/supabase";
import type { Interview } from "@/lib/growth";
import { GAP_DAYS, TARGET_KINDS, interviewStats } from "@/lib/interviewStats";

/**
 * 면담 진행률 (A4) — 대상 대비 완료 %, 부서별 이행률(가나다순 · 순위 금지), 90일 무기록 인원.
 * B1 면담 기록이 입력이다. 대상 정의·임계값은 가정(lib/interviewStats.ts) — 인사팀 확정 후 조정.
 */
export default function InterviewProgress({
  rows,
  interviews,
  onOpen,
}: {
  rows: Employee[];
  interviews: Interview[] | null;
  onOpen: (e: Employee) => void;
}) {
  const [showGap, setShowGap] = useState(false);
  const stats = useMemo(() => interviewStats(rows, interviews ?? []), [rows, interviews]);

  return (
    <section className="card">
      <div className="card-head">
        <h3>면담 진행률</h3>
        <span className="unit">{stats.half} · 100일 · 1년 · 수습 · 정기</span>
      </div>

      {interviews === null ? (
        <div className="t-empty">불러오는 중…</div>
      ) : (
        <>
          <div className="progress-lead">
            <div className="progress-num">
              <span className="v">{stats.rate.toFixed(0)}%</span>
              <span className="s">
                완료 {stats.done} / 대상 {stats.total}건
              </span>
            </div>
            <div className="track progress-track" aria-hidden="true">
              <span className="fill" style={{ width: `${stats.rate}%` }} />
            </div>
            <div className="progress-kinds">
              {TARGET_KINDS.map((k) => (
                <span key={k} className="chip">
                  {k} {stats.byKind[k].done}/{stats.byKind[k].targets}
                </span>
              ))}
            </div>
          </div>

          <div className="t-scroll">
            <table className="progress-dept">
              <thead>
                <tr>
                  <th>부서</th>
                  <th className="a-right">완료/대상</th>
                  <th className="a-right">이행률</th>
                  <th>분포</th>
                  <th className="a-right">무기록</th>
                </tr>
              </thead>
              <tbody>
                {stats.byDept.map((d) => (
                  <tr key={d.dept}>
                    <td>{d.dept}</td>
                    <td className="a-right">
                      {d.done}/{d.targets}
                    </td>
                    <td className="a-right">{d.targets ? `${d.rate.toFixed(0)}%` : "–"}</td>
                    <td>
                      <span className="track bar-cell" aria-hidden="true">
                        <span className="fill" style={{ width: `${d.rate}%` }} />
                      </span>
                    </td>
                    <td className="a-right">{d.gap || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-head">
            <button type="button" className="sec-toggle" aria-expanded={showGap} onClick={() => setShowGap((v) => !v)}>
              <svg className="caret" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 1.5 L12.5 8 L5.5 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3>
                {GAP_DAYS}일 무기록 {stats.gapEmployees.length}명
              </h3>
            </button>
            <span className="unit">면담이 필요한 인원 — 유형 불문 최근 {GAP_DAYS}일 기록 없음</span>
          </div>
          {showGap && (
            stats.gapEmployees.length === 0 ? (
              <div className="t-empty">최근 {GAP_DAYS}일 안에 모두 면담 기록이 있습니다.</div>
            ) : (
              <div className="deptlist">
                {stats.gapEmployees.map((e) => (
                  <button key={e.employee_no} type="button" className="chip chip-btn" onClick={() => onOpen(e)}>
                    {e.name_ko} · {e.department}
                  </button>
                ))}
              </div>
            )
          )}

          <div className="callout">
            대상 = 올해 도래한 100일·1년·수습 면담 + 1년 이상 현원의 반기 정기 면담 1회. 완료 = 같은 유형
            기록(이벤트 ±60일). <b>정의·임계값은 가정</b> — 인사팀 확정 후 조정합니다. 부서 순서는 가나다순입니다.
          </div>
        </>
      )}
    </section>
  );
}
