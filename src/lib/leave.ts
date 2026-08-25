import { today, type Employee } from "./supabase";

/** 연차 사용·조정 기록 — 발생은 산식 계산이라 저장하지 않는다 */
export type Leave = {
  id: string;
  employee_no: string;
  kind: "사용" | "조정";
  days: number;
  used_on: string;
  note: string | null;
};

/** 만 개월 수 — 같은 날짜가 도래해야 1개월로 친다 */
function fullMonths(from: Date, to: Date): number {
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * 발생 연차 — 근로기준법 기본 산식 (제60조), 입사일 기준.
 *   · 1년 미만: 개근 가정, 만 1개월마다 1일 (최대 11일)
 *   · 1년 이상: 15일 + 3년차부터 2년마다 1일 가산, 상한 25일
 *
 * 가정이다 — 회계연도 기준·이월 규정은 인사팀 인터뷰에서 확정 후 조정한다.
 */
export function accruedLeave(e: Employee, ref = today()): number {
  const hire = new Date(e.hire_date);
  const base = new Date(e.status === "퇴사" && e.resign_date ? e.resign_date : ref);
  const months = fullMonths(hire, base);
  if (months < 12) return Math.min(11, months);
  const years = Math.floor(months / 12);
  return Math.min(25, 15 + Math.floor((years - 1) / 2));
}

/** 사용 합계(사용 − 조정 가산). numeric 이 문자열로 오는 드라이버 편차를 Number 로 흡수 */
export function usedLeave(rows: Leave[]): number {
  return rows.reduce((s, r) => s + (r.kind === "사용" ? Number(r.days) : -Number(r.days)), 0);
}
