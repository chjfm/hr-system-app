"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/* v2 — 현황·대장 탭 분리(260825)로 화면 구조가 바뀌어 구키의 접힘 상태를 승계하지 않는다.
   키 교체로 1회 리셋되고, 이후에는 다시 사용자 선택이 우선한다 (R19 유지, 이슈 #1). */
const PREFIX = "ai_people.section.v2.";

/**
 * 대시보드 섹션 접기/펴기 (R19).
 *
 * 초기값은 섹션마다 defaultOpen 으로 정하고, 마지막 상태를 localStorage 에 남겨
 * 다시 열었을 때 그대로 보인다. 저장값이 있으면 그쪽이 초기값을 덮는다.
 * 저장이 막힌 환경(시크릿 창·사이트 데이터 차단)에서는 읽기·쓰기가 예외를 던지므로
 * 전부 try/catch 로 감싸고, 값을 못 읽으면 defaultOpen 그대로 그린다.
 */
export default function CollapsibleCard({
  id,
  title,
  meta,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  /** 저장된 상태가 없을 때의 초기값. 저장값이 있으면 그쪽이 이긴다. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  // 서버 렌더와 첫 클라이언트 렌더를 맞춘 뒤에 저장값을 적용한다
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PREFIX + id);
      // 저장값이 있으면 그것이 기본값을 덮는다 — 사용자가 마지막에 둔 상태가 우선
      if (saved === "0") setOpen(false);
      else if (saved === "1") setOpen(true);
    } catch {
      // 저장소를 못 읽는 환경 — defaultOpen 그대로 둔다
    }
    setHydrated(true);
  }, [id]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(PREFIX + id, next ? "1" : "0");
      } catch {
        // 저장에 실패해도 이번 세션 동작은 그대로 유지한다
      }
      return next;
    });
  }

  const shown = hydrated ? open : defaultOpen;

  return (
    <section className="card">
      {/* 헤더 행 전체가 토글이다 — 버튼의 클릭은 여기로 버블되고,
          meta 안의 select 등은 stopPropagation으로 토글을 건드리지 않는다 */}
      <div className="card-head head-toggle" onClick={toggle}>
        <button
          type="button"
          className="sec-toggle"
          aria-expanded={shown}
          aria-controls={panelId}
        >
          {/* 문자 글리프(▸)는 잉크가 폰트 크기의 절반이라 SVG로 그린다 — 잉크 14px */}
          <svg className="caret" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M5.5 1.5 L12.5 8 L5.5 14.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3>{title}</h3>
        </button>
        {meta && (
          <span className="head-meta" onClick={(e) => e.stopPropagation()}>
            {meta}
          </span>
        )}
      </div>

      <div id={panelId} hidden={!shown} className="sec-body">
        {children}
      </div>
    </section>
  );
}
