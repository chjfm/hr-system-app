"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, today, type Employee } from "@/lib/supabase";
import {
  INTERVIEW_KINDS,
  type Interview,
  type InterviewInput,
  type InterviewKind,
} from "@/lib/growth";
import RecognitionList from "./RecognitionList";

const KIND_CHIP: Record<InterviewKind, string> = {
  "100일": "chip acc",
  "1년": "chip acc",
  수습: "chip plan",
  정기: "chip",
  퇴사: "chip no",
  수시: "chip",
};

function blankInterview(employee_no: string): InterviewInput {
  return { employee_no, held_on: today(), kind: "정기", interviewer: "", memo: null, next_on: null };
}

/**
 * 인사카드 '성장' 탭 (260901 B1·B2) — 성장카드 설계 260901: 인정 = 축, 면담 = 부가층.
 * 성장카드 독립 화면은 목업 정본으로 두고 2호에서 — 여기는 기록이 쌓이는 자리다.
 */
export default function GrowthTab({ employee, canEdit }: { employee: Employee; canEdit: boolean }) {
  const no = employee.employee_no;

  const [interviews, setInterviews] = useState<Interview[] | null>(null);
  const [form, setForm] = useState<InterviewInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognitionCount, setRecognitionCount] = useState<number | null>(null);

  const loadInterviews = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("interviews")
      .select("*")
      .eq("employee_no", no)
      .order("held_on", { ascending: false });
    if (err) setError(err.message);
    setInterviews((data as Interview[]) ?? []);
  }, [no]);

  useEffect(() => {
    // 탭이 열릴 때 한 번 적재 — setState는 응답 뒤
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInterviews();
  }, [loadInterviews]);

  const last = interviews?.[0] ?? null;
  const nextPlanned = interviews
    ?.map((i) => i.next_on)
    .filter((d): d is string => !!d && d >= today())
    .sort()[0];

  function startNew() {
    setEditingId(null);
    setForm(blankInterview(no));
    setError(null);
  }

  function startEdit(i: Interview) {
    setEditingId(i.id);
    setForm({ employee_no: no, held_on: i.held_on, kind: i.kind, interviewer: i.interviewer, memo: i.memo, next_on: i.next_on });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.held_on || !form.interviewer.trim()) {
      setError("면담 일자와 면담자는 필수입니다.");
      return;
    }
    if (form.next_on && form.next_on < form.held_on) {
      setError("다음 면담 예정일은 면담 일자보다 빠를 수 없습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      ...form,
      interviewer: form.interviewer.trim(),
      memo: form.memo?.trim() || null,
      next_on: form.next_on || null,
    };
    const { error: err } = editingId
      ? await supabase.from("interviews").update(payload).eq("id", editingId)
      : await supabase.from("interviews").insert(payload);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setForm(null);
    setEditingId(null);
    await loadInterviews();
  }

  async function remove(i: Interview) {
    if (!window.confirm(`${i.held_on} ${i.kind} 면담 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    const { error: err } = await supabase.from("interviews").delete().eq("id", i.id);
    setBusy(false);
    if (err) setError(err.message);
    else await loadInterviews();
  }

  return (
    <>
      {/* 성장 요약 — 목업 프레임 2의 KPI 4칸 중 1차에 값이 있는 것만(인정 · 면담). 궤적·목표는 2·3차 */}
      <div className="etype-row growth-kpis">
        <div className="etype">
          <span className="k">인정</span>
          <span className="v">{recognitionCount ?? "…"}</span>
          <span className="k">건</span>
        </div>
        <div className="etype">
          <span className="k">최근 면담</span>
          <span className="v small">{last ? last.held_on : "–"}</span>
        </div>
        <div className="etype">
          <span className="k">다음 면담</span>
          <span className="v small">{nextPlanned ?? "–"}</span>
        </div>
      </div>

      {/* 축 — 인정 이력 (성장카드 설계 260901) */}
      <RecognitionList employeeNo={no} canEdit={canEdit} onCount={setRecognitionCount} />

      {/* 부가층 — 면담 기록. 인사팀이 잊지 않기 위한 관리 항목 */}
      <div className="card-head" style={{ marginTop: 4 }}>
        <h3>면담 기록 ({interviews?.length ?? "…"})</h3>
        <span className="unit">
          {last ? `최근 ${last.held_on} · ${last.kind}` : "기록 없음"}
          {nextPlanned && ` · 다음 예정 ${nextPlanned}`}
        </span>
        {canEdit && !form && (
          <span className="head-meta">
            <button type="button" className="btn" onClick={startNew}>
              + 면담 기록 추가
            </button>
          </span>
        )}
      </div>

      {form && (
        <form className="card sub growth-form" onSubmit={save}>
          <div className="card-head">
            <h3>{editingId ? "면담 기록 수정" : "면담 기록 추가"}</h3>
            <span className="unit">필수 · 일자 / 면담자</span>
          </div>
          <div className="formgrid">
            <div className="field">
              <label htmlFor="iv-date">면담 일자</label>
              <input
                id="iv-date"
                type="date"
                className="input"
                value={form.held_on}
                onChange={(e) => setForm({ ...form, held_on: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="iv-kind">유형</label>
              <select
                id="iv-kind"
                className="input"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as InterviewKind })}
              >
                {INTERVIEW_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="iv-who">면담자</label>
              <input
                id="iv-who"
                className="input"
                value={form.interviewer}
                placeholder="김민준 팀장"
                autoFocus
                onChange={(e) => setForm({ ...form, interviewer: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="iv-next">다음 면담 예정일</label>
              <input
                id="iv-next"
                type="date"
                className="input"
                value={form.next_on ?? ""}
                min={form.held_on || undefined}
                onChange={(e) => setForm({ ...form, next_on: e.target.value || null })}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="iv-memo">메모</label>
            <textarea
              id="iv-memo"
              className="input textarea"
              rows={3}
              value={form.memo ?? ""}
              placeholder="면담 내용 · 합의 사항 · 후속 조치"
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
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

      {interviews === null ? (
        <div className="t-empty">불러오는 중…</div>
      ) : interviews.length === 0 ? (
        <div className="t-empty">
          기록된 면담이 없습니다.
          {canEdit ? " 위 버튼으로 첫 기록을 남기세요." : " 로그인하면 기록할 수 있습니다."}
        </div>
      ) : (
        <ol className="rec-list">
          {interviews.map((i) => (
            <li key={i.id} className={editingId === i.id ? "rec editing" : "rec"}>
              <div className="rec-head">
                <span className="rec-date">{i.held_on}</span>
                <span className={KIND_CHIP[i.kind]}>{i.kind}</span>
                <span className="rec-who">{i.interviewer}</span>
                {i.next_on && <span className="rec-next">다음 {i.next_on}</span>}
                {canEdit && (
                  <span className="rec-actions">
                    <button type="button" className="link-btn" onClick={() => startEdit(i)} disabled={busy}>
                      수정
                    </button>
                    <button type="button" className="link-btn danger" onClick={() => remove(i)} disabled={busy}>
                      삭제
                    </button>
                  </span>
                )}
              </div>
              {i.memo && <div className="rec-memo">{i.memo}</div>}
            </li>
          ))}
        </ol>
      )}

      <div className="callout">
        면담은 <b>인사팀이 잊지 않기 위한 관리 항목</b>입니다 — 100일·1년·수습·정기 면담의 대상 대비
        이행률은 현황 탭에서 집계합니다. 알림 발송·퇴사면담 양식은 2차입니다.
      </div>
    </>
  );
}
