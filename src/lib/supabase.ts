import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Supabase 접속 정보가 없습니다. NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 확인하세요.",
  );
}

export const supabase = createClient(url, key);

export const DEPARTMENTS = [
  "경영지원팀",
  "인사팀",
  "기획팀",
  "개발팀",
  "디자인팀",
] as const;

export const EMPLOYMENT_TYPES = ["정규직", "계약직", "인턴", "파견"] as const;

export const STATUSES = ["재직", "휴직", "퇴사"] as const;

export type Status = (typeof STATUSES)[number];

export type Employee = {
  id: string;
  name: string;
  department: string;
  position: string;
  hire_date: string;
  employment_type: string;
  status: Status;
  resign_date: string | null;
  memo: string | null;
  created_at: string;
};

/** 등록·수정 폼이 다루는 필드 (id·created_at 제외) */
export type EmployeeInput = Omit<Employee, "id" | "created_at">;
