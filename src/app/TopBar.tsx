"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthBar, { useSession } from "./AuthBar";

export default function TopBar() {
  const { session } = useSession();
  const pathname = usePathname();

  return (
    // P4 — 헤더 배경은 전체 폭, 내용물은 본문과 같은 1200px 그리드에 정렬
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          직원 정보 관리 시스템
        </Link>
        <span className="chip">데모 · 더미데이터</span>
        <nav className="topnav">
          <Link href="/" className={pathname === "/" ? "topnav-link on" : "topnav-link"}>
            직원
          </Link>
          <Link
            href="/change-log"
            className={pathname === "/change-log" ? "topnav-link on" : "topnav-link"}
          >
            변경 이력
          </Link>
        </nav>
        <span className="grow" />
        <AuthBar session={session} />
      </div>
    </header>
  );
}
