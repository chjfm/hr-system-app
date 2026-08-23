-- 로그인 + 변경자 기록 (HR 평가 개선안 #8)
--
-- 지금까지는 누구든 익명으로 직원 정보를 고칠 수 있었고, 누가 바꿨는지 남지 않았다.
-- 개인정보보호법상 인사정보는 접근·변경 기록 보관 의무가 있고, 노무 분쟁에서
-- "이 발령을 누가 입력했는가"가 쟁점이 된다. 실무자가 1~2명이어도 그 사람은 바뀐다.
--
-- 읽기는 공개로 둔다 — 전체를 잠그면 데모에서 URL을 열어도 로그인 화면만 보인다.
-- 쓰기만 인증을 요구하고, 모든 변경에 실행자를 남긴다.

-- ---------------------------------------------------------------- 변경자 기록
alter table public.appointments
  add column if not exists actor_email text;

comment on column public.appointments.actor_email is
  '이 발령을 입력한 계정. 트리거가 JWT에서 읽어 채운다. 시드 데이터는 null.';

-- 발령이력에 안 잡히는 필드(연락처·메일·성명 등) 변경도 남긴다.
-- 발령이력은 인사 문서이고, 이쪽은 감사 로그다 — 성격이 달라 테이블을 나눈다.
create table if not exists public.change_log (
  id           uuid primary key default gen_random_uuid(),
  employee_no  text not null references public.employees (employee_no)
               on update cascade on delete cascade,
  field        text not null,
  old_value    text,
  new_value    text,
  actor_email  text,
  changed_at   timestamptz not null default now()
);

create index if not exists change_log_employee_idx
  on public.change_log (employee_no, changed_at desc);

-- ---------------------------------------------------------------- 실행자 조회
-- SECURITY DEFINER 함수 안에서도 request.jwt.claims 는 그대로 읽힌다
-- (DEFINER 가 바꾸는 건 실행 롤이지 요청 컨텍스트가 아니다).
create or replace function public.actor() returns text
language sql stable
set search_path = public
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'email', '');
$$;

-- ---------------------------------------------------------------- 이력 트리거 (실행자 포함)
create or replace function public.log_appointment() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on    date := coalesce(new.effective_date, current_date);
  v_actor text := public.actor();
begin
  if tg_op = 'INSERT' then
    insert into public.appointments (employee_no, appointed_on, kind, detail, actor_email)
    values (new.employee_no, new.hire_date, '입사',
            new.department || ' ' || new.position || ' 입사', v_actor);
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = '퇴사' then
      insert into public.appointments (employee_no, appointed_on, kind, detail, actor_email)
      values (new.employee_no, new.resign_date, '퇴사',
              new.department || ' ' || new.position || ' 퇴사', v_actor);
    elsif new.status = '휴직' then
      insert into public.appointments (employee_no, appointed_on, kind, detail, actor_email)
      values (new.employee_no, v_on, '휴직', '휴직 시작', v_actor);
    elsif new.status = '재직' and old.status = '휴직' then
      insert into public.appointments (employee_no, appointed_on, kind, detail, actor_email)
      values (new.employee_no, v_on, '복직', '휴직 종료 · 복직', v_actor);
    end if;
  end if;

  if new.department is distinct from old.department then
    insert into public.appointments (employee_no, appointed_on, kind, detail, actor_email)
    values (new.employee_no, v_on, '발령',
            old.department || ' → ' || new.department || ' 부서 이동', v_actor);
  end if;

  if new.position is distinct from old.position then
    insert into public.appointments (employee_no, appointed_on, kind, detail, actor_email)
    values (new.employee_no, v_on, '승진',
            old.position || ' → ' || new.position, v_actor);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------- 감사 로그 트리거
create or replace function public.log_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := public.actor();
  v_field text;
  v_old   text;
  v_new   text;
begin
  foreach v_field in array array[
    'name_ko', 'name_en', 'company', 'department', 'position',
    'status', 'birth_date', 'hire_date', 'resign_date',
    'email', 'phone', 'hire_type'
  ] loop
    execute format('select ($1).%I::text, ($2).%I::text', v_field, v_field)
      into v_old, v_new using old, new;

    if v_old is distinct from v_new then
      insert into public.change_log (employee_no, field, old_value, new_value, actor_email)
      values (new.employee_no, v_field, v_old, v_new, v_actor);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists employees_log_change on public.employees;
create trigger employees_log_change
  after update on public.employees
  for each row execute function public.log_change();

-- ---------------------------------------------------------------- RLS
-- 읽기는 공개, 쓰기는 로그인 필요.
alter table public.change_log enable row level security;

drop policy if exists "demo_insert" on public.employees;
drop policy if exists "demo_update" on public.employees;

create policy "auth_insert" on public.employees
  for insert to authenticated with check (true);
create policy "auth_update" on public.employees
  for update to authenticated using (true) with check (true);

create policy "read_change_log" on public.change_log
  for select to anon, authenticated using (true);
