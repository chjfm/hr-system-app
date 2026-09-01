/** 날짜 산술 — ISO(YYYY-MM-DD) 문자열끼리. 시간대 오차를 피하려고 UTC 정오 기준으로 계산한다 */

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** 월 가산 — 말일 넘침은 해당 월 말일로 접는다 (1/31 + 1개월 = 2/28) */
export function addMonths(iso: string, n: number): string {
  const d = parse(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fmt(d);
}

export function addYears(iso: string, n: number): string {
  return addMonths(iso, n * 12);
}

/** b − a 일수 (b가 뒤면 양수) */
export function diffDays(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** D-Day 표기 — 기준일이 지났으면 D+N */
export function ddayLabel(d: number): string {
  if (d === 0) return "D-Day";
  return d > 0 ? `D-${d}` : `D+${-d}`;
}
