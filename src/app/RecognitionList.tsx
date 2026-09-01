"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, today } from "@/lib/supabase";
import {
  RECOGNITION_KINDS,
  type Recognition,
  type RecognitionInput,
  type RecognitionKind,
} from "@/lib/growth";

const KIND_CHIP: Record<RecognitionKind, string> = {
  "사내 수상": "chip acc",
  "대외 수상": "chip acc",
  "대외 활동": "chip",
  "클라이언트 인정": "chip ok",
  "리더 인정": "chip ok",
};

function blank(employee_no: string): RecognitionInput {
  return { employee_no, awarded_on: today(), kind: "리더 인정", title: "", project: null };
}

/**
 * 인정 이력 (B2) — 성장카드의 축. "한 일이 보였다는 증거"만 쌓는다.
 * 점수·등급·가산점은 두지 않는다 (260823 등급 표시 금지 · 가산 규칙은 평가제도 설계 시).
 */
export default function RecognitionList({
  employeeNo,
  canEdit,
  onCount,
}: {
  employeeNo: string;
  canEdit: boolean;
  /** 상위(성장 요약)에 건수를 알린다 */
  onCount?: (n: number) => void;
}) {
  const [rows, setRows] = useState<Recognition[] | null>(null);
  const [form, setForm] = useState<RecognitionInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("recognitions")
      .select("*")
      .eq("employee_no", employeeNo)
      .order("awarded_on", { ascending: false });
    if (err) setError(err.message);
    const list = (data as Recognition[]) ?? [];
    setRows(list);
    onCount?.(list.length);
  }, [employeeNo, onCount]);

  useEffect(() => {
    // 탭이 열릴 때 한 번 적재 — setState는 응답 뒤
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function startNew() {
    setEditingId(null);
    setForm(blank(employeeNo));
    setError(null);
  }

  function startEdit(r: Recognition) {
    setEditingId(r.id);
    setForm({ employee_no: employeeNo, awarded_on: r.awarded_on, kind: r.kind, title: r.title, project: r.project });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.awarded_on || !form.title.trim()) {
      setError("일자와 제목은 필수입니다.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = { ...form, title: form.title.trim(), project: form.project?.trim() || null };
    const { error: err } = editingId
      ? await supabase.from("recognitions").update(payload).eq("id", editingId)
      : await supabase.from("recognitions").insert(payload);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setForm(null);
    setEditingId(null);
    await load();
  }

  async function remove(r: Recognition) {
    if (!window.confirm(`'${r.title}' 인정 이력을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    const { error: err } = await supabase.from("recognitions").delete().eq("id", r.id);
    setBusy(false);
    if (err) setError(err.message);
    else await load();
  }

  return (
    <>
      <div className="card-head" style={{ marginTop: 4 }}>
        <h3>인정 이력 ({rows?.length ?? "…"})</h3>
        <span className="unit">수상 · 대외 활동 · 클라이언트/리더 인정 · 최신순</span>
        {canEdit && !form && (
          <span className="head-meta">
            <button type="button" className="btn" onClick={startNew}>
              + 인정 이력 추가
            </button>
          </span>
        )}
      </div>

      {form && (
        <form className="card sub growth-form" onSubmit={save}>
          <div className="card-head">
            <h3>{editingId ? "인정 이력 수정" : "인정 이력 추가"}</h3>
            <span className="unit">필수 · 일자 / 제목</span>
          </div>
          <div className="formgrid">
            <div className="field">
              <label htmlFor="rc-date">일자</label>
              <input
                id="rc-date"
                type="date"
                className="input"
                value={form.awarded_on}
                onChange={(e) => setForm({ ...form, awarded_on: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="rc-kind">유형</label>
              <select
                id="rc-kind"
                className="input"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as RecognitionKind })}
              >
                {RECOGNITION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="rc-title">제목</label>
            <input
              id="rc-title"
              className="input"
              value={form.title}
              placeholder="하반기 우수사원상"
              autoFocus
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="rc-project">관련 프로젝트</label>
            <input
              id="rc-project"
              className="input"
              value={form.project ?? ""}
              placeholder="신제품 론칭 캠페인"
              onChange={(e) => setForm({ ...form, project: e.target.value })}
            />
          </div>
          {error && <div className="callout error">{error}</div>}
          <div className="toolbar">
            <span className="grow" />
            <button type="button" className="btn" disabled={busy} onClick={() => { setForm(null); setEditingId(null); setError(null); }}>
              취소
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      )}

      {!form && error && <div className="callout error">{error}</div>}

      {rows === null ? (
        <div className="t-empty">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="t-empty">
          기록된 인정 이력이 없습니다.
          {canEdit ? " 수상·대외 활동·클라이언트 인정을 남기세요." : ""}
        </div>
      ) : (
        <ol className="rec-list">
          {rows.map((r) => (
            <li key={r.id} className={editingId === r.id ? "rec editing" : "rec"}>
              <div className="rec-head">
                <span className="rec-date">{r.awarded_on}</span>
                <span className={KIND_CHIP[r.kind]}>{r.kind}</span>
                <span className="rec-title">{r.title}</span>
                {canEdit && (
                  <span className="rec-actions">
                    <button type="button" className="link-btn" onClick={() => startEdit(r)} disabled={busy}>
                      수정
                    </button>
                    <button type="button" className="link-btn danger" onClick={() => remove(r)} disabled={busy}>
                      삭제
                    </button>
                  </span>
                )}
              </div>
              <div className="rec-sub">
                {r.project ? `프로젝트 · ${r.project}` : "프로젝트 –"}
                {r.registered_by && ` · 등록 ${r.registered_by}`}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
