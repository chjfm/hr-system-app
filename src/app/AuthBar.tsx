"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** 데모용 계정 — 실제 도입 시에는 담당자별 계정을 발급해야 변경자 기록이 의미를 갖는다 */
const DEMO = { email: "hr.demo@gaon.co.kr", password: "GaonDemo2026!" };

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, ready };
}

export default function AuthBar({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(DEMO.email);
  const [password, setPassword] = useState(DEMO.password);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fn = mode === "login" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error: err } = await fn.call(supabase.auth, { email, password });
    setBusy(false);
    if (err) setError(err.message);
    else setOpen(false);
  }

  if (session) {
    return (
      <>
        {/* 색 규율 — 화면의 색은 주황(강조)과 상태 점뿐. 로그인 표시는 무채색으로 충분하다 */}
        <span className="chip">{session.user.email}</span>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          로그아웃
        </button>
      </>
    );
  }

  return (
    <>
      <span className="chip">열람 전용</span>
      <button className="btn primary" onClick={() => setOpen(true)}>
        로그인
      </button>

      {open && (
        <div className="backdrop" onClick={() => setOpen(false)}>
          <form className="card modal narrow" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="card-head">
              <h3>{mode === "login" ? "로그인" : "계정 만들기"}</h3>
              <span className="unit">직원 정보 변경에만 필요합니다</span>
            </div>

            <div className="callout">
              <b>조회는 로그인 없이 가능합니다.</b> 등록·수정은 누가 언제 바꿨는지 기록으로
              남아야 하므로 로그인이 필요합니다. 변경 기록에 아래 이메일이 남습니다.
            </div>

            <div className="field">
              <label htmlFor="a-email">이메일</label>
              <input
                id="a-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="field">
              <label htmlFor="a-pw">비밀번호</label>
              <input
                id="a-pw"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            <div className="callout">
              데모 계정이 미리 입력돼 있습니다 — <b>{DEMO.email}</b>. 본인 이메일로 계정을
              만들면 변경 기록에 그 이메일이 남습니다.
            </div>

            {error && <div className="callout error">{error}</div>}

            <div className="toolbar">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                }}
              >
                {mode === "login" ? "계정 만들기" : "로그인으로"}
              </button>
              <span className="grow" />
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                취소
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 로그인"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
