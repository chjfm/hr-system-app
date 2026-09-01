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
  /** B4 중복 검증의 비교 대상 — 전체 직원 */
  rows: Employee[];
  departments: Department[];
  positions: string[];
  nextEmployeeNo: string;
  onSave: (input: EmployeeInput) => Promise<void>;
  onClose: () => void;
};

type Dup = { field: string; value: string; who: Employee[] };

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function findDuplicates(f: EmployeeInput, rows: Employee[], selfId: string | null): Dup[] {
  const others = rows.filter((r) => r.id !== selfId);
  const out: Dup[] = [];
  const no = f.employee_no.trim();
  if (!selfId && no) {
    const who = others.filter((r) => r.employee_no === no);
    if (who.length) out.push({ field: "사번", value: no, who });
  }
  const email = (f.email ?? "").trim().toLowerCase();
  if (email) {
    const who = others.filter((r) => (r.email ?? "").toLowerCase() === email);
    if (who.length) out.push({ field: "메일계정", value: email, who });
  }
  const phone = digits(f.phone);
  if (phone.length >= 9) {
    const who = others.filter((r) => digits(r.phone) === phone);
    if (who.length) out.push({ field: "휴대전화", value: f.phone!.trim(), who });
    // 본인 번호를 비상연락망에 적는 실수
    if (digits(f.emergency_contact) === phone) out.push({ field: "비상연락망", value: "본인 휴대전화와 동일", who: [] });
  }
  return out;
}

export default function EmployeeForm({
  employee,
  rows,
  departments,
  positions,
  nextEmployeeNo,
  onSave,
  onClose,
}: Props) {
  const [form, setForm] = useState<EmployeeInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // B4 — 중복이 있어도 막지는 않는다(가족 번호 공유 등 정당한 경우). 확인했다는 표시를 받고 저장한다
  const [ackDup, setAckDup] = useState(false);

  useEffect(() => {
    // 폼 초기값은 열릴 때 한 번 props에서 만든다 — 대상(employee)이 바뀌면 다시 만든다
    if (employee) {
      const { id, created_at, ...rest } = employee;
      void id;
      void created_at;
      // 발령일자는 매 변경마다 새로 정한다 — 지난 값을 끌고 오면 조용히 틀린 날짜가 박힌다
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        contract_end_date: null,
        return_date: null,
        emergency_contact: null,
      });
    }
  }, [employee, departments, positions, nextEmployeeNo]);

  if (!form) return null;

  const set = (patch: Partial<EmployeeInput>) => setForm({ ...form, ...patch });

  // B4 — 수기 입력 중복 검증: 사번(신규만) · 이메일 · 휴대전화 · 비상연락망 번호.
  // 주민번호는 스키마에 없어(R9) 비교 대상이 없다 — 해시 컬럼 도입 전까지 보류.
  const dups = findDuplicates(form, rows, employee?.id ?? null);

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
    if (f.contract_end_date && f.contract_end_date < f.hire_date) {
      setError("계약종료일은 입사일보다 빠를 수 없습니다.");
      return;
    }
    // B4 — 사번 중복은 저장 불가(DB unique). 그 외 중복은 확인 표시가 있어야 저장
    if (dups.some((d) => d.field === "사번")) {
      setError("이미 있는 사번입니다. 다른 사번을 입력하세요.");
      return;
    }
    if (dups.length > 0 && !ackDup) {
      setError("중복 항목이 있습니다. 아래에서 확인 표시 후 저장하세요.");
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
        emergency_contact: f.emergency_contact?.trim() || null,
        // 복직예정일은 휴직 상태에서만 의미가 있다
        return_date: f.status === "휴직" ? f.return_date || null : null,
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

          {/* 260901 — 이슈 보드 입력 3건 (B5 비상연락망 · A1 계약종료일·복직예정일) */}
          <div className="field">
            <label htmlFor="f-emg">
              비상연락망
              {!form.emergency_contact?.trim() && <span className="chip warn" style={{ marginLeft: 6 }}>미기재</span>}
            </label>
            <input
              id="f-emg"
              className="input"
              value={form.emergency_contact ?? ""}
              onChange={(e) => set({ emergency_contact: e.target.value })}
              placeholder="배우자 · 010-0000-0000"
            />
            <span className="field-note">관계 · 번호 한 줄. 비어 있으면 현황 이슈 보드에 오릅니다</span>
          </div>

          <div className="field">
            <label htmlFor="f-cend">계약종료일</label>
            <input
              id="f-cend"
              type="date"
              className="input"
              value={form.contract_end_date ?? ""}
              min={form.hire_date || undefined}
              onChange={(e) => set({ contract_end_date: e.target.value || null })}
            />
            <span className="field-note">계약직·인턴 — 만료 15일·3일 전 이슈 보드 강조</span>
          </div>

          <div className="field">
            <label htmlFor="f-ret">복직예정일</label>
            <input
              id="f-ret"
              type="date"
              className="input"
              value={form.return_date ?? ""}
              disabled={form.status !== "휴직"}
              onChange={(e) => set({ return_date: e.target.value || null })}
            />
            <span className="field-note">휴직 상태에서만 입력</span>
          </div>
        </div>

        {/* B4 — 저장 전 경고. 어떤 값이 누구와 겹치는지까지 보여야 판단이 된다 */}
        {dups.length > 0 && (
          <div className="callout warn dup-callout">
            <b>중복 항목 {dups.length}건</b>
            <ul className="dup-list">
              {dups.map((d) => (
                <li key={d.field + d.value}>
                  <b>{d.field}</b> {d.value}
                  {d.who.length > 0 && (
                    <> — {d.who.map((w) => `${w.name_ko}(${w.employee_no})`).join(", ")}와 동일</>
                  )}
                </li>
              ))}
            </ul>
            {!dups.some((d) => d.field === "사번") && (
              <label className="dup-ack">
                <input type="checkbox" checked={ackDup} onChange={(e) => setAckDup(e.target.checked)} />
                확인했습니다 — 중복을 인지하고 그대로 저장
              </label>
            )}
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
