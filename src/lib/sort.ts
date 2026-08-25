import { DISPLAY_STATUSES, displayStatus, tenureYears, type Employee } from "./supabase";

/**
 * 직급은 가나다순으로 정렬하면 의미가 없다 (사원 ↔ 이사가 뒤섞인다).
 * 서열 순으로 정렬해야 "부장 이상 몇 명" 같은 실무 질문에 답이 된다.
 */
const POSITION_RANK: Record<string, number> = {
  사원: 1,
  주임: 2,
  대리: 3,
  과장: 4,
  차장: 5,
  부장: 6,
  이사: 7,
};

const STATUS_RANK: Record<string, number> = Object.fromEntries(
  DISPLAY_STATUSES.map((s, i) => [s, i]),
);

export type SortKey =
  | "employee_no"
  | "name_ko"
  | "company"
  | "department"
  | "position"
  | "employment_type"
  | "hire_date"
  | "tenure"
  | "resign_date"
  | "status";

export type SortState = { key: SortKey; dir: "asc" | "desc" };

type Col = {
  key: SortKey;
  label: string;
  /** 정렬 기준값. 문자열이면 한국어 정렬, 숫자면 수치 정렬 */
  value: (e: Employee) => string | number;
  align?: "right" | "center";
};

export const COLUMNS: Col[] = [
  { key: "employee_no", label: "사번", value: (e) => e.employee_no },
  { key: "name_ko", label: "이름", value: (e) => e.name_ko },
  { key: "company", label: "소속", value: (e) => e.company },
  { key: "department", label: "부서명", value: (e) => e.department },
  { key: "position", label: "직급", value: (e) => POSITION_RANK[e.position] ?? 0 },
  { key: "employment_type", label: "고용형태", value: (e) => e.employment_type },
  { key: "hire_date", label: "입사일", value: (e) => e.hire_date, align: "right" },
  { key: "tenure", label: "근속", value: (e) => tenureYears(e), align: "right" },
  // 퇴사일 없는 사람은 항상 끝으로 — 빈 값이 앞에 몰리면 목록이 안 읽힌다
  { key: "resign_date", label: "퇴사일", value: (e) => e.resign_date ?? "9999-99-99", align: "right" },
  { key: "status", label: "재직구분", value: (e) => STATUS_RANK[displayStatus(e)], align: "center" },
];

export function sortRows(rows: Employee[], sort: SortState): Employee[] {
  const col = COLUMNS.find((c) => c.key === sort.key);
  if (!col) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const va = col.value(a);
    const vb = col.value(b);
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "ko");
    // 값이 같으면 사번으로 고정 — 그래야 정렬을 토글해도 순서가 튀지 않는다
    return cmp !== 0 ? cmp * sign : a.employee_no.localeCompare(b.employee_no);
  });
}
