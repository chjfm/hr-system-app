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

export type QuarterPoint = {
  label: string;
  inn: number;
  out: number;
  net: number;
  /** 12개월 창에 3개월이 다 들어오지 않은 분기 — 경영보고에서 온전한 분기와 섞이면 안 된다 */
  partial: boolean;
};

/**
 * 분기 병기 (R12).
 * 140명 규모는 월 변동이 0~3명이라 월 막대만으로는 추세가 안 읽힌다.
 *
 * 3개월씩 기계적으로 자르면 안 된다 — 12개월 창의 시작이 분기 경계와 어긋나면
 * 2025-12 가 "26년 1분기"에 들어가는 식으로 달력 분기와 틀어진다.
 * 반드시 연도·분기로 묶는다.
 */
export function quarterly(months: MonthPoint[]): QuarterPoint[] {
  const bucket = new Map<string, MonthPoint[]>();
  for (const m of months) {
    const year = m.month.slice(0, 4);
    const q = Math.floor((Number(m.month.slice(5)) - 1) / 3) + 1;
    const key = `${year}-${q}`;
    bucket.set(key, [...(bucket.get(key) ?? []), m]);
  }

  return [...bucket.entries()].map(([key, ms]) => {
    const [year, q] = key.split("-");
    return {
      label: `${year.slice(2)}년 ${q}분기`,
      inn: ms.reduce((s, c) => s + c.inn, 0),
      out: ms.reduce((s, c) => s + c.out, 0),
      net: ms.reduce((s, c) => s + c.net, 0),
      partial: ms.length < 3,
    };
  });
}
