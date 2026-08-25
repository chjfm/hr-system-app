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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // self-signup 제거 (260826 2단계) — 공개 URL에서 누구나 가입=편집 권한을 얻는 구멍.
  // 계정 발급은 관리자가 scripts/create_user.sh 로 한다.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
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
              <h3>로그인</h3>
              <span className="unit">발급 계정 전용</span>
            </div>

            <div className="callout">
              <b>인사정보는 발급된 계정으로만 관리할 수 있습니다.</b> 등록·수정 내역은
              계정 이메일로 기록됩니다.
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
                autoComplete="current-password"
              />
            </div>

            <div className="callout">
              데모 계정이 미리 입력돼 있습니다 — <b>{DEMO.email}</b>. 계정이 필요하면
              인사시스템 담당자에게 발급을 요청하세요.
            </div>

            {error && <div className="callout error">{error}</div>}

            <div className="toolbar">
              <span className="grow" />
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                취소
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "처리 중…" : "로그인"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
