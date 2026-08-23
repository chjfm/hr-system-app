import type { Metadata } from "next";
import "./design-tokens.css";
import "./app.css";

export const metadata: Metadata = {
  title: "직원 정보 관리 시스템",
  description: "입사부터 재직·퇴사까지 직원 정보를 한곳에서 관리합니다 (데모 · 더미데이터)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" data-theme="light">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <header className="topbar">
          <span className="brand">직원 정보 관리 시스템</span>
          <span className="chip">데모 · 더미데이터</span>
        </header>
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
