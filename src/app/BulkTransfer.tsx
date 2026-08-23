"use client";

import { useState } from "react";
import {
  supabase,
  today,
  type Department,
  type Employee,
} from "@/lib/supabase";

type Props = {
  targets: Employee[];
  departments: Department[];
  onDone: () => Promise<void>;
  onClose: () => void;
};

/**
 * 조직개편 일괄 발령 (R14).
 *
 * 개편 당일 수십 명을 1건씩 발령 내는 수작업을 없앤다. 발령이력은 트리거가
 * 인원별로 각각 만들므로, 나중에 개인 이력을 보면 일괄 처리였는지 개별
 * 처리였는지 구분되지 않는다 — 이력의 성격상 그게 맞다.
 */
export default function BulkTransfer({ targets, departments, onDone, onClose }: Props) {
  const [toDept, setToDept] = useState(departments[0]?.name ?? "");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ moved: number; skipped: number } | null>(null);

  const picked = departments.find((d) => d.name === toDept);

  // 이미 그 부서인 사람은 바꿔봐야 이력이 안 남는다 — 미리 걸러서 건수를 정확히 보여준다
  const willMove = targets.filter((t) => t.department !== toDept);
  const alreadyThere = targets.length - willMove.length;

  async function run() {
    setError(null);
    if (!toDept) {
      setError("이동할 부서를 고르세요.");
      return;
    }
    if (!effectiveDate) {
      setError("발령일자를 입력하세요.");
      return;
    }
    // 입사일보다 앞선 발령일자는 DB 제약에도 걸리지만, 여기서 먼저 막아 이유를 알려준다
    const tooEarly = willMove.filter((t) => effectiveDate < t.hire_date);
    if (tooEarly.length > 0) {
      setError(
        `발령일자가 입사일보다 빠른 대상이 ${tooEarly.length}명 있습니다 — ${tooEarly
          .slice(0, 3)
          .map((t) => `${t.name_ko}(${t.hire_date})`)
          .join(", ")}${tooEarly.length > 3 ? " 외" : ""}`,
      );
      return;
    }

    setBusy(true);
    const { error: err } = await supabase
      .from("employees")
      .update({
        department: toDept,
        company: picked?.company,
        effective_date: effectiveDate,
      })
      .in(
        "id",
        willMove.map((t) => t.id),
      );

    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    setResult({ moved: willMove.length, skipped: alreadyThere });
    await onDone();
    setBusy(false);
  }

  if (result) {
    return (
      <div className="backdrop" onClick={onClose}>
        <div className="card modal narrow" onClick={(e) => e.stopPropagation()}>
          <div className="card-head">
            <h3>일괄 발령 완료</h3>
          </div>
          <div className="callout">
            <b>{result.moved}명</b>을 <b>{toDept}</b>(으)로 이동했습니다 (발령일자{" "}
            {effectiveDate}).
            {result.skipped > 0 && ` 이미 같은 부서인 ${result.skipped}명은 제외했습니다.`}
            <br />
            각 직원의 발령이력에 <b>개별 기록</b>이 자동으로 생성됐습니다.
          </div>
          <div className="toolbar">
            <span className="grow" />
            <button className="btn primary" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h3>조직개편 일괄 발령</h3>
          <span className="unit">선택 {targets.length}명</span>
        </div>

        <div className="formgrid">
          <div className="field">
            <label htmlFor="bt-dept">이동할 부서</label>
            <select
              id="bt-dept"
              className="input"
              value={toDept}
              onChange={(e) => setToDept(e.target.value)}
            >
              {departments
                .filter((d) => d.active)
                .map((d) => (
                  <option key={d.code} value={d.name}>
                    {d.name} · {d.company}
                  </option>
                ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="bt-date">발령일자</label>
            <input
              id="bt-date"
              type="date"
              className="input"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
            <span className="field-note">개편 시행일. 미래·소급 모두 가능합니다</span>
          </div>
        </div>

        <div className="callout">
          실제 이동 대상 <b>{willMove.length}명</b>
          {alreadyThere > 0 && ` · 이미 ${toDept} 소속이라 제외되는 인원 ${alreadyThere}명`}
          {picked && ` · 소속은 ${picked.company}로 함께 바뀝니다`}
        </div>

        <div className="t-scroll bulk-list">
          <table>
            <thead>
              <tr>
                <th>사번</th>
                <th>이름</th>
                <th>현재 부서</th>
                <th>직급</th>
                <th className="a-center">처리</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => {
                const skip = t.department === toDept;
                return (
                  <tr key={t.id}>
                    <td>{t.employee_no}</td>
                    <td>{t.name_ko}</td>
                    <td>{t.department}</td>
                    <td>{t.position}</td>
                    <td className="a-center">
                      <span className={skip ? "chip" : "chip acc"}>{skip ? "제외" : "이동"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && <div className="callout error">{error}</div>}

        <div className="toolbar">
          <span className="grow" />
          <button className="btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            className="btn primary"
            onClick={run}
            disabled={busy || willMove.length === 0}
          >
            {busy ? "발령 중…" : `${willMove.length}명 발령`}
          </button>
        </div>
      </div>
    </div>
  );
}
