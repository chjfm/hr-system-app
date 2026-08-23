"use client";

import { useId } from "react";

export type MonthPoint = {
  month: string; // YYYY-MM
  inn: number;
  out: number;
  net: number;
};

/**
 * 인원 변동 12개월 추이 (R12).
 *
 * 140명 규모라 월 변동이 0~3명대다. 막대만 그리면 차이가 눈에 안 보이므로
 * 수치를 함께 찍고(R16 그래프 수치 병기), 분기 합계를 아래에 병기해
 * 추세를 읽을 수 있게 한다.
 *
 * 색으로만 입사/퇴사를 구분하지 않는다 — 범례에 라벨을 붙이고 막대 방향으로도
 * 구분한다(입사 위 / 퇴사 아래).
 */
export default function MovementChart({ data }: { data: MonthPoint[] }) {
  const clipId = useId();
  const max = Math.max(1, ...data.map((d) => Math.max(d.inn, d.out)));

  const W = 720;
  const H = 150;
  const PAD_L = 26;
  const PAD_B = 34;
  const PAD_T = 14;
  const mid = PAD_T + (H - PAD_T - PAD_B) / 2;
  const half = (H - PAD_T - PAD_B) / 2;
  const step = (W - PAD_L) / data.length;
  const barW = Math.min(18, step * 0.42);

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span className="lg">
          <span className="sw sw-in" aria-hidden="true" /> 입사 (위)
        </span>
        <span className="lg">
          <span className="sw sw-out" aria-hidden="true" /> 퇴사 (아래)
        </span>
        <span className="lg-note">막대 위 숫자 = 인원 · 축 위/아래로도 구분</span>
      </div>

      <div className="t-scroll">
        <svg
          className="chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`최근 12개월 인원 변동. ${data
            .map((d) => `${d.month} 입사 ${d.inn}명 퇴사 ${d.out}명`)
            .join(", ")}`}
        >
          <clipPath id={clipId}>
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>

          {/* 0선 */}
          <line x1={PAD_L - 6} y1={mid} x2={W} y2={mid} stroke="var(--line-strong)" strokeWidth="1" />
          <text x="0" y={mid + 3} className="ax">
            0
          </text>

          <g clipPath={`url(#${clipId})`}>
            {data.map((d, i) => {
              const x = PAD_L + i * step + (step - barW) / 2;
              const hIn = (d.inn / max) * half;
              const hOut = (d.out / max) * half;
              return (
                <g key={d.month}>
                  {d.inn > 0 && (
                    <>
                      <rect x={x} y={mid - hIn} width={barW} height={hIn} className="bar-in" />
                      <text x={x + barW / 2} y={mid - hIn - 4} className="val">
                        {d.inn}
                      </text>
                    </>
                  )}
                  {d.out > 0 && (
                    <>
                      <rect x={x} y={mid} width={barW} height={hOut} className="bar-out" />
                      <text x={x + barW / 2} y={mid + hOut + 11} className="val">
                        {d.out}
                      </text>
                    </>
                  )}
                  <text x={x + barW / 2} y={H - 18} className="ax-m">
                    {d.month.slice(5)}
                  </text>
                  {(d.month.slice(5) === "01" || i === 0) && (
                    <text x={x + barW / 2} y={H - 6} className="ax-y">
                      {d.month.slice(0, 4)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
