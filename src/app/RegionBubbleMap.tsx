"use client";

import coords from "@/lib/region_coords.json";

type Point = { region: string; x: number; y: number; dist_km: number };

const POINTS: Point[] = coords.points;
const HQ = coords.hq;
const RINGS = coords.rings;
const [, , VW, VH] = coords.viewBox;

export const REGION_DISTANCE = new Map(POINTS.map((p) => [p.region, p.dist_km]));

/**
 * 거주지역 버블맵 (R20 · R23).
 *
 * 외부 지도 라이브러리를 쓰지 않는다 — 수도권 시·구의 위경도를 선형투영한 좌표만
 * 있으면 되고, 지도 타일을 불러오면 자체 포함 배포가 깨진다.
 *
 * R23: 복지(주차·기숙사) 판단 기준이 "회사에서 먼 사람"이므로 서초구 사옥을 기점으로
 * 5·10·20km 등거리 링을 깔았다. 링 밖에 남는 원이 곧 기숙사 후보군이다.
 *
 * 색으로 구분하지 않는다 (R16): 인원은 원 크기로, 회사는 십자 마커 모양으로,
 * 링은 점선으로 구분한다.
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
  const outer = drawOrder.filter((p) => p.dist_km > 20);
  const outerCount = outer.reduce((s, p) => s + p.n, 0);

  return (
    <div className="bubblemap">
      <div className="chart-legend">
        <span className="lg">
          <span className="sw sw-bubble" aria-hidden="true" /> 원 넓이 = 인원수
        </span>
        <span className="lg">
          <span className="sw sw-hq" aria-hidden="true" /> 회사 (서초구)
        </span>
        <span className="lg">
          <span className="sw sw-ring" aria-hidden="true" /> 5 · 10 · 20km 등거리
        </span>
        <span className="lg-note">색은 의미 없음 · 구분은 크기와 모양으로</span>
      </div>

      <div className="t-scroll">
        <svg
          className="bmap"
          viewBox={`0 0 ${VW} ${VH}`}
          role="img"
          aria-label={`거주지역 버블맵. 회사는 서초구. ${drawOrder
            .map((p) => `${p.region} ${p.n}명 ${p.dist_km}km`)
            .join(", ")}`}
        >
          {/* 등거리 링 — 가장 뒤에 깔아 원과 라벨을 가리지 않는다 */}
          <g className="rings">
            {RINGS.map((ring) => (
              <g key={ring.km}>
                <circle cx={HQ.x} cy={HQ.y} r={ring.r_px} className="ring" />
                {/* 링 라벨은 좌하단에 둔다 — 위쪽은 도심 원이 몰려 있고
                    바로 아래는 수원시 원과 겹친다 */}
                <text x={HQ.x - 70} y={HQ.y + ring.r_px - 6} className="ring-label">
                  {ring.km}km
                </text>
              </g>
            ))}
          </g>

          {drawOrder.map((p) => {
            const r = radius(p.n);
            const pct = ((p.n / total) * 100).toFixed(1);
            return (
              <g key={p.region}>
                <title>{`${p.region} ${p.n}명 (${pct}%) · 회사에서 ${p.dist_km}km`}</title>
                <circle cx={p.x} cy={p.y} r={r} className="bub" />
                <text x={p.x} y={p.y + 5} className="bub-n">
                  {p.n}
                </text>
                {/* 도심부는 원이 겹쳐 라벨이 서로를 가린다. 큰 것과 먼 곳만 이름을 달고
                    나머지는 아래 집계 표에서 정확한 값을 읽는다 */}
                {(p.n >= 5 || p.dist_km > 20) && (
                  <text x={p.x} y={p.y + r + 13} className="bub-label">
                    {p.region.replace(/^(서울|경기|인천) /, "")}
                  </text>
                )}
              </g>
            );
          })}

          {/* 회사 — 색이 아니라 십자 모양으로 구분한다 */}
          <g className="hq">
            <title>{HQ.name}</title>
            <circle cx={HQ.x} cy={HQ.y} r={9} className="hq-dot" />
            <path
              d={`M${HQ.x - 14} ${HQ.y} H${HQ.x + 14} M${HQ.x} ${HQ.y - 14} V${HQ.y + 14}`}
              className="hq-cross"
            />
            <text x={HQ.x} y={HQ.y + 28} className="hq-label">
              회사
            </text>
          </g>
        </svg>
      </div>

      {outerCount > 0 && (
        <div className="callout">
          <b>20km 링 밖에 {outerCount}명</b>이 있습니다 —{" "}
          {outer.map((p) => `${p.region.replace(/^(서울|경기|인천) /, "")} ${p.n}명(${p.dist_km}km)`).join(" · ")}
          . 기숙사·통근버스 검토 대상입니다.
        </div>
      )}
    </div>
  );
}
