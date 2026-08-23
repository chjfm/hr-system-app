"use client";

import { useMemo, useState } from "react";
import CollapsibleCard from "./CollapsibleCard";
import RegionBubbleMap from "./RegionBubbleMap";
import { isOnBoard, type Employee } from "@/lib/supabase";

/**
 * 거주지역 분포 (R18).
 *
 * 버블맵(R20)과 집계 리스트를 함께 둔다 — 지도는 "어디에 몰려 있나"를, 리스트는
 * "정확히 몇 명인가"를 답한다. 외부 지도 라이브러리는 쓰지 않는다(자체 포함 배포).
 *
 * 개인정보 설계 고정: 시·구 단위만. 상세 주소는 저장하지도 표시하지도 않는다.
 */
export default function ResidenceBreakdown({ rows }: { rows: Employee[] }) {
  const [expanded, setExpanded] = useState(false);

  const { counts, list, unknown, onBoardCount } = useMemo(() => {
    const onBoardRows = rows.filter((r) => isOnBoard(r));
    const count = new Map<string, number>();
    let unknown = 0;
    for (const r of onBoardRows) {
      if (!r.residence) unknown += 1;
      else count.set(r.residence, (count.get(r.residence) ?? 0) + 1);
    }
    return {
      counts: count,
      list: [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")),
      unknown,
      onBoardCount: onBoardRows.length,
    };
  }, [rows]);

  const max = Math.max(1, ...list.map(([, n]) => n));
  const shown = expanded ? list : list.slice(0, 8);

  return (
    <CollapsibleCard
      id="residence"
      title="거주지역 분포"
      defaultOpen={false}
      meta={
        <span className="unit">
          현원 {onBoardCount}명 · {list.length}개 지역
          {unknown > 0 && ` · 미기재 ${unknown}`}
        </span>
      }
    >

      <RegionBubbleMap counts={counts} total={onBoardCount} />

      <div className="t-scroll">
        <table>
          <thead>
            <tr>
              <th>지역</th>
              <th className="a-right">인원</th>
              <th className="a-right">비중</th>
              <th>분포</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(([area, n]) => (
              <tr key={area}>
                <td>{area}</td>
                <td className="a-right">{n}</td>
                <td className="a-right">{((n / onBoardCount) * 100).toFixed(1)}%</td>
                <td>
                  {/* 수치를 이미 왼쪽에 적었으므로 막대는 보조 표현이다 (R16) */}
                  <span className="track bar-cell" aria-hidden="true">
                    <span className="fill" style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.length > 8 && (
        <div className="toolbar">
          <button className="btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "상위 8개만 보기" : `나머지 ${list.length - 8}개 지역 보기`}
          </button>
        </div>
      )}

      <div className="callout">
        시·구 단위만 기록합니다 — <b>상세 주소는 저장하지 않습니다.</b> 통근 거리·거점
        오피스 검토처럼 집계 목적에는 시·구로 충분하고, 그 이상은 보관할 이유가 없습니다.
      </div>
    </CollapsibleCard>
  );
}
