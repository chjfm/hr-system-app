-- 인사 이슈 보드 입력 컬럼 3건 (260901 dev 지시서 1호 — A1 · B5 · §B-4)
--
-- 지시서 A1은 계약종료일·복직예정일·비상연락처를 employees 에서 읽는 것으로 적었으나
-- 현 스키마(항목사전 §2·§4 "현시스템 —")에는 셋 다 없다. 복직예정일은 지시서가
-- "부재 시 추가"를 허용했고, 나머지 둘도 같은 성격(보드의 입력값)이라 한 번에 붙인다.
-- 전부 nullable 추가 — 기존 화면·제약·트리거에 영향 없음.
--
-- 실데이터 없음 — 더미 배정은 사번 숫자 기반 결정적 규칙이라 재실행해도 같다.

alter table public.employees
  add column if not exists contract_end_date date,   -- 계약종료일 (계약직·인턴)
  add column if not exists return_date       date,   -- 복직예정일 (휴직자)
  add column if not exists emergency_contact text;   -- 비상연락망 (관계 · 번호)

comment on column public.employees.contract_end_date is
  '계약종료일 — 계약직·인턴. 보드 유형 "계약 만료"(D-15·D-3 강조)의 기준일';
comment on column public.employees.return_date is
  '복직예정일 — 휴직자. 보드 유형 "복직 예정"의 기준일';
comment on column public.employees.emergency_contact is
  '비상연락망 — "관계 · 번호" 한 줄. 비어 있으면 보드 유형 "비상연락망 미기재"';

-- ---------------------------------------------------------------- 더미 배정
-- 계약직: 입사 기념일에 1년 단위 갱신한다고 가정 → 기준일(2026-09-01) 이후 첫 기념일
update public.employees
   set contract_end_date =
       hire_date + make_interval(years => extract(year from age(date '2026-09-01', hire_date))::int + 1)
 where employment_type = '계약직'
   and status <> '퇴사';

-- 인턴: 입사 후 1년
update public.employees
   set contract_end_date = hire_date + interval '1 year'
 where employment_type = '인턴'
   and status <> '퇴사'
   and hire_date <= date '2026-09-01';

-- 강조 구간 재현 — D-2(임박) · 만료 경과 1건
update public.employees set contract_end_date = date '2026-09-03' where employee_no = 'GA24024';
update public.employees set contract_end_date = date '2026-08-27' where employee_no = 'GA22113';

-- 휴직 4명 복직예정일 — 30일 내 2 · 이후 1 · 경과 1
update public.employees set return_date = date '2026-09-15' where employee_no = 'GA14031';
update public.employees set return_date = date '2026-09-29' where employee_no = 'GA21086';
update public.employees set return_date = date '2026-12-01' where employee_no = 'GA24111';
update public.employees set return_date = date '2026-08-25' where employee_no = 'GA25051';

-- 비상연락망 — 사번 숫자 n 기준. n % 13 = 4 는 비워 둔다 (미기재 감지 재현)
with src as (
  select employee_no, (substring(employee_no from 3))::bigint as n
  from public.employees
)
update public.employees e
   set emergency_contact =
       (array['배우자', '부', '모', '형제·자매'])[(s.n % 4) + 1]
       || ' · 010-' || lpad(((s.n * 7919) % 10000)::text, 4, '0')
       || '-' || lpad(((s.n * 104729) % 10000)::text, 4, '0')
  from src s
 where s.employee_no = e.employee_no
   and s.n % 13 <> 4;

-- ---------------------------------------------------------------- 감사 로그 감시 필드 보강
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
    'residence', 'effective_date',
    'contract_end_date', 'return_date', 'emergency_contact'
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
