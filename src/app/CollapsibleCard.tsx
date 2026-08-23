"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

const PREFIX = "ai_people.section.";

/**
 * 대시보드 섹션 접기/펴기 (R19).
 *
 * 기본은 펼침. 마지막 상태를 localStorage 에 남겨 다시 열었을 때 그대로 보인다.
 * 저장이 막힌 환경(시크릿 창·사이트 데이터 차단)에서는 읽기·쓰기가 예외를 던지므로
 * 전부 try/catch 로 감싸고, 값이 없으면 펼침으로 그린다.
 */
export default function CollapsibleCard({
  id,
  title,
  meta,
  children,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(true);
  // 서버 렌더와 첫 클라이언트 렌더를 맞춘 뒤에 저장값을 적용한다
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PREFIX + id);
      if (saved === "0") setOpen(false);
    } catch {
      // 저장소를 못 읽는 환경 — 기본값(펼침)으로 둔다
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

  const shown = hydrated ? open : true;

  return (
    <section className="card">
      <div className="card-head">
        <button
          type="button"
          className="sec-toggle"
          onClick={toggle}
          aria-expanded={shown}
          aria-controls={panelId}
        >
          <span className="caret" aria-hidden="true">
            {shown ? "▾" : "▸"}
          </span>
          <h3>{title}</h3>
        </button>
        {meta}
      </div>

      <div id={panelId} hidden={!shown} className="sec-body">
        {children}
      </div>
    </section>
  );
}
