"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEPARTMENTS,
  STATUSES,
  supabase,
  type Employee,
  type EmployeeInput,
} from "@/lib/supabase";
import EmployeeForm from "./EmployeeForm";

const STATUS_CHIP: Record<string, string> = {
  재직: "chip ok",
  휴직: "chip plan",
  퇴사: "chip no",
};

export default function Home() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("전체");
  const [status, setStatus] = useState("전체");

  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("status", { ascending: true })
      .order("hire_date", { ascending: true });

    if (error) setLoadError(error.message);
    else {
      setLoadError(null);
      setRows(data as Employee[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== "전체" && r.department !== dept) return false;
      if (status !== "전체" && r.status !== status) return false;
      if (!needle) return true;
      return [r.name, r.department, r.position, r.employment_type, r.memo ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, dept, status]);

  const summary = useMemo(() => {
    const byStatus = { 재직: 0, 휴직: 0, 퇴사: 0 } as Record<string, number>;
    const byDept = new Map<string, number>();
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.status !== "퇴사") byDept.set(r.department, (byDept.get(r.department) ?? 0) + 1);
    }
    return { byStatus, byDept: [...byDept.entries()].sort((a, b) => b[1] - a[1]) };
  }, [rows]);

  async function save(input: EmployeeInput) {
    const { error } = editing
      ? await supabase.from("employees").update(input).eq("id", editing.id)
      : await supabase.from("employees").insert(input);
    if (error) throw new Error(error.message);
    setEditing(null);
    setCreating(false);
    await load();
  }

  async function remove() {
    if (!editing) return;
    const { error } = await supabase.from("employees").delete().eq("id", editing.id);
    if (error) throw new Error(error.message);
    setEditing(null);
    await load();
  }

  return (
    <>
      <section className="kpis">
        <div className="kpi lead">
          <span className="k">재직 인원</span>
          <span className="v">{summary.byStatus.재직}</span>
          <span className="s">전체 {rows.length}명 중</span>
        </div>
        <div className="kpi">
          <span className="k">휴직</span>
          <span className="v">{summary.byStatus.휴직}</span>
          <span className="s">명</span>
        </div>
        <div className="kpi">
          <span className="k">퇴사</span>
          <span className="v">{summary.byStatus.퇴사}</span>
          <span className="s">누적</span>
        </div>
        <div className="kpi">
          <span className="k">부서 수</span>
          <span className="v">{summary.byDept.length}</span>
          <span className="s">재직자 기준</span>
        </div>
      </section>

      <div className="card">
        <div className="card-head">
          <h3>부서별 인원</h3>
          <span className="unit">퇴사자 제외 · 명</span>
        </div>
        <div className="deptlist">
          {summary.byDept.length === 0 && !loading ? (
            <span className="chip">데이터 없음</span>
          ) : (
            summary.byDept.map(([d, n]) => (
              <span key={d} className="chip acc">
                {d} {n}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input"
          style={{ minWidth: 220 }}
          placeholder="이름·직급·메모 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="전체">부서 · 전체</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="전체">상태 · 전체</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(q || dept !== "전체" || status !== "전체") && (
          <button
            className="btn"
            onClick={() => {
              setQ("");
              setDept("전체");
              setStatus("전체");
            }}
          >
            초기화
          </button>
        )}
        <span className="grow" />
        <button className="btn primary" onClick={() => setCreating(true)}>
          + 신규 입사자 등록
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>직원 대장</h3>
          <span className="unit">
            {filtered.length}명 표시 {filtered.length !== rows.length && `· 전체 ${rows.length}명`}
          </span>
        </div>

        {loadError ? (
          <div className="callout" style={{ borderLeftColor: "var(--bad)", color: "var(--bad)" }}>
            데이터를 불러오지 못했습니다 — {loadError}
          </div>
        ) : loading ? (
          <div className="t-empty">불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div className="t-empty">조건에 맞는 직원이 없습니다.</div>
        ) : (
          <div className="t-scroll">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>부서</th>
                  <th>직급</th>
                  <th>고용형태</th>
                  <th>입사일</th>
                  <th>퇴사일</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="rowlink" onClick={() => setEditing(r)}>
                    <td>{r.name}</td>
                    <td>{r.department}</td>
                    <td>{r.position}</td>
                    <td>{r.employment_type}</td>
                    <td>{r.hire_date}</td>
                    <td>{r.resign_date ?? "–"}</td>
                    <td>
                      <span className={STATUS_CHIP[r.status]}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="callout">
        행을 클릭하면 상세 정보를 수정할 수 있습니다. <b>가상 회사의 더미데이터</b>이며 실제
        직원 정보는 포함돼 있지 않습니다.
      </div>

      {(creating || editing) && (
        <EmployeeForm
          employee={editing}
          onSave={save}
          onDelete={editing ? remove : undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
