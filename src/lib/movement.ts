import { today, type Employee } from "./supabase";
import type { MonthPoint } from "@/app/MovementChart";

/** 오늘부터 거슬러 올라간 12개월의 YYYY-MM 목록 (오래된 달 → 최근 달) */
function last12Months(ref: string): string[] {
  const [y, m] = ref.split("-").map(Number);
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/**
 * 월별 입·퇴사와 순증.
 *
 * 퇴사일이 아직 오지 않은 사람은 나간 것으로 세지 않는다 — 퇴사예정자는 현원이다.
 */
export function monthlyMovement(rows: Employee[], ref = today()): MonthPoint[] {
  const t = ref;
  return last12Months(ref.slice(0, 7)).map((month) => {
    const inn = rows.filter((r) => r.hire_date.startsWith(month)).length;
    const out = rows.filter((r) => r.resign_date?.startsWith(month) && r.resign_date <= t).length;
    return { month, inn, out, net: inn - out };
  });
}

export type QuarterPoint = { label: string; inn: number; out: number; net: number };

/**
 * 분기 병기 (R12).
 * 140명 규모는 월 변동이 0~3명이라 월 막대만으로는 추세가 안 읽힌다.
 */
export function quarterly(months: MonthPoint[]): QuarterPoint[] {
  const out: QuarterPoint[] = [];
  for (let i = 0; i < months.length; i += 3) {
    const chunk = months.slice(i, i + 3);
    if (chunk.length === 0) continue;
    const last = chunk[chunk.length - 1].month;
    const q = Math.floor((Number(last.slice(5)) - 1) / 3) + 1;
    out.push({
      label: `${last.slice(2, 4)}년 ${q}분기`,
      inn: chunk.reduce((s, c) => s + c.inn, 0),
      out: chunk.reduce((s, c) => s + c.out, 0),
      net: chunk.reduce((s, c) => s + c.net, 0),
    });
  }
  return out;
}
