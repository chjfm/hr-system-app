import { isOnBoard, today, type Employee } from "./supabase";
import { addDays, addMonths, addYears, diffDays } from "./dates";
import type { Interview, InterviewKind } from "./growth";

/**
 * 면담 진행률 (260901 A4 · 성장관리 대시보드 기획 260828 위젯 ①·⑤)
 *
 * 대상 = 올해 도래한 이벤트 면담(100일 · 1년 · 수습) + 현원의 반기 정기 면담 1회.
 * 완료 = 같은 유형의 기록이 있는 것 (이벤트는 도래일 ±60일, 정기는 이번 반기 안).
 * 공백 = 최근 90일 동안 어떤 유형의 면담도 없는 현원 (임계값 90일 — 로드맵 미결 제안값).
 *
 * 가정이다 — 대상 정의·임계값은 인사팀 확정 후 조정한다. 순위 표기는 하지 않는다(가나다순).
 */
export const GAP_DAYS = 90;
const EVENT_TOLERANCE = 60;

export type TargetKind = Extract<InterviewKind, "100일" | "1년" | "수습" | "정기">;
export const TARGET_KINDS: TargetKind[] = ["100일", "1년", "수습", "정기"];

export type Target = { employee: Employee; kind: TargetKind; due: string; done: boolean };

export type DeptProgress = { dept: string; targets: number; done: number; rate: number; gap: number };

export type InterviewStats = {
  targets: Target[];
  byKind: Record<TargetKind, { targets: number; done: number }>;
  total: number;
  done: number;
  rate: number;
  gapEmployees: Employee[];
  byDept: DeptProgress[];
  half: string;
};

function halfRange(ref: string): { from: string; to: string; label: string } {
  const y = ref.slice(0, 4);
  const m = Number(ref.slice(5, 7));
  return m <= 6
    ? { from: `${y}-01-01`, to: `${y}-06-30`, label: `${y} 상반기` }
    : { from: `${y}-07-01`, to: `${y}-12-31`, label: `${y} 하반기` };
}

export function interviewStats(rows: Employee[], interviews: Interview[], ref = today()): InterviewStats {
  const year = ref.slice(0, 4);
  const half = halfRange(ref);
  const byEmp = new Map<string, Interview[]>();
  for (const i of interviews) byEmp.set(i.employee_no, [...(byEmp.get(i.employee_no) ?? []), i]);

  const targets: Target[] = [];
  const gapEmployees: Employee[] = [];

  for (const e of rows) {
    if (!isOnBoard(e, ref) || e.hire_date > ref) continue;
    const mine = byEmp.get(e.employee_no) ?? [];
    const has = (kind: TargetKind, from: string, to: string) =>
      mine.some((i) => i.kind === kind && i.held_on >= from && i.held_on <= to);

    // 이벤트 면담 — 올해 도래했고 오늘 이전인 것만 대상 (아직 안 온 이벤트는 이슈 보드가 다룬다)
    const events: [TargetKind, string][] = [
      ["100일", addDays(e.hire_date, 100)],
      ["1년", addYears(e.hire_date, 1)],
      ["수습", addMonths(e.hire_date, 3)],
    ];
    for (const [kind, due] of events) {
      if (due.slice(0, 4) !== year || due > ref) continue;
      targets.push({
        employee: e,
        kind,
        due,
        done: has(kind, addDays(due, -EVENT_TOLERANCE), addDays(due, EVENT_TOLERANCE)),
      });
    }

    // 정기 면담 — 입사 1년 넘은 현원은 반기 1회
    if (addYears(e.hire_date, 1) <= ref) {
      targets.push({ employee: e, kind: "정기", due: half.to, done: has("정기", half.from, half.to) });
    }

    // 90일 공백 — 유형 불문 최근 기록
    const lastHeld = mine.map((i) => i.held_on).sort().at(-1);
    if (!lastHeld || diffDays(lastHeld, ref) > GAP_DAYS) gapEmployees.push(e);
  }

  const byKind = Object.fromEntries(
    TARGET_KINDS.map((k) => [k, { targets: 0, done: 0 }]),
  ) as Record<TargetKind, { targets: number; done: number }>;
  for (const t of targets) {
    byKind[t.kind].targets += 1;
    if (t.done) byKind[t.kind].done += 1;
  }

  const deptMap = new Map<string, DeptProgress>();
  const ensure = (dept: string) => {
    const cur = deptMap.get(dept) ?? { dept, targets: 0, done: 0, rate: 0, gap: 0 };
    deptMap.set(dept, cur);
    return cur;
  };
  for (const t of targets) {
    const d = ensure(t.employee.department);
    d.targets += 1;
    if (t.done) d.done += 1;
  }
  for (const e of gapEmployees) ensure(e.department).gap += 1;
  const byDept = [...deptMap.values()]
    .map((d) => ({ ...d, rate: d.targets ? (d.done / d.targets) * 100 : 0 }))
    // 가나다순 — 순위표 금지 (부서장 압박 도구로 변질 방지, 대시보드 기획 260828)
    .sort((a, b) => a.dept.localeCompare(b.dept, "ko"));

  const total = targets.length;
  const done = targets.filter((t) => t.done).length;
  return {
    targets,
    byKind,
    total,
    done,
    rate: total ? (done / total) * 100 : 0,
    gapEmployees: gapEmployees.sort((a, b) => a.name_ko.localeCompare(b.name_ko, "ko")),
    byDept,
    half: half.label,
  };
}
