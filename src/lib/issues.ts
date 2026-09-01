import { displayStatus, isOnBoard, today, type Employee } from "./supabase";
import { addDays, addMonths, addYears, diffDays } from "./dates";

/**
 * 인사 이슈 보드 (260901 지시서 A1) — "오늘 손댈 일"의 시점 감지.
 *
 * 알림 발송(2차)과 별개로 여기서는 표시까지만 한다. 감지 규칙은 전부 employees 한 표에서
 * 계산하므로 저장된 상태가 없다 — 날짜가 지나면 저절로 빠지고 새로 도래하면 저절로 뜬다.
 *
 * 가정(지시서에 값이 없어 단순한 쪽을 택함 — 인계 메모에 기록):
 *   · 수습 = 입사 후 3개월, 회장 제외
 *   · 입사 100일 = 입사일 + 100일
 *   · 근속 도래 = 7·10·20년 기념일이 올해에 있는 사람 — 지난 것도 상시 표시(260901 확정)
 *   · 향후 창 = 30일. 기준일이 이미 지난 계약·복직은 '경과'로 남겨 둔다 — 조용히 빠지면 놓친다
 */
export const ISSUE_KINDS = [
  "계약 만료",
  "복직 예정",
  "수습 종료",
  "근속 도래",
  "입사 100일",
  "입사 1년",
  "퇴사 예정",
  "비상연락망 미기재",
] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

export type IssueState = "경과" | "임박" | "주의" | "예정" | "도래" | "미기재";

export type Issue = {
  key: string;
  kind: IssueKind;
  employee: Employee;
  /** 기준일 — 미기재 유형은 없다 */
  date: string | null;
  /** 기준일까지 남은 일수. 지났으면 음수 */
  dday: number | null;
  state: IssueState;
  /** 근속 도래의 "7년" 같은 부연 */
  note?: string;
};

const HORIZON = 30;
const PROBATION_MONTHS = 3;
const TENURE_MILESTONES = [7, 10, 20];

/** 기준일까지 남은 일수 → 상태. 계약 만료의 D-15·D-3 강조를 모든 기한 유형에 같은 척도로 적용 */
function stateOf(d: number): IssueState {
  if (d < 0) return "경과";
  if (d <= 3) return "임박";
  if (d <= 15) return "주의";
  return "예정";
}

export function detectIssues(rows: Employee[], ref = today()): Issue[] {
  const out: Issue[] = [];
  const year = ref.slice(0, 4);

  const push = (kind: IssueKind, e: Employee, date: string, state?: IssueState, note?: string) => {
    const d = diffDays(ref, date);
    out.push({
      key: `${kind}:${e.employee_no}:${date}`,
      kind,
      employee: e,
      date,
      dday: d,
      state: state ?? stateOf(d),
      note,
    });
  };

  for (const e of rows) {
    if (!isOnBoard(e, ref)) continue;
    // 입사일이 아직 오지 않은 사람(입사 예정)은 재직 이벤트의 대상이 아니다
    const joined = e.hire_date <= ref;

    if (e.contract_end_date && diffDays(ref, e.contract_end_date) <= HORIZON) {
      push("계약 만료", e, e.contract_end_date);
    }

    if (e.status === "휴직" && e.return_date && diffDays(ref, e.return_date) <= HORIZON) {
      const d = diffDays(ref, e.return_date);
      push("복직 예정", e, e.return_date, d < 0 ? "경과" : "예정");
    }

    if (joined && e.employment_type !== "회장") {
      const end = addMonths(e.hire_date, PROBATION_MONTHS);
      const d = diffDays(ref, end);
      if (d >= 0 && d <= HORIZON) push("수습 종료", e, end, "예정");
    }

    if (joined) {
      for (const y of TENURE_MILESTONES) {
        const anniv = addYears(e.hire_date, y);
        if (anniv.slice(0, 4) !== year) continue;
        const d = diffDays(ref, anniv);
        push("근속 도래", e, anniv, d < 0 ? "도래" : "예정", `${y}년`);
      }

      const d100 = addDays(e.hire_date, 100);
      const dd100 = diffDays(ref, d100);
      if (dd100 >= 0 && dd100 <= HORIZON) push("입사 100일", e, d100, "예정");

      const y1 = addYears(e.hire_date, 1);
      const dy1 = diffDays(ref, y1);
      if (dy1 >= 0 && dy1 <= HORIZON) push("입사 1년", e, y1, "예정");
    }

    if (displayStatus(e, ref) === "퇴사예정" && e.resign_date) {
      if (diffDays(ref, e.resign_date) <= HORIZON) push("퇴사 예정", e, e.resign_date);
    }

    if (!e.emergency_contact?.trim()) {
      out.push({
        key: `비상연락망:${e.employee_no}`,
        kind: "비상연락망 미기재",
        employee: e,
        date: null,
        dday: null,
        state: "미기재",
      });
    }
  }

  // 손댈 순서 — 경과 > 임박 > 주의 > 예정(기준일 순) > 이미 도래한 근속 > 미기재(이름순)
  const RANK: Record<IssueState, number> = { 경과: 0, 임박: 1, 주의: 2, 예정: 3, 도래: 4, 미기재: 5 };
  return out.sort((a, b) => {
    const r = RANK[a.state] - RANK[b.state];
    if (r !== 0) return r;
    if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
    return a.employee.name_ko.localeCompare(b.employee.name_ko, "ko");
  });
}
