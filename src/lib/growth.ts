/** 성장 탭 데이터 — 면담 기록(부가층) · 인정 이력(축). 성장카드 설계 260901 */

export const INTERVIEW_KINDS = ["100일", "1년", "수습", "정기", "퇴사", "수시"] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export type Interview = {
  id: string;
  employee_no: string;
  held_on: string;
  kind: InterviewKind;
  interviewer: string;
  memo: string | null;
  next_on: string | null;
  created_by: string | null;
  created_at: string;
};

export type InterviewInput = Pick<Interview, "employee_no" | "held_on" | "kind" | "interviewer" | "memo" | "next_on">;

export const RECOGNITION_KINDS = [
  "사내 수상",
  "대외 수상",
  "대외 활동",
  "클라이언트 인정",
  "리더 인정",
] as const;
export type RecognitionKind = (typeof RECOGNITION_KINDS)[number];

export type Recognition = {
  id: string;
  employee_no: string;
  awarded_on: string;
  kind: RecognitionKind;
  title: string;
  project: string | null;
  registered_by: string | null;
  created_at: string;
};

export type RecognitionInput = Pick<Recognition, "employee_no" | "awarded_on" | "kind" | "title" | "project">;
