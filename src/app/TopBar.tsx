"use client";

import AuthBar, { useSession } from "./AuthBar";

export default function TopBar() {
  const { session } = useSession();

  return (
    <header className="topbar">
      <span className="brand">직원 정보 관리 시스템</span>
      <span className="chip">데모 · 더미데이터</span>
      <span className="grow" />
      <AuthBar session={session} />
    </header>
  );
}
