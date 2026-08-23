"use client";

import { useState } from "react";

export type MonthPoint = {
  month: string; // YYYY-MM
  inn: number;
  out: number;
  net: number;
};

/* viewBox 좌표계를 실제 렌더 폭(약 1100px)에 맞춘다.
   720으로 두면 SVG가 1.52배 확대돼 지정 11px 글자가 화면에서 16.7px로 나온다 —
   본문(11px)보다 크다. 좌표계를 키워 배율을 1에 가깝게 두면 지정 px가 곧 화면 px다. */
const W = 1120;
const H = 305;
const PAD_L = 47;
const PAD_B = 56;
const PAD_T = 37;
const MID = PAD_T + (H - PAD_T - PAD_B) / 2;
const HALF = (H - PAD_T - PAD_B) / 2;
const BAR_W = 17;
const RADIUS = 5.5;

/** 위(입사)는 상단만, 아래(퇴사)는 하단만 둥근 막대. rect 의 rx 는 네 귀퉁이에 다 걸린다. */
function barPath(x: number, w: number, len: number, up: boolean): string {
  const r = Math.min(RADIUS, len);
  return up
    ? `M${x} ${MID} V${MID - len + r} Q${x} ${MID - len} ${x + r} ${MID - len}
       H${x + w - r} Q${x + w} ${MID - len} ${x + w} ${MID - len + r} V${MID} Z`
    : `M${x} ${MID} V${MID + len - r} Q${x} ${MID + len} ${x + r} ${MID + len}
       H${x + w - r} Q${x + w} ${MID + len} ${x + w} ${MID + len - r} V${MID} Z`;
}

/**
 * 인원 변동 12개월 추이 (R12 · R25).
 *
 * 두 계열을 색으로 나누지 않는다 — 같은 강조색에 입사는 채움, 퇴사는 아웃라인이고
 * 축 위/아래 방향으로도 갈린다. 색을 구분하지 못해도 읽힌다 (R16).
 *
 * 값이 0인 달도 0선 위에 짧은 스텁을 남긴다. 빈칸으로 두면 "데이터가 없다"로 읽히고
 * 12개월의 리듬도 끊긴다.
 */
export default function MovementChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => Math.max(d.inn, d.out)));
  const step = (W - PAD_L) / data.length;
  const scale = (n: number) => (n / max) * HALF;
  const xOf = (i: number) => PAD_L + i * step + (step - BAR_W) / 2;

  const active = hover === null ? null : data[hover];

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span className="lg">
          <span className="sw sw-in" aria-hidden="true" /> 입사 (위)
        </span>
        <span className="lg">
          <span className="sw sw-out" aria-hidden="true" /> 퇴사 (아래)
        </span>
        <span className="lg-note">막대에 올리면 그 달 수치가 표시됩니다</span>
      </div>

      <div className="chart-box">
        <svg
          className="chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`최근 12개월 인원 변동. ${data
            .map((d) => `${d.month} 입사 ${d.inn}명 퇴사 ${d.out}명`)
            .join(", ")}`}
          onMouseLeave={() => setHover(null)}
        >
          {/* 그리드는 최대치 두 줄만 아주 옅게. 0선만 한 단계 진하게. */}
          <line x1={PAD_L - 12} y1={MID - HALF} x2={W} y2={MID - HALF} className="gridline" />
          <line x1={PAD_L - 12} y1={MID + HALF} x2={W} y2={MID + HALF} className="gridline" />
          <line x1={PAD_L - 12} y1={MID} x2={W} y2={MID} className="zeroline" />
          <text x="0" y={MID - HALF + 5} className="ax">{max}</text>
          <text x="0" y={MID + 5} className="ax">0</text>
          <text x="0" y={MID + HALF + 5} className="ax">{max}</text>

          {data.map((d, i) => {
            const x = xOf(i);
            const on = hover === i;
            const hIn = scale(d.inn);
            const hOut = scale(d.out);
            return (
              <g key={d.month} className={on ? "col on" : "col"}>
                {/* 값이 0이어도 0선 위에 스텁을 남겨 리듬을 유지한다 */}
                {d.inn > 0 ? (
                  <path d={barPath(x, BAR_W, hIn, true)} className="bar-in" />
                ) : (
                  <rect x={x} y={MID - 3} width={BAR_W} height={3} rx={1.5} className="stub" />
                )}
                {d.out > 0 ? (
                  <path d={barPath(x, BAR_W, hOut, false)} className="bar-out" />
                ) : (
                  <rect x={x} y={MID} width={BAR_W} height={3} rx={1.5} className="stub" />
                )}

                {d.inn > 0 && (
                  <text x={x + BAR_W / 2} y={MID - hIn - 9} className="val">
                    {d.inn}
                  </text>
                )}
                {d.out > 0 && (
                  <text x={x + BAR_W / 2} y={MID + hOut + 18} className="val">
                    {d.out}
                  </text>
                )}

                <text x={x + BAR_W / 2} y={H - 28} className="ax-m">
                  {d.month.slice(5)}
                </text>
                {(d.month.slice(5) === "01" || i === 0) && (
                  <text x={x + BAR_W / 2} y={H - 8} className="ax-y">
                    {d.month.slice(0, 4)}
                  </text>
                )}

                {/* 히트 영역은 막대보다 넓게 — 얇은 막대를 정확히 겨냥하지 않아도 잡힌다 */}
                <rect
                  x={PAD_L + i * step}
                  y={PAD_T - 15}
                  width={step}
                  height={H - PAD_T - PAD_B + 30}
                  className="hit"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.month} 입사 ${d.inn}명 퇴사 ${d.out}명 증감 ${d.net > 0 ? "+" : ""}${d.net}명`}
                />
              </g>
            );
          })}
        </svg>

        {active && (
          <div
            className="chart-tip"
            // 양끝 달에서 툴팁이 카드 밖으로 잘리지 않게 가둔다
            style={{
              left: `${Math.min(88, Math.max(12, ((hover! + 0.5) * step + PAD_L - BAR_W / 2) / W * 100))}%`,
            }}
            role="status"
          >
            <b>{active.month}</b>
            <span>입사 {active.inn}</span>
            <span>퇴사 {active.out}</span>
            <span className={active.net > 0 ? "pos" : active.net < 0 ? "neg" : undefined}>
              증감 {active.net > 0 ? "+" : ""}
              {active.net}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
