"use client";

import { useMemo } from "react";
import { isOnBoard, type Employee } from "@/lib/supabase";
import { accruedLeave, usedLeave, type Leave } from "@/lib/leave";

type Row = { dept: string; accrued: number; used: number; remain: number; rate: number; low: boolean };

function num(n: number): string {
  return n % 1 ? n.toFixed(1) : String(n);
}

/**
 * 부서별 연차 사용 (A2) — 기존 '연차 사용 현황'(전사 합계)을 부서 축으로 펼치고,
 * 전사 수치는 합계행으로 남긴다. 소진율 하위 2개 부서는 독려 대상이라 표시한다.
 * 발생은 산식(가정) · 사용은 leaves 기록 — 산정 기준은 인사팀 확인 예정(260826 승계).
 */
export default function LeaveByDept({
  rows,
  leaves,
  compact = false,
}: {
  rows: Employee[];
  leaves: Leave[] | null;
  /** grid2 좌측에 A4가 올 때 — 부서 열만 남기고 폭을 줄인 배치 */
  compact?: boolean;
}) {
  const { list, total } = useMemo(() => {
    const onBoard = rows.filter((r) => isOnBoard(r));
    const byDept = new Map<string, { accrued: number; used: number }>();
    const leavesBy = new Map<string, Leave[]>();
    for (const l of leaves ?? []) leavesBy.set(l.employee_no, [...(leavesBy.get(l.employee_no) ?? []), l]);
    for (const e of onBoard) {
      const cur = byDept.get(e.department) ?? { accrued: 0, used: 0 };
      cur.accrued += accruedLeave(e);
      cur.used += usedLeave(leavesBy.get(e.employee_no) ?? []);
      byDept.set(e.department, cur);
    }
    const list: Row[] = [...byDept.entries()]
      .map(([dept, v]) => ({
        dept,
        accrued: v.accrued,
        used: v.used,
        remain: v.accrued - v.used,
        rate: v.accrued ? (v.used / v.accrued) * 100 : 0,
        low: false,
      }))
      // 가나다순 — 순위표로 읽히지 않게 (A4 부서 이행률과 같은 규율)
      .sort((a, b) => a.dept.localeCompare(b.dept, "ko"));
    // 소진율 하위 2개 부서 표시 (발생 0인 부서는 제외)
    [...list]
      .filter((r) => r.accrued > 0)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 2)
      .forEach((r) => (r.low = true));
    const accrued = list.reduce((s, r) => s + r.accrued, 0);
    const used = list.reduce((s, r) => s + r.used, 0);
    return { list, total: { accrued, used, remain: accrued - used, rate: accrued ? (used / accrued) * 100 : 0 } };
  }, [rows, leaves]);

  const maxRate = Math.max(1, ...list.map((r) => r.rate));

  return (
    <section className="card">
      <div className="card-head">
        <h3>부서별 연차 사용</h3>
        <span className="unit">현원 · 가나다순 · 소진율 하위 2개 부서 표시</span>
      </div>

      {leaves === null ? (
        <div className="t-empty">불러오는 중…</div>
      ) : list.length === 0 ? (
        <div className="t-empty">집계할 현원이 없습니다.</div>
      ) : (
        <div className="t-scroll">
          <table className={compact ? "leave-dept compact" : "leave-dept"}>
            <thead>
              <tr>
                <th>부서</th>
                <th className="a-right">발생</th>
                <th className="a-right">사용</th>
                <th className="a-right">잔여</th>
                <th className="a-right">소진율</th>
                <th>분포</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.dept} className={r.low ? "low" : undefined}>
                  <td>
                    {r.dept}
                    {r.low && <span className="chip warn low-chip">소진 하위</span>}
                  </td>
                  <td className="a-right">{num(r.accrued)}</td>
                  <td className="a-right">{num(r.used)}</td>
                  <td className="a-right">{num(r.remain)}</td>
                  <td className="a-right">{r.rate.toFixed(0)}%</td>
                  <td>
                    <span className="track bar-cell" aria-hidden="true">
                      <span className="fill" style={{ width: `${(r.rate / maxRate) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>전사 합계</td>
                <td className="a-right">{num(total.accrued)}</td>
                <td className="a-right">{num(total.used)}</td>
                <td className="a-right">{num(total.remain)}</td>
                <td className="a-right">{total.rate.toFixed(0)}%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="callout">
        발생 = 근로기준법 기본 산식(입사일 기준)의 <b>가정값</b> · 사용 = 연차 사용 기록. 산정
        기준(회계연도·이월)은 인사팀 확인 예정입니다.
      </div>
    </section>
  );
}
