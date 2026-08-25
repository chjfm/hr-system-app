"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FIELD_LABEL } from "@/lib/fields";
import { useSession } from "../AuthBar";

type LogRow = {
  id: string;
  employee_no: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor_email: string | null;
  changed_at: string;
};

const ALL = "전체";

/**
 * 변경이력 관리 페이지 (260826 9차 3단계).
 *
 * 인사카드 안의 변경 기록은 개인 20건뿐이다 — "지난주에 누가 무엇을 바꿨나"는
 * 전체를 놓고 기간·사람·항목·변경자로 걸러야 답이 나온다.
 * 개인정보 변경 내역이므로 로그인 사용자에게만 보인다 (쓰기와 같은 기준).
 */
export default function ChangeLogPage() {
  const { session, ready } = useSession();

  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [field, setField] = useState(ALL);
  const [actor, setActor] = useState(ALL);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    supabase
      .from("change_log")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (alive) setLogs((data as LogRow[]) ?? []);
      });
    supabase
      .from("employees")
      .select("employee_no, name_ko")
      .then(({ data }) => {
        if (alive)
          setNames(
            new Map(
              ((data as { employee_no: string; name_ko: string }[]) ?? []).map((r) => [
                r.employee_no,
                r.name_ko,
              ]),
            ),
          );
      });
    return () => {
      alive = false;
    };
  }, [session]);

  const fields = useMemo(
    () => [...new Set((logs ?? []).map((l) => l.field))].sort(),
    [logs],
  );
  const actors = useMemo(
    () => [...new Set((logs ?? []).map((l) => l.actor_email ?? "(기록 없음)"))].sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    if (!logs) return [];
    const needle = q.trim().toLowerCase();
    return logs.filter((l) => {
      if (from && l.changed_at.slice(0, 10) < from) return false;
      if (to && l.changed_at.slice(0, 10) > to) return false;
      if (field !== ALL && l.field !== field) return false;
      if (actor !== ALL && (l.actor_email ?? "(기록 없음)") !== actor) return false;
      if (!needle) return true;
      const name = names.get(l.employee_no) ?? "";
      return `${l.employee_no} ${name}`.toLowerCase().includes(needle);
    });
  }, [logs, from, to, q, field, actor, names]);

  const filterOn = from || to || q || field !== ALL || actor !== ALL;

  // 레이아웃이 <main className="page">로 감싼다 — 여기서는 내용만 그린다
  return (
    <div className="vgroup">
        <div className="page-title">
          <h2>변경 이력</h2>
          <p>직원 정보의 모든 등록·변경 기록 — 누가, 언제, 무엇을 바꿨는지</p>
        </div>

        {!ready ? (
          <div className="t-empty">불러오는 중…</div>
        ) : !session ? (
          <div className="card">
            <div className="callout">
              <b>로그인이 필요합니다.</b> 변경 이력에는 개인정보 변경 내역이 담기므로
              발급된 계정으로 로그인한 사용자만 볼 수 있습니다. 우측 상단에서 로그인하세요.
            </div>
            <div className="toolbar">
              <Link href="/" className="btn">
                ← 직원 목록으로
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-head">
              <h3>전체 기록</h3>
              <span className="unit">
                {logs === null
                  ? "불러오는 중…"
                  : `${filtered.length}건 표시${
                      filtered.length !== logs.length ? ` · 전체 ${logs.length}건` : ""
                    } · 최신 1,000건`}
              </span>
            </div>

            <div className="toolbar">
              <input
                className="input"
                style={{ minWidth: 160 }}
                placeholder="사번·이름 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <input
                type="date"
                className="input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="시작일"
              />
              <span className="hint">~</span>
              <input
                type="date"
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="종료일"
              />
              <select className="input" value={field} onChange={(e) => setField(e.target.value)}>
                <option value={ALL}>항목 · 전체</option>
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {FIELD_LABEL[f] ?? f}
                  </option>
                ))}
              </select>
              <select className="input" value={actor} onChange={(e) => setActor(e.target.value)}>
                <option value={ALL}>변경자 · 전체</option>
                {actors.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {filterOn && (
                <button
                  className="btn"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                    setQ("");
                    setField(ALL);
                    setActor(ALL);
                  }}
                >
                  초기화
                </button>
              )}
              <span className="grow" />
              <Link href="/" className="btn">
                ← 직원 목록
              </Link>
            </div>

            {logs === null ? (
              <div className="t-empty">불러오는 중…</div>
            ) : filtered.length === 0 ? (
              <div className="t-empty">조건에 맞는 기록이 없습니다.</div>
            ) : (
              <div className="t-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>변경 시각</th>
                      <th>사번</th>
                      <th>이름</th>
                      <th>항목</th>
                      <th>이전</th>
                      <th>변경 후</th>
                      <th>변경자</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr key={l.id}>
                        <td className="nowrap">
                          {l.changed_at.slice(0, 16).replace("T", " ")}
                        </td>
                        <td>{l.employee_no}</td>
                        <td>{names.get(l.employee_no) ?? "–"}</td>
                        <td>{FIELD_LABEL[l.field] ?? l.field}</td>
                        <td>{l.old_value ?? "–"}</td>
                        <td>{l.new_value ?? "–"}</td>
                        <td>{l.actor_email ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
