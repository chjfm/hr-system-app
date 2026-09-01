"use client";

import { useMemo, useState } from "react";
import { isOnBoard, supabase, type Department, type Employee } from "@/lib/supabase";

type DeptNode = Department & { count: number };
type CompanyNode = { company: string; count: number; depts: DeptNode[] };

/**
 * 조직도 (B7 · 체크리스트 3-14) — 트리 · 인원 수 · 명칭 수정.
 *
 * 계층은 계열사 › 부서 2단이다. 지시서의 '사업부' 층은 departments 에 컬럼이 없어(항목사전 §3 팀 계층 보류)
 * 이번에는 두지 않는다 — 컬럼이 생기면 같은 트리에 한 층 끼우면 된다.
 * 명칭 수정은 rename_department RPC 로 departments.name 한 곳만 고친다 — employees.department 는
 * FK on update cascade 로 따라오고, RPC 가 발령 트리거의 '부서 이동' 기록을 막는다(명칭 변경 ≠ 발령).
 * 계열사 명칭은 두 표의 자유 텍스트라 여기서 고치지 않는다 (마스터화 후).
 */
export default function OrgChart({
  rows,
  depts,
  canEdit,
  onOpenDept,
  onChanged,
}: {
  rows: Employee[];
  depts: Department[];
  canEdit: boolean;
  onOpenDept: (dept: string) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null); // dept code
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo<CompanyNode[]>(() => {
    const count = new Map<string, number>();
    for (const r of rows) if (isOnBoard(r)) count.set(r.department, (count.get(r.department) ?? 0) + 1);
    const byCompany = new Map<string, DeptNode[]>();
    for (const d of [...depts].sort((a, b) => a.sort_order - b.sort_order)) {
      byCompany.set(d.company, [...(byCompany.get(d.company) ?? []), { ...d, count: count.get(d.name) ?? 0 }]);
    }
    return [...byCompany.entries()].map(([company, ds]) => ({
      company,
      depts: ds,
      count: ds.reduce((s, d) => s + d.count, 0),
    }));
  }, [rows, depts]);

  const total = tree.reduce((s, c) => s + c.count, 0);
  const activeDepts = depts.filter((d) => d.active).length;

  function toggle(company: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });
  }

  function startEdit(d: Department) {
    setEditing(d.code);
    setDraft(d.name);
    setError(null);
  }

  async function rename(d: Department) {
    const name = draft.trim();
    if (!name) {
      setError("부서명은 비울 수 없습니다.");
      return;
    }
    if (name === d.name) {
      setEditing(null);
      return;
    }
    if (depts.some((x) => x.code !== d.code && x.name === name)) {
      setError(`'${name}' 은 이미 있는 부서명입니다.`);
      return;
    }
    if (!window.confirm(`'${d.name}' → '${name}' 으로 바꿀까요?\n이 부서 소속 ${tree.flatMap((c) => c.depts).find((x) => x.code === d.code)?.count ?? 0}명의 부서명이 함께 바뀝니다.`)) return;
    setBusy(true);
    setError(null);
    // RPC — 직접 update 하면 FK cascade 가 발령 트리거를 깨워 소속 전원에게 '부서 이동' 발령이 생긴다
    const { error: err } = await supabase.rpc("rename_department", { p_code: d.code, p_name: name });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(null);
    await onChanged();
  }

  return (
    <div className="vgroup">
      <div className="page-title">
        <h2>조직도</h2>
        <p>계열사 › 부서 · 현원 기준 인원 · 부서를 누르면 대장으로, 로그인하면 명칭을 고칠 수 있습니다</p>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>조직 트리</h3>
          <span className="unit">
            계열사 {tree.length} · 부서 {activeDepts}
            {depts.length - activeDepts > 0 && ` (+폐지 ${depts.length - activeDepts})`} · 현원 {total}명
          </span>
        </div>

        {error && <div className="callout error">{error}</div>}

        {tree.length === 0 ? (
          <div className="t-empty">부서 마스터가 비어 있습니다.</div>
        ) : (
          <ul className="org-tree" role="tree">
            {tree.map((c) => {
              const open = !collapsed.has(c.company);
              return (
                <li key={c.company} role="treeitem" aria-expanded={open}>
                  <div className="org-node org-company">
                    <button type="button" className="sec-toggle" aria-expanded={open} onClick={() => toggle(c.company)}>
                      <svg className="caret" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M5.5 1.5 L12.5 8 L5.5 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <h3>{c.company}</h3>
                    </button>
                    <span className="org-count">{c.count}명 · 부서 {c.depts.filter((d) => d.active).length}</span>
                  </div>
                  {open && (
                    <ul role="group">
                      {c.depts.map((d) => (
                        <li key={d.code} role="treeitem" className={d.active ? "org-dept" : "org-dept inactive"}>
                          <div className="org-node">
                            <span className="org-line" aria-hidden="true" />
                            {editing === d.code ? (
                              <form
                                className="org-edit"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  rename(d);
                                }}
                              >
                                <input
                                  className="input"
                                  value={draft}
                                  autoFocus
                                  onChange={(e) => setDraft(e.target.value)}
                                  onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                                  aria-label="부서명"
                                />
                                <button type="submit" className="btn primary" disabled={busy}>
                                  {busy ? "저장 중…" : "저장"}
                                </button>
                                <button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>
                                  취소
                                </button>
                              </form>
                            ) : (
                              <>
                                <button type="button" className="org-name" onClick={() => onOpenDept(d.name)}>
                                  {d.name}
                                  {!d.active && <span className="chip pend">폐지</span>}
                                </button>
                                <span className="org-code">{d.code}</span>
                                <span className="org-bar" aria-hidden="true">
                                  <span className="fill" style={{ width: `${total ? (d.count / total) * 100 * 3 : 0}%` }} />
                                </span>
                                <span className="org-count">{d.count}명</span>
                                {canEdit && (
                                  <button type="button" className="link-btn" onClick={() => startEdit(d)} disabled={busy}>
                                    명칭 수정
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="callout">
          부서 명칭을 바꾸면 <b>그 부서 소속 직원의 부서명이 함께 바뀝니다</b>(부서 마스터 FK). 과거
          발령이력의 문구는 당시 명칭 그대로 남습니다. 사업부 계층·계열사 명칭 수정은 부서 마스터에
          계층 컬럼이 생긴 뒤 붙입니다.
        </div>
      </section>
    </div>
  );
}
