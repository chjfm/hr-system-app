import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Supabase 접속 정보가 없습니다. NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 확인하세요.",
  );
}

export const supabase = createClient(url, key);

export const STATUSES = ["재직", "휴직", "퇴사"] as const;
export const HIRE_TYPES = ["신입", "경력"] as const;

export type Status = (typeof STATUSES)[number];

/** 발령이력 (R8) — 직원 1 : N */
export type Appointment = {
  id: string;
  employee_no: string;
  appointed_on: string;
  kind: "입사" | "승진" | "발령" | "휴직" | "복직" | "퇴사";
  detail: string;
};

/** 직원 기본정보 13항목 (R2). 주민번호·병역·장애는 스키마에 없다 (R9). */
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
  created_at: string;
};

export type EmployeeInput = Omit<Employee, "id" | "created_at">;

/** 목록 필터에 쓸 선택지는 실제 데이터에서 뽑는다 — 하드코딩하면 데이터와 어긋난다 */
export function distinct<K extends keyof Employee>(rows: Employee[], key: K): string[] {
  return [...new Set(rows.map((r) => String(r[key])).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}
