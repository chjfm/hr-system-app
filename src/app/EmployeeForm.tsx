"use client";

import { useEffect, useState } from "react";
import {
  EMPLOYMENT_TYPES,
  HIRE_TYPES,
  STATUSES,
  today,
  type Department,
  type Employee,
  type EmployeeInput,
  type Status,
} from "@/lib/supabase";

type Props = {
  employee: Employee | null; // null이면 신규 등록
  departments: Department[];
  positions: string[];
  nextEmployeeNo: string;
  onSave: (input: EmployeeInput) => Promise<void>;
  onClose: () => void;
};

export default function EmployeeForm({
  employee,
  departments,
  positions,
  nextEmployeeNo,
  onSave,
  onClose,
}: Props) {
  const [form, setForm] = useState<EmployeeInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      const { id: _id, created_at: _created, ...rest } = employee;
      // 발령일자는 매 변경마다 새로 정한다 — 지난 값을 끌고 오면 조용히 틀린 날짜가 박힌다
      setForm({ ...rest, effective_date: today() });
    } else {
      setForm({
        employee_no: nextEmployeeNo,
        name_ko: "",
        name_en: null,
        status: "재직",
        // 소속은 부서가 결정한다 — 각각 따로 정하면 어긋난 상태로 폼이 열린다
        company: departments[0]?.company ?? "",
        department: departments[0]?.name ?? "",
        position: positions[0] ?? "",
        birth_date: null,
        hire_date: today(),
        resign_date: null,
        email: null,
        phone: null,
        hire_type: "신입",
        employment_type: "정규직",
        residence: null,
        effective_date: null,
      });
    }
  }, [employee, departments, positions, nextEmployeeNo]);

  if (!form) return null;

  const set = (patch: Partial<EmployeeInput>) => setForm({ ...form, ...patch });

  /** 부서·직급·상태가 바뀌면 발령이력이 남는다 → 발령일자를 물어야 한다 */
  const willLogAppointment =
    !!employee &&
    (form.department !== employee.department ||
      form.position !== employee.position ||
      (form.status !== employee.status && form.status !== "퇴사"));


  /** R5·R6 — 상태와 퇴사일은 항상 함께 움직인다 */
  function setStatus(value: Status) {
    if (value === "퇴사") {
      set({ status: value, resign_date: form!.resign_date ?? "" });
    } else {
      set({ status: value, resign_date: null });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const f = form!;

    if (!f.employee_no.trim() || !f.name_ko.trim() || !f.department.trim() || !f.position.trim()) {
      setError("사번·한글성명·부서명·직급은 필수입니다.");
      return;
    }
    if (!f.hire_date) {
      setError("입사일은 필수입니다.");
      return;
    }
    // R6 — 퇴사 처리 시 퇴사일 필수 (미입력이면 저장 차단)
    if (f.status === "퇴사" && !f.resign_date) {
      setError("퇴사 처리에는 퇴사일이 반드시 필요합니다.");
      return;
    }
    if (f.resign_date && f.resign_date < f.hire_date) {
      setError("퇴사일은 입사일보다 빠를 수 없습니다.");
      return;
    }
    if (willLogAppointment && !f.effective_date) {
      setError("발령일자를 입력해야 이력이 정확한 날짜로 기록됩니다.");
      return;
    }
    if (f.effective_date && f.effective_date < f.hire_date) {
      setError("발령일자는 입사일보다 빠를 수 없습니다.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...f,
        employee_no: f.employee_no.trim(),
        name_ko: f.name_ko.trim(),
        name_en: f.name_en?.trim() || null,
        email: f.email?.trim() || null,
        phone: f.phone?.trim() || null,
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
          <h3>{employee ? `${employee.name_ko} 정보 수정` : "신규 입사자 등록"}</h3>
          <span className="unit">필수 · 사번 / 성명 / 부서 / 직급 / 입사일</span>
        </div>

        {/* 변경이 생겨 이력이 남게 되면 발령일자를 맨 위에서 먼저 묻는다 —
            아래에 두면 스크롤해야 보여서 그냥 오늘 날짜로 저장돼 버린다 */}
        {willLogAppointment && (
          <div className="card sub">
            <div className="card-head">
              <h3>발령일자</h3>
              <span className="unit">이 변경이 효력을 갖는 날 · 이력에 이 날짜로 기록됩니다</span>
            </div>
            <div className="eff-row">
              <input
                id="f-eff"
                type="date"
                className="input"
                value={form.effective_date ?? ""}
                min={form.hire_date || undefined}
                onChange={(e) => set({ effective_date: e.target.value || null })}
              />
              <span className="eff-hint">
                발령은 대개 오늘이 아닙니다 — <b>9월 1일자 발령을 미리 입력</b>하거나 지난 발령을
                소급 입력할 수 있습니다. 이 날짜가 근속·승진연한 산정의 근거가 됩니다.
              </span>
            </div>
          </div>
        )}

        <div className="formgrid">
          <div className="field">
            <label htmlFor="f-no">사번</label>
            <input
              id="f-no"
              className="input"
              value={form.employee_no}
              onChange={(e) => set({ employee_no: e.target.value })}
              disabled={!!employee}
            />
          </div>

          <div className="field">
            <label htmlFor="f-name">한글성명</label>
            <input
              id="f-name"
              className="input"
              value={form.name_ko}
              onChange={(e) => set({ name_ko: e.target.value })}
              placeholder="홍길동"
              autoFocus={!employee}
            />
          </div>

          <div className="field">
            <label htmlFor="f-nameen">영문성명</label>
            <input
              id="f-nameen"
              className="input"
              value={form.name_en ?? ""}
              onChange={(e) => set({ name_en: e.target.value })}
              placeholder="Gildong Hong"
            />
          </div>

          <div className="field">
            <label htmlFor="f-company">소속</label>
            {/* 부서가 소속을 결정한다 (부서는 한 소속에만 속한다) — 따로 고르게 두면 어긋난다 */}
            <input id="f-company" className="input" value={form.company} readOnly tabIndex={-1} />
            <span className="field-note">부서를 고르면 자동으로 정해집니다</span>
          </div>

          <div className="field">
            <label htmlFor="f-dept">부서명</label>
            {/* R13 — 자유 입력 폐지. 마스터에 있는 부서만 고를 수 있고 DB FK로도 강제된다 */}
            <select
              id="f-dept"
              className="input"
              value={form.department}
              onChange={(e) => {
                const picked = departments.find((d) => d.name === e.target.value);
                // 부서를 고르면 소속도 함께 맞춘다 — 부서는 한 소속에만 속한다
                set(picked ? { department: picked.name, company: picked.company } : { department: e.target.value });
              }}
            >
              {departments.map((d) => (
                <option key={d.code} value={d.name}>
                  {d.name}
                  {d.active ? "" : " (폐지)"}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-pos">직급</label>
            <input
              id="f-pos"
              className="input"
              list="dl-pos"
              value={form.position}
              onChange={(e) => set({ position: e.target.value })}
            />
            <datalist id="dl-pos">
              {positions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <label htmlFor="f-hiretype">채용구분</label>
            <select
              id="f-hiretype"
              className="input"
              value={form.hire_type ?? "신입"}
              onChange={(e) => set({ hire_type: e.target.value })}
            >
              {HIRE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-etype">고용형태</label>
            <select
              id="f-etype"
              className="input"
              value={form.employment_type}
              onChange={(e) => set({ employment_type: e.target.value })}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="f-birth">생년월일</label>
            <input
              id="f-birth"
              type="date"
              className="input"
              value={form.birth_date ?? ""}
              onChange={(e) => set({ birth_date: e.target.value || null })}
            />
          </div>

          <div className="field">
            <label htmlFor="f-hire">입사일</label>
            <input
              id="f-hire"
              type="date"
              className="input"
              value={form.hire_date}
              onChange={(e) => set({ hire_date: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="f-status">재직구분</label>
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
            <label htmlFor="f-resign">
              퇴사일{form.status === "퇴사" && <b style={{ color: "var(--accent)" }}> · 필수</b>}
            </label>
            <input
              id="f-resign"
              type="date"
              className="input"
              value={form.resign_date ?? ""}
              min={form.hire_date || undefined}
              disabled={form.status !== "퇴사"}
              onChange={(e) => set({ resign_date: e.target.value || "" })}
            />
          </div>

          <div className="field">
            <label htmlFor="f-email">메일계정</label>
            <input
              id="f-email"
              className="input"
              value={form.email ?? ""}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="gildong.hong@gaon.co.kr"
            />
          </div>

          <div className="field">
            <label htmlFor="f-res">거주지역</label>
            <input
              id="f-res"
              className="input"
              value={form.residence ?? ""}
              onChange={(e) => set({ residence: e.target.value })}
              placeholder="서울 성동구"
            />
            <span className="field-note">시·구 단위만 — 상세 주소는 저장하지 않습니다</span>
          </div>

          <div className="field">
            <label htmlFor="f-phone">휴대전화</label>
            <input
              id="f-phone"
              className="input"
              value={form.phone ?? ""}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="010-0000-0000"
            />
          </div>
        </div>

        <div className="callout">
          <b>재직구분을 &lsquo;퇴사&rsquo;로 바꾸면 퇴사일이 필수가 됩니다.</b> 부서·직급을 바꾸거나
          상태를 변경하면 발령이력이 자동으로 남습니다.
        </div>

        {error && (
          <div className="callout error">
            {error}
          </div>
        )}

        <div className="toolbar">
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
