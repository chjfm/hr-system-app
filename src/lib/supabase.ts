import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Supabase 접속 정보가 없습니다. NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 확인하세요.",
  );
}

export const supabase = createClient(url, key);

/** DB에 저장되는 재직구분 */
export const STATUSES = ["재직", "휴직", "퇴사"] as const;
export const HIRE_TYPES = ["신입", "경력"] as const;
/** 고용형태 5종 — 급여마스터 C열·항목사전 §4 확정안. 채용구분(hire_type)과 다른 축 */
export const EMPLOYMENT_TYPES = ["정규직", "별정직", "계약직", "인턴", "회장"] as const;

export type Status = (typeof STATUSES)[number];

/**
 * 화면에 보이는 재직구분.
 * '퇴사예정'은 저장하지 않고 퇴사일과 오늘을 비교해 매번 계산한다 —
 * 상태를 저장해두면 퇴사일이 도래해도 누군가 바꿔주기 전까지 틀린 값이 남는다.
 */
export const DISPLAY_STATUSES = ["재직", "휴직", "퇴사예정", "퇴사"] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

/** 발령이력 (R8) — 직원 1 : N */
export type Appointment = {
  id: string;
  employee_no: string;
  appointed_on: string;
  kind: "입사" | "승진" | "발령" | "휴직" | "복직" | "퇴사";
  detail: string;
  /** 이 발령을 입력한 계정. 시드 데이터는 null. */
  actor_email: string | null;
};

/** 직원 기본정보. 주민번호·병역·장애는 스키마에 없다 (R9). */
export type Employee = {
  id: string;
  employee_no: string;
  name_ko: string;
  name_en: string | null;
  status: Status;
  company: string;
  department: string;
  position: string;
  birth_date: string | null;
  hire_date: string;
  resign_date: string | null;
  email: string | null;
  phone: string | null;
  hire_type: string | null;
  employment_type: string;
  effective_date: string | null;
  /** R18 — 시·구 단위만. 상세 주소는 저장하지 않는다 (R9) */
  residence: string | null;
  /** 260901 이슈 보드 입력 3건 — 계약종료일(계약직·인턴) · 복직예정일(휴직) · 비상연락망 */
  contract_end_date: string | null;
  return_date: string | null;
  emergency_contact: string | null;
  created_at: string;
};

export type EmployeeInput = Omit<Employee, "id" | "created_at">;

/** 성과 이력 (R17) — 사실 기록만. 평가 등급·점수는 두지 않는다 */
export type Performance = {
  id: string;
  employee_no: string;
  project: string;
  role: string;
  started_on: string;
  ended_on: string | null;
  contribution: string | null;
};

/** 부서 마스터 (R13) — 부서명은 여기 있는 값만 쓸 수 있다 (DB FK로도 강제) */
export type Department = {
  code: string;
  name: string;
  company: string;
  sort_order: number;
  active: boolean;
};

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 퇴사일이 아직 오지 않았으면 '퇴사예정' — 이 사람은 지금도 출근한다.
 * 퇴사와 퇴사예정은 인수인계·연차정산·4대보험 상실신고 일정이 전부 다르다.
 */
export function displayStatus(e: Employee, ref = today()): DisplayStatus {
  if (e.status === "퇴사" && e.resign_date && e.resign_date > ref) return "퇴사예정";
  return e.status;
}

/** 현원 = 지금 이 회사에 소속된 사람. 퇴사예정자는 아직 소속이다. */
export function isOnBoard(e: Employee, ref = today()): boolean {
  return displayStatus(e, ref) !== "퇴사";
}

/** 근속연수 — 퇴사자는 퇴사일까지, 재직자는 오늘까지 */
export function tenureYears(e: Employee, ref = today()): number {
  const from = new Date(e.hire_date);
  const to = new Date(e.status === "퇴사" && e.resign_date ? e.resign_date : ref);
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

export function formatTenure(years: number): string {
  const y = Math.floor(years);
  const m = Math.round((years - y) * 12);
  if (m === 12) return `${y + 1}년`;
  return m === 0 ? `${y}년` : `${y}년 ${m}개월`;
}

/** 목록 필터 선택지는 실제 데이터에서 뽑는다 — 하드코딩하면 데이터와 어긋난다 */
export function distinct<K extends keyof Employee>(rows: Employee[], key: K): string[] {
  return [...new Set(rows.map((r) => String(r[key])).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}
