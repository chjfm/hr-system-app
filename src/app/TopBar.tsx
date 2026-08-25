"use client";

import AuthBar, { useSession } from "./AuthBar";

export default function TopBar() {
  const { session } = useSession();

  return (
    // P4 — 헤더 배경은 전체 폭, 내용물은 본문과 같은 1200px 그리드에 정렬
    <header className="topbar">
      <div className="topbar-in">
        <span className="brand">직원 정보 관리 시스템</span>
        <span className="chip">데모 · 더미데이터</span>
        <span className="grow" />
        <AuthBar session={session} />
      </div>
    </header>
  );
}
