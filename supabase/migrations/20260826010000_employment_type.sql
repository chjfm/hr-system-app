-- 고용형태 (260826 9차 배치 1단계 — 항목사전 §4 확정안)
--
-- hire_type(신입/경력·채용구분)과는 다른 축이다. 급여·4대보험·계약 관리가
-- 전부 이 구분을 따라 갈리므로 인사원장의 1차 이관 항목이다.
-- 5종은 급여마스터 C열·구성도 확정안 그대로: 정규직/별정직/계약직/인턴/회장.

alter table public.employees
  add column if not exists employment_type text not null default '정규직'
  check (employment_type in ('정규직', '별정직', '계약직', '인턴', '회장'));

comment on column public.employees.employment_type is
  '고용형태 5종 — 정규직/별정직/계약직/인턴/회장 (급여마스터 C열 기준)';

-- ---------------------------------------------------------------- 더미 분포 배정
-- 실데이터 반입 전 데모용 분포 — "계약직 많은 편"인 실제 조직 성격을 반영해
-- 계약직·인턴 비중을 크게 잡는다. 결정적 규칙(입사일 역순 순번)이라 재실행해도 같다.
--   · 최근 입사 12명 = 인턴 (근속 짧은 쪽이 자연스럽다)
--   · 나머지 중 4명 중 1명꼴 = 계약직 (~23%)
--   · 17명 중 1명꼴 = 별정직 (~5%)
--   · 그 외 = 정규직
with ranked as (
  select employee_no,
         row_number() over (order by hire_date desc, employee_no) as rn
  from public.employees
)
update public.employees e
set employment_type = case
  when r.rn <= 12       then '인턴'
  when r.rn % 4 = 1     then '계약직'
  when r.rn % 17 = 8    then '별정직'
  else '정규직'
end
from ranked r
where r.employee_no = e.employee_no;

-- 회장 1명 — 이사 직급 중 최고참. 데모 표시용이다.
update public.employees
set employment_type = '회장'
where employee_no = (
  select employee_no from public.employees
  where position = '이사'
  order by hire_date, employee_no
  limit 1
);

-- ---------------------------------------------------------------- 감사 로그 감시 필드 보강
-- employment_type 추가 + 기존 배열에서 빠져 있던 residence·effective_date 보강.
-- (거주지역을 고쳐도 로그가 안 남던 구멍 — 이번에 함께 막는다)
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
    'email', 'phone', 'hire_type', 'employment_type',
    'residence', 'effective_date'
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
