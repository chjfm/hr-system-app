"use client";

import { useMemo, useState } from "react";
import CollapsibleCard from "./CollapsibleCard";
import { isOnBoard, today, type Employee } from "@/lib/supabase";

const PERIODS = [
  { key: "3", label: "최근 3개월", months: 3 },
  { key: "6", label: "최근 6개월", months: 6 },
  { key: "12", label: "최근 12개월", months: 12 },
  { key: "24", label: "최근 24개월", months: 24 },
] as const;

function monthsAgo(ref: string, n: number): string {
  const [y, m, d] = ref.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - n, d));
  return dt.toISOString().slice(0, 10);
}

/**
 * 부서별 퇴사 집계 (R15) — 부서 단위 이직 경보.
 *
 * 건수만 보면 큰 부서가 늘 위로 온다. 제작 1팀 2명과 인사팀 2명은 전혀 다른
 * 신호이므로 현원 대비 비율을 함께 낸다. 분모는 "기간 말 현원 + 기간 내 퇴사자" —
 * 나간 사람을 분모에서 빼면 이직률이 과대 계상된다.
 */
export default function TurnoverByDept({ rows }: { rows: Employee[] }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("12");

  const { since, list, total } = useMemo(() => {
    const t = today();
    const months = PERIODS.find((p) => p.key === period)!.months;
    const from = monthsAgo(t, months);

    const onBoard = new Map<string, number>();
    for (const r of rows) {
      if (isOnBoard(r)) onBoard.set(r.department, (onBoard.get(r.department) ?? 0) + 1);
    }

    // 기간 내에 실제로 나간 사람만 — 퇴사일이 아직 안 온 사람은 현원이다
    const left = new Map<string, number>();
    for (const r of rows) {
      if (r.resign_date && r.resign_date >= from && r.resign_date <= t) {
        left.set(r.department, (left.get(r.department) ?? 0) + 1);
      }
    }

    const depts = new Set([...onBoard.keys(), ...left.keys()]);
    const list = [...depts]
      .map((d) => {
        const out = left.get(d) ?? 0;
        const now = onBoard.get(d) ?? 0;
        const base = now + out;
        return { dept: d, out, now, rate: base > 0 ? (out / base) * 100 : 0 };
      })
      .filter((r) => r.out > 0)
      .sort((a, b) => b.rate - a.rate || b.out - a.out);

    return {
      since: from,
      list,
      total: list.reduce((s, r) => s + r.out, 0),
    };
  }, [rows, period]);

  const maxRate = Math.max(1, ...list.map((r) => r.rate));

  return (
    <CollapsibleCard
      id="turnover"
      title="부서별 퇴사"
      defaultOpen
      meta={
        <>
          <select
            className="input period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
            aria-label="집계 기간"
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="unit">
            {since} 이후 · 총 {total}명
          </span>
        </>
      }
    >

      {list.length === 0 ? (
        <div className="t-empty">이 기간에 퇴사자가 없습니다.</div>
      ) : (
        <div className="t-scroll">
          <table>
            <thead>
              <tr>
                <th>부서</th>
                <th className="a-right">퇴사</th>
                <th className="a-right">현원</th>
                <th className="a-right">이직률</th>
                <th>분포</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.dept}>
                  <td>{r.dept}</td>
                  <td className="a-right">{r.out}</td>
                  <td className="a-right">{r.now}</td>
                  <td className="a-right">{r.rate.toFixed(1)}%</td>
                  <td>
                    {/* 막대는 보조 표현 — 수치를 왼쪽에 이미 적었다 (R16) */}
                    <span className="track bar-cell" aria-hidden="true">
                      <span className="fill" style={{ width: `${(r.rate / maxRate) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="callout">
        이직률 = 기간 내 퇴사자 ÷ (현원 + 기간 내 퇴사자). <b>건수만 보면 큰 부서가 늘 위로
        옵니다</b> — 같은 2명이라도 33명 부서와 6명 부서는 전혀 다른 신호라 비율순으로
        정렬합니다. 퇴사일이 아직 오지 않은 사람은 현원으로 셉니다.
      </div>
    </CollapsibleCard>
  );
}
