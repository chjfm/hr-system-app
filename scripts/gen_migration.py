"""data/*.json 을 가상 회사 이름으로 치환해 Supabase 마이그레이션 SQL을 만든다.

브리프 규칙: 공개 배포이므로 실제 회사 식별자(사번 접두사·이메일 도메인·계열사명·
조직명)를 쓰지 않는다. 사람은 이미 가상이고, 구조와 건수는 그대로 보존한다.
"""

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 소속(계열사) — 가상 그룹 "가온컴퍼니"
COMPANY = {
    "본사": "본사",
    "Xperience": "가온플러스",
    "엠퍼시": "가온랩",
    "스튜디오": "가온스튜디오",
}

# 부서 — 실제 조직명을 연상시키는 것만 바꾸고 일반 명칭은 둔다
DEPARTMENT = {
    "CSA연구소": "기술연구소",
    "XP 1팀": "사업 1팀",
    "XP 2팀": "사업 2팀",
    "XP 3팀": "사업 3팀",
}

EMP_NO_PREFIX = ("FM", "GA")          # 사번 접두사
EMAIL_DOMAIN = ("@fm.co.kr", "@gaon.co.kr")


def company(v: str) -> str:
    return COMPANY.get(v, v)


def department(v: str) -> str:
    return DEPARTMENT.get(v, v)


def emp_no(v: str) -> str:
    return v.replace(*EMP_NO_PREFIX, 1) if v.startswith(EMP_NO_PREFIX[0]) else v


def email(v: str) -> str:
    return v.replace(*EMAIL_DOMAIN)


def detail(v: str) -> str:
    """발령내용 문자열 안에 박힌 부서명도 함께 치환한다."""
    for old, new in DEPARTMENT.items():
        v = re.sub(re.escape(old), new, v)
    return v


def q(v) -> str:
    """SQL 리터럴. 빈 문자열은 NULL 로."""
    if v is None or v == "":
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


employees = json.loads((ROOT / "data" / "employees.json").read_text(encoding="utf-8"))
appointments = json.loads((ROOT / "data" / "appointments.json").read_text(encoding="utf-8"))

emp_rows = []
for e in employees:
    emp_rows.append(
        "  ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})".format(
            q(emp_no(e["사번"])),
            q(e["한글성명"]),
            q(e["영문성명"]),
            q(e["재직구분"]),
            q(company(e["소속"])),
            q(department(e["부서명"])),
            q(e["직급"]),
            q(e["생년월일"]),
            q(e["입사일"]),
            q(e["퇴사일"]),
            q(email(e["메일계정"])),
            q(e["휴대전화"]),
            q(e["채용구분"]),
        )
    )

apt_rows = []
for a in appointments:
    apt_rows.append(
        "  ({}, {}, {}, {})".format(
            q(emp_no(a["사번"])),
            q(a["발령일자"]),
            q(a["발령종류"]),
            q(detail(a["발령내용"])),
        )
    )

emp_values = ",\n".join(emp_rows)
apt_values = ",\n".join(apt_rows)

