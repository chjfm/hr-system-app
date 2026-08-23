-- 발령일자 입력 지원 (HR 평가 개선안 #1)
--
-- 기존 트리거는 부서이동·승진·휴직·복직 이력을 current_date 로 기록했다.
-- 실무에서 발령일자는 거의 오늘이 아니다 — 9월 1일자 발령을 8월 23일에 입력하고,
-- 소급 입력도 흔하다. 발령일자가 틀리면 근속연수·승진연한·퇴직금 산정이 어긋난다.
--
-- employees.effective_date 에 "이번 변경의 발령일자"를 받아 트리거가 그 값을 쓴다.
-- 미입력이면 종전대로 current_date. 퇴사는 퇴사일 자체가 발령일자이므로 그대로 둔다.

alter table public.employees
  add column if not exists effective_date date;

comment on column public.employees.effective_date is
  '가장 최근 변경의 발령일자. 트리거가 발령이력의 일자로 사용한다.';

create or replace function public.log_appointment() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on date := coalesce(new.effective_date, current_date);
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
      -- 퇴사는 퇴사일이 곧 발령일자다
      insert into public.appointments (employee_no, appointed_on, kind, detail)
      values (new.employee_no, new.resign_date, '퇴사',
              new.department || ' ' || new.position || ' 퇴사');
    elsif new.status = '휴직' then
      insert into public.appointments (employee_no, appointed_on, kind, detail)
      values (new.employee_no, v_on, '휴직', '휴직 시작');
    elsif new.status = '재직' and old.status = '휴직' then
      insert into public.appointments (employee_no, appointed_on, kind, detail)
      values (new.employee_no, v_on, '복직', '휴직 종료 · 복직');
    end if;
  end if;

  -- 부서 이동
  if new.department is distinct from old.department then
    insert into public.appointments (employee_no, appointed_on, kind, detail)
    values (new.employee_no, v_on,'발령',
            old.department || ' → ' || new.department || ' 부서 이동');
  end if;

  -- 직급 변경
  if new.position is distinct from old.position then
    insert into public.appointments (employee_no, appointed_on, kind, detail)
    values (new.employee_no, v_on, '승진',
            old.position || ' → ' || new.position);
  end if;

  return new;
end;
$$;
