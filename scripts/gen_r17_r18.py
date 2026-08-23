"""R17 성과 이력 + R18 거주지역 마이그레이션 생성.

거주지역은 employees 에 컬럼을 추가하고 UPDATE 로 채운다 — 전체 재적재(db reset)를
하면 auth 스키마까지 지워져 로그인 계정이 사라지기 때문이다.

개인정보 설계 고정(R9 정합): 거주지는 시·구 단위만. 상세 주소 필드는 만들지 않는다.
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def q(v) -> str:
    if v is None or v == "":
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


employees = json.loads((ROOT / "data" / "employees.json").read_text(encoding="utf-8"))
performance = json.loads((ROOT / "data" / "performance.json").read_text(encoding="utf-8"))


def emp_no(v: str) -> str:
    return "GA" + v[2:] if v.startswith("FM") else v


# 거주지역 — 사번별 UPDATE 용 VALUES
res_rows = [
    f"  ({q(emp_no(e['사번']))}, {q(e.get('거주지역'))})"
    for e in employees
    if e.get("거주지역")
]

# 성과 이력 — 종료일이 시작일보다 빠른 행은 제외한다.
# 조용히 날짜를 바꿔 넣으면 원본과 어긋나므로, 빼고 기록에 남긴다.
perf_rows = []
skipped = []
for p in performance:
    if p["종료일"] and p["종료일"] < p["시작일"]:
        skipped.append(p)
        continue
    perf_rows.append(
        "  ({}, {}, {}, {}, {}, {})".format(
            q(emp_no(p["사번"])),
            q(p["프로젝트명"]),
            q(p["역할"]),
            q(p["시작일"]),
            q(p["종료일"]),
            q(p["기여"]),
        )
    )

res_values = ",\n".join(res_rows)
perf_values = ",\n".join(perf_rows)
skip_note = "\n".join(
    f"--   {s['사번']} · {s['프로젝트명']} · {s['시작일']} → {s['종료일']}" for s in skipped
) or "--   (없음)"

sql = f"""-- R17 성과 이력 + R18 거주지역
--
-- 이 파일은 scripts/gen_r17_r18.py 가 data/*.json 에서 생성한다. 직접 고치지 말 것.
--
-- 전체 재적재(db reset) 대신 ALTER + UPDATE 로 붙인다 — reset 은 auth 스키마까지
-- 지워서 로그인 계정이 전부 사라진다.
--
-- 제외한 성과 이력 (종료일이 시작일보다 빠름 — 원본을 임의로 고치지 않고 뺐다):
{skip_note}

-- ---------------------------------------------------------------- R18 거주지역
-- 시·구 단위만 저장한다. 상세 주소 컬럼은 만들지 않는다 (R9 민감정보 비저장).
alter table public.employees
  add column if not exists residence text;

comment on column public.employees.residence is
  '거주지역 — 시·구 단위. 상세 주소는 저장하지 않는다.';

update public.employees e
   set residence = v.residence
  from (values
{res_values}
       ) as v(employee_no, residence)
 where e.employee_no = v.employee_no;

-- ---------------------------------------------------------------- R17 성과 이력
-- 사실 기록만 담는다. 평가 등급·점수 필드는 두지 않는다.
create table if not exists public.performance (
  id           uuid primary key default gen_random_uuid(),
  employee_no  text not null references public.employees (employee_no)
               on update cascade on delete cascade,
  project      text not null,   -- 프로젝트/업무명
  role         text not null,   -- 역할
  started_on   date not null,   -- 시작일
  ended_on     date,            -- 종료일 (null = 진행 중)
  contribution text,            -- 기여 한 줄
  created_at   timestamptz not null default now(),

  constraint performance_period check (ended_on is null or ended_on >= started_on)
);

create index if not exists performance_employee_idx
  on public.performance (employee_no, started_on desc);

insert into public.performance (employee_no, project, role, started_on, ended_on, contribution)
values
{perf_values};

-- ---------------------------------------------------------------- RLS
-- 다른 표와 같은 원칙: 읽기는 공개, 쓰기는 로그인.
alter table public.performance enable row level security;

create policy "read_performance" on public.performance
  for select to anon, authenticated using (true);
create policy "auth_write_performance" on public.performance
  for insert to authenticated with check (true);
create policy "auth_update_performance" on public.performance
  for update to authenticated using (true) with check (true);
"""

out = ROOT / "supabase" / "migrations" / "20260823060000_performance_residence.sql"
out.write_text(sql, encoding="utf-8")
print(f"생성: {out.name}")
print(f"  거주지역 {len(res_rows)}명 · 성과 이력 {len(perf_rows)}건 (제외 {len(skipped)}건)")
for s in skipped:
    print(f"  제외: {s['사번']} {s['프로젝트명']} — 시작 {s['시작일']} > 종료 {s['종료일']}")
