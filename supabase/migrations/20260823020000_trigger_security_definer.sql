-- 발령이력 자동기록이 RLS에 막히던 문제 수정
--
-- log_appointment() 는 기본값인 SECURITY INVOKER 로 만들어져 호출자(anon) 권한으로
-- 실행됐다. appointments 에는 select 정책만 있으므로 트리거의 insert 가 차단되어
-- 직원 정보 수정 자체가 실패했다 (42501 → 401).
--
-- appointments 에 anon insert 정책을 여는 대신 함수를 SECURITY DEFINER 로 바꾼다.
-- 이력은 시스템만 기록해야 하고(R8), 정책을 열면 클라이언트가 이력을 위조할 수 있다.
-- 결과적으로 appointments 는 읽기 전용으로 남고 쓰기 경로는 트리거 하나뿐이다.

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
