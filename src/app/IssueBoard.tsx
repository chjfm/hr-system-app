"use client";

import { useMemo, useState } from "react";
import { ISSUE_KINDS, type Issue, type IssueKind, type IssueState } from "@/lib/issues";
import { ddayLabel } from "@/lib/dates";
import type { Employee } from "@/lib/supabase";

const ALL = "전체";

/* 상태는 점+텍스트 — 표 위에 색 배지를 깔지 않는다 (대장 재직구분과 같은 문법) */
const STATE_DOT: Record<IssueState, string> = {
  경과: "st no",
  임박: "st no",
  주의: "st plan",
  예정: "st",
  도래: "st ok",
  미기재: "st plan",
};

/**
 * 인사 이슈 보드 (A1) — 현황 탭 최상단. "오늘 손댈 일"이 구성·추이보다 먼저다.
 * 유형 칩으로 거르고, 행을 누르면 인사카드가 열린다. 알림 발송은 2차 — 여기는 표시까지.
 */
export default function IssueBoard({
  issues,
  loading,
  onOpen,
}: {
  issues: Issue[];
  loading: boolean;
  onOpen: (e: Employee) => void;
}) {
  const [kind, setKind] = useState<IssueKind | typeof ALL>(ALL);

  const counts = useMemo(() => {
    const m = new Map<IssueKind, number>();
    for (const i of issues) m.set(i.kind, (m.get(i.kind) ?? 0) + 1);
    return m;
  }, [issues]);

  const shown = kind === ALL ? issues : issues.filter((i) => i.kind === kind);
  const urgent = issues.filter((i) => i.state === "임박" || i.state === "경과").length;

  return (
    <section className="card issue-board" aria-label="인사 이슈 보드">
      <div className="card-head">
        <h3>인사 이슈 보드</h3>
        <span className="unit">
          향후 30일 · 근속 도래는 올해 전체
          {urgent > 0 && ` · 임박·경과 ${urgent}건`}
        </span>
      </div>

      {/* 유형 필터 칩 — 선택된 것만 주황 (대장 부서 칩과 같은 규율) */}
      <div className="deptlist" role="tablist" aria-label="이슈 유형">
        <button
          type="button"
          role="tab"
          aria-selected={kind === ALL}
          className={`chip chip-btn${kind === ALL ? " on" : ""}`}
          onClick={() => setKind(ALL)}
        >
          전체 {issues.length}
        </button>
        {ISSUE_KINDS.map((k) => {
          const n = counts.get(k) ?? 0;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={`chip chip-btn${kind === k ? " on" : ""}${n === 0 ? " dim" : ""}`}
              onClick={() => setKind(kind === k ? ALL : k)}
            >
              {k} {n}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="t-empty">불러오는 중…</div>
      ) : shown.length === 0 ? (
        <div className="t-empty">
          {kind === ALL ? "향후 30일 안에 손댈 이슈가 없습니다." : `'${kind}' 대상자가 없습니다.`}
        </div>
      ) : (
        <div className="t-scroll issue-scroll">
          <table>
            <thead>
              <tr>
                <th>유형</th>
                <th>구성원</th>
                <th>부서</th>
                <th className="a-right">기준일</th>
                <th className="a-right">D-Day</th>
                <th className="a-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const e = i.employee;
                return (
                  <tr
                    key={i.key}
                    className={`rowlink issue-row ${i.state === "임박" || i.state === "경과" ? "urgent" : i.state === "주의" ? "soon" : ""}`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${e.name_ko} 인사카드 열기`}
                    onClick={() => onOpen(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onOpen(e);
                      }
                    }}
                  >
                    <td>
                      {i.kind}
                      {i.note && <span className="issue-note">{i.note}</span>}
                    </td>
                    <td>
                      {e.name_ko}
                      <span className="issue-note">{e.employee_no}</span>
                    </td>
                    <td>{e.department}</td>
                    <td className="a-right">{i.date ?? "–"}</td>
                    <td className="a-right">{i.dday === null ? "–" : ddayLabel(i.dday)}</td>
                    <td className="a-center">
                      <span className={STATE_DOT[i.state]}>{i.state}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
