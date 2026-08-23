"use client";

import coords from "@/lib/region_coords.json";

type Point = { region: string; x: number; y: number };

const POINTS: Point[] = coords.points;
const [, , VW, VH] = coords.viewBox;

/**
 * 거주지역 버블맵 (R20).
 *
 * 외부 지도 라이브러리를 쓰지 않는다 — 수도권 24개 시·구의 위경도를 선형투영한
 * 좌표만 있으면 되고, 지도 타일을 불러오면 자체 포함 배포가 깨진다.
 *
 * 크기로만 구분한다 (R16): 원 넓이가 인원수에 비례하도록 반지름은 sqrt 스케일.
 * 색은 전부 같은 강조색이며 의미를 담지 않는다. 각 원에 지역명과 수치를 붙이고,
 * 겹칠 때 작은 원이 위로 오도록 큰 것부터 그린다.
 */
export default function RegionBubbleMap({
  counts,
  total,
}: {
  counts: Map<string, number>;
  total: number;
}) {
  const placed = POINTS.map((p) => ({ ...p, n: counts.get(p.region) ?? 0 })).filter(
    (p) => p.n > 0,
  );

  if (placed.length === 0) return null;

  const max = Math.max(...placed.map((p) => p.n));
  const R_MIN = 11;
  const R_MAX = 38;
  const radius = (n: number) => R_MIN + (Math.sqrt(n) / Math.sqrt(max)) * (R_MAX - R_MIN);

  // 큰 원을 먼저 그려야 작은 원이 그 위에 올라와 가려지지 않는다
  const drawOrder = [...placed].sort((a, b) => b.n - a.n);

  return (
    <div className="bubblemap">
      <div className="chart-legend">
        <span className="lg">
          <span className="sw sw-bubble" aria-hidden="true" /> 원 넓이 = 인원수
        </span>
        <span className="lg-note">
          수도권 {placed.length}개 시·구 · 위경도 선형투영 근사 · 색은 의미 없음
        </span>
      </div>

      <div className="t-scroll">
        <svg
          className="bmap"
          viewBox={`0 0 ${VW} ${VH}`}
          role="img"
          aria-label={`거주지역 버블맵. ${drawOrder
            .map((p) => `${p.region} ${p.n}명`)
            .join(", ")}`}
        >
          {drawOrder.map((p) => {
            const r = radius(p.n);
            const pct = ((p.n / total) * 100).toFixed(1);
            return (
              <g key={p.region}>
                <title>{`${p.region} ${p.n}명 (${pct}%)`}</title>
                <circle cx={p.x} cy={p.y} r={r} className="bub" />
                <text x={p.x} y={p.y + 5} className="bub-n">
                  {p.n}
                </text>
                {/* 도심부는 원이 겹쳐 라벨이 서로를 가린다. 큰 것만 이름을 달고
                    나머지는 아래 집계 표에서 정확한 값을 읽는다 */}
                {p.n >= 5 && (
                  <text x={p.x} y={p.y + r + 13} className="bub-label">
                    {p.region.replace(/^(서울|경기|인천) /, "")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
