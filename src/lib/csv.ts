import { displayStatus, formatTenure, tenureYears, type Employee } from "./supabase";

const HEADERS = [
  "사번",
  "한글성명",
  "영문성명",
  "재직구분",
  "소속",
  "부서명",
  "직급",
  "고용형태",
  "채용구분",
  "생년월일",
  "입사일",
  "퇴사일",
  "근속",
  "메일계정",
  "휴대전화",
] as const;

function cell(v: string | null | undefined): string {
  const s = v ?? "";
  // 쉼표·따옴표·줄바꿈이 있으면 감싸고, 내부 따옴표는 두 번 쓴다 (RFC 4180)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 화면에 보이는 목록을 그대로 CSV로 만든다.
 *
 * 실무에서 인사 업무는 결국 엑셀로 끝난다 — 4대보험 신고·급여 연계·경영진 보고·
 * 노무사 제출. 내보내기가 없으면 실무자가 화면을 긁어 붙이게 되고, 그 순간
 * 시스템은 우회된다.
 */
export function toCsv(rows: Employee[]): string {
  const lines = [HEADERS.join(",")];
  for (const e of rows) {
    lines.push(
      [
        cell(e.employee_no),
        cell(e.name_ko),
        cell(e.name_en),
        cell(displayStatus(e)),
        cell(e.company),
        cell(e.department),
        cell(e.position),
        cell(e.employment_type),
        cell(e.hire_type),
        cell(e.birth_date),
        cell(e.hire_date),
        cell(e.resign_date),
        cell(formatTenure(tenureYears(e))),
        cell(e.email),
        cell(e.phone),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

function saveCsv(text: string, filename: string): void {
  // 엑셀이 한글 CSV를 UTF-8로 인식하려면 BOM이 필요하다. 없으면 전부 깨진다.
  // 리터럴로 넣으면 소스에 보이지 않는 문자가 남으므로 이스케이프로 쓴다.
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: Employee[], filename: string): void {
  saveCsv(toCsv(rows), filename);
}

/**
 * 임의 표 내보내기 (260901 B6 공용) — 현황 위젯(이달 입퇴사 등)과 대장 컬럼 선택이 함께 쓴다.
 * "엑셀"이라 부르지만 형식은 BOM 붙은 CSV — 엑셀이 더블클릭으로 연다. xlsx 라이브러리는 들이지 않는다.
 */
export function downloadTable(
  filename: string,
  headers: readonly string[],
  rows: (string | null | undefined)[][],
): void {
  const lines = [headers.map(cell).join(",")];
  for (const r of rows) lines.push(r.map(cell).join(","));
  saveCsv(lines.join("\r\n"), filename);
}
