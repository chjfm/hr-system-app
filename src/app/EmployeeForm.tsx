"use client";

import { useEffect, useState } from "react";
import {
  HIRE_TYPES,
  STATUSES,
  today,
  type Employee,
  type EmployeeInput,
  type Status,
} from "@/lib/supabase";

type Props = {
  employee: Employee | null; // null이면 신규 등록
  companies: string[];
  departments: string[];
  positions: string[];
  nextEmployeeNo: string;
  onSave: (input: EmployeeInput) => Promise<void>;
  onClose: () => void;
};

export default function EmployeeForm({
  employee,
  companies,
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
        company: companies[0] ?? "본사",
        department: departments[0] ?? "",
        position: positions[0] ?? "",
        birth_date: null,
        hire_date: today(),
        resign_date: null,
        email: null,
        phone: null,
        hire_type: "신입",
        effective_date: null,
      });
    }
  }, [employee, companies, departments, positions, nextEmployeeNo]);

  if (!form) return null;

  const set = (patch: Partial<EmployeeInput>) => setForm({ ...form, ...patch });

  /** 부서·직급·상태가 바뀌면 발령이력이 남는다 → 발령일자를 물어야 한다 */
  const willLogAppointment =
    !!employee &&
    (form.department !== employee.department ||
      form.position !== employee.position ||
      (form.status !== employee.status && form.status !== "퇴사"));

  // 조직 마스터 없이 오타만 막는 절충안 — 기존에 없던 값이면 경고
  const newDepartment =
    form.department.trim() && !departments.includes(form.department.trim())
      ? form.department.trim()
      : null;

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
            <input
              id="f-company"
              className="input"
              list="dl-company"
              value={form.company}
              onChange={(e) => set({ company: e.target.value })}
            />
            <datalist id="dl-company">
              {companies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <label htmlFor="f-dept">부서명</label>
            <input
              id="f-dept"
              className="input"
              list="dl-dept"
              value={form.department}
              onChange={(e) => set({ department: e.target.value })}
            />
            <datalist id="dl-dept">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
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

        {willLogAppointment && (
          <div className="card sub">
            <div className="card-head">
              <h3>발령일자</h3>
              <span className="unit">이 변경이 효력을 갖는 날 · 이력에 이 날짜로 기록됩니다</span>
            </div>
            <div className="formgrid">
              <div className="field">
                <label htmlFor="f-eff">발령일자</label>
                <input
                  id="f-eff"
                  type="date"
                  className="input"
                  value={form.effective_date ?? ""}
                  min={form.hire_date || undefined}
                  onChange={(e) => set({ effective_date: e.target.value || null })}
                />
              </div>
            </div>
            <div className="callout">
              발령은 대개 오늘이 아닙니다 — <b>9월 1일자 발령을 오늘 미리 입력</b>하거나
              지난 발령을 소급 입력할 수 있습니다. 이 날짜가 근속·승진연한 산정의 근거가 됩니다.
            </div>
          </div>
        )}

        {newDepartment && (
          <div className="callout warn">
            <b>&lsquo;{newDepartment}&rsquo;은(는) 기존에 없던 부서입니다.</b> 새 부서를 만드는 게
            맞다면 그대로 저장하시고, 오타라면 아래 기존 부서에서 고르세요 —{" "}
            {departments.join(" · ")}
          </div>
        )}

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
