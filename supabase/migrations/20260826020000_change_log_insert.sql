-- 신규 등록도 감사 로그에 남긴다 (260826 9차 3단계)
--
-- 지금까지 change_log 는 UPDATE 만 잡았다 — "이 직원을 누가 언제 등록했는가"가
-- 로그에 없었다. 등록도 변경이력의 시작점이므로 INSERT 이벤트를 기록한다.

create or replace function public.log_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.change_log (employee_no, field, old_value, new_value, actor_email)
  values (new.employee_no, '신규 등록', null,
          new.name_ko || ' · ' || new.department || ' ' || new.position, public.actor());
  return new;
end;
$$;

drop trigger if exists employees_log_insert on public.employees;
create trigger employees_log_insert
  after insert on public.employees
  for each row execute function public.log_insert();