sql = f"""-- 직원 정보 관리 시스템 — 직원 대장 + 발령이력
-- 기획: docs/[내부·기획] 직원정보관리_UX시나리오_260823.md (R1~R10)
--
-- 이 파일은 scripts/gen_migration.py 가 data/*.json 에서 생성한다. 직접 고치지 말 것.
-- 공개 배포이므로 회사 식별자는 가상값으로 치환돼 있다 (사람은 원래부터 가상).
-- R9: 주민번호·병역·장애 등 민감 항목은 스키마에 두지 않는다.

drop table if exists public.appointments cascade;
drop table if exists public.employees cascade;

-- ---------------------------------------------------------------- 직원 대장
create table public.employees (
  id           uuid primary key default gen_random_uuid(),
  employee_no  text not null unique,                        -- 사번
  name_ko      text not null,                               -- 한글성명
  name_en      text,                                        -- 영문성명
  status       text not null default '재직'                 -- 재직구분
               check (status in ('재직', '휴직', '퇴사')),
  company      text not null,                               -- 소속
  department   text not null,                               -- 부서명
  position     text not null,                               -- 직급
  birth_date   date,                                        -- 생년월일
  hire_date    date not null,                               -- 입사일
  resign_date  date,                                        -- 퇴사일
  email        text,                                        -- 메일계정
  phone        text,                                        -- 휴대전화
  hire_type    text check (hire_type in ('신입', '경력')),  -- 채용구분
  created_at   timestamptz not null default now(),

  -- R6: 퇴사면 퇴사일이 반드시 있고, 퇴사가 아니면 퇴사일이 없다
  constraint resign_date_matches_status check (
    (status = '퇴사' and resign_date is not null) or
    (status <> '퇴사' and resign_date is null)
  ),
  constraint resign_after_hire check (
    resign_date is null or resign_date >= hire_date
  )
);

create index employees_status_idx     on public.employees (status);
create index employees_department_idx on public.employees (department);
create index employees_company_idx    on public.employees (company);

-- ---------------------------------------------------------------- 발령이력 (R8)
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  employee_no  text not null references public.employees (employee_no)
               on update cascade on delete cascade,
  appointed_on date not null,                                -- 발령일자
  kind         text not null                                 -- 발령종류
               check (kind in ('입사', '승진', '발령', '휴직', '복직', '퇴사')),
  detail       text not null,                                -- 발령내용
  created_at   timestamptz not null default now()
);

create index appointments_employee_idx on public.appointments (employee_no, appointed_on);

-- ---------------------------------------------------------------- 더미데이터
insert into public.employees
  (employee_no, name_ko, name_en, status, company, department, position,
   birth_date, hire_date, resign_date, email, phone, hire_type)
values
{emp_values};

insert into public.appointments (employee_no, appointed_on, kind, detail)
values
{apt_values};

-- ---------------------------------------------------------------- 이력 자동기록 (R3·R4·R5)
-- 수기 기록을 없애는 것이 이 시스템의 핵심이므로, 앱이 아니라 DB에서 보장한다.
-- SECURITY DEFINER 여야 한다. 기본값(INVOKER)이면 트리거가 호출자(anon) 권한으로
-- 돌아가 appointments 의 RLS에 막힌다. 이력은 시스템만 기록해야 하므로 anon insert
-- 정책을 여는 대신 함수 권한을 올린다.
create or replace function public.log_appointment() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointments (employee_no, appointed_on, kind, detail)
    values (new.employee_no, new.hire_date, '입사',
            new.department || ' ' || new.position || ' 입사');
    return new;
  end if;

  -- 상태 변경
  if new.status is distinct from old.status then
    if new.status = '퇴사' then
      insert into public.appointments (employee_no, appointed_on, kind, detail)
      values (new.employee_no, new.resign_date, '퇴사',
              new.department || ' ' || new.position || ' 퇴사');
    elsif new.status = '휴직' then
      insert into public.appointments (employee_no, appointed_on, kind, detail)
      values (new.employee_no, current_date, '휴직', '휴직 시작');
    elsif new.status = '재직' and old.status = '휴직' then
      insert into public.appointments (employee_no, appointed_on, kind, detail)
      values (new.employee_no, current_date, '복직', '휴직 종료 · 복직');
    end if;
  end if;

  -- 부서 이동
  if new.department is distinct from old.department then
    insert into public.appointments (employee_no, appointed_on, kind, detail)
    values (new.employee_no, current_date, '발령',
            old.department || ' → ' || new.department || ' 부서 이동');
  end if;

  -- 직급 변경
  if new.position is distinct from old.position then
    insert into public.appointments (employee_no, appointed_on, kind, detail)
    values (new.employee_no, current_date, '승진',
            old.position || ' → ' || new.position);
  end if;

  return new;
end;
$$;

create trigger employees_log_insert
  after insert on public.employees
  for each row execute function public.log_appointment();

create trigger employees_log_update
  after update on public.employees
  for each row execute function public.log_appointment();

-- ---------------------------------------------------------------- RLS
-- 로그인이 스코프에서 제외된 공개 데모라 익명 접근을 명시적으로 허용한다.
-- 정책이 없으면 RLS가 모든 요청을 차단해 "데이터가 안 보이는" 상태가 된다.
-- R10: 삭제 없음 — delete 정책을 만들지 않는다. 퇴사도 상태 변경으로만 처리한다.
alter table public.employees    enable row level security;
alter table public.appointments enable row level security;

create policy "demo_select" on public.employees
  for select to anon, authenticated using (true);
create policy "demo_insert" on public.employees
  for insert to anon, authenticated with check (true);
create policy "demo_update" on public.employees
  for update to anon, authenticated using (true) with check (true);

create policy "demo_select" on public.appointments
  for select to anon, authenticated using (true);
"""

out = ROOT / "supabase" / "migrations" / "20260823010000_employees_appointments.sql"
out.write_text(sql, encoding="utf-8")
print(f"생성: {out.name} — 직원 {len(emp_rows)}명 · 발령 {len(apt_rows)}건")
