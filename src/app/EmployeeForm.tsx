"use client";

import { useEffect, useState } from "react";
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  STATUSES,
  type Employee,
  type EmployeeInput,
  type Status,
} from "@/lib/supabase";

const EMPTY: EmployeeInput = {
  name: "",
  department: DEPARTMENTS[0],
  position: "",
  hire_date: "",
  employment_type: EMPLOYMENT_TYPES[0],
  status: "재직",
  resign_date: null,
  memo: null,
};

type Props = {
  employee: Employee | null; // null이면 신규 등록
  onSave: (input: EmployeeInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
};

export default function EmployeeForm({ employee, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<EmployeeInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      const { id: _id, created_at: _created, ...rest } = employee;
      setForm(rest);
    } else {
      setForm(EMPTY);
    }
  }, [employee]);

  /** 퇴사일을 넣으면 상태가 '퇴사'로 넘어가고, 상태를 되돌리면 퇴사일이 비워진다 */
  function setResignDate(value: string) {
    if (value) {
      setForm((f) => ({ ...f, resign_date: value, status: "퇴사" }));
    } else {
      setForm((f) => ({ ...f, resign_date: null, status: f.status === "퇴사" ? "재직" : f.status }));
    }
  }

  function setStatus(value: Status) {
    if (value === "퇴사") {
      setForm((f) => ({
        ...f,
        status: value,
        resign_date: f.resign_date ?? new Date().toISOString().slice(0, 10),
      }));
    } else {
      setForm((f) => ({ ...f, status: value, resign_date: null }));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.position.trim() || !form.hire_date) {
      setError("이름·직급·입사일은 필수입니다.");
      return;
    }
    if (form.resign_date && form.resign_date < form.hire_date) {
      setError("퇴사일은 입사일보다 빠를 수 없습니다.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        position: form.position.trim(),
        memo: form.memo?.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setSaving(false);
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="card-head">
          <h3>{employee ? "직원 정보 수정" : "신규 입사자 등록"}</h3>
          <span className="unit">필수 항목 · 이름 / 직급 / 입사일</span>
        </div>

        <div className="formgrid">
          <div className="field">
            <label htmlFor="f-name">이름</label>
            <input
              id="f-name"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="f-dept">부서</label>
            <select
              id="f-dept"
              className="input"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-pos">직급</label>
            <input
              id="f-pos"
              className="input"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="사원 / 대리 / 팀장"
            />
          </div>

          <div className="field">
            <label htmlFor="f-type">고용형태</label>
            <select
              id="f-type"
              className="input"
              value={form.employment_type}
              onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-hire">입사일</label>
            <input
              id="f-hire"
              type="date"
              className="input"
              value={form.hire_date}
              onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="f-status">상태</label>
            <select
              id="f-status"
              className="input"
              value={form.status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-resign">퇴사일</label>
            <input
              id="f-resign"
              type="date"
              className="input"
              value={form.resign_date ?? ""}
              min={form.hire_date || undefined}
              onChange={(e) => setResignDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="f-memo">메모</label>
            <input
              id="f-memo"
              className="input"
              value={form.memo ?? ""}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="선택 입력"
            />
          </div>
        </div>

        <div className="callout">
          <b>퇴사일을 입력하면 상태가 자동으로 &lsquo;퇴사&rsquo;로 바뀝니다.</b> 반대로 상태를
          재직·휴직으로 되돌리면 퇴사일이 지워집니다.
        </div>

        {error && (
          <div className="callout" style={{ borderLeftColor: "var(--bad)", color: "var(--bad)" }}>
            {error}
          </div>
        )}

        <div className="toolbar">
          {employee && onDelete && (
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onDelete();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
                  setSaving(false);
                }
              }}
            >
              삭제
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
