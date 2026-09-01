-- 부서 명칭 수정 RPC (260901 dev 지시서 1호 B7 — 조직도 명칭 수정)
--
-- departments.name 을 바꾸면 employees.department 가 FK cascade 로 따라오는데, 그 UPDATE 가
-- employees 의 발령 트리거(log_appointment)를 깨워 "A → B 부서 이동" 발령이 소속 인원 전원에게
-- 생긴다. 명칭 변경은 발령이 아니다 — 260901 검증에서 9명 × 2회 = 18건이 실제로 생겨 이 파일로 막는다.
--
-- 방법: RPC 안에서 트랜잭션 로컬 설정(app.dept_rename)을 켜고, 발령 트리거가 그 설정을 보면
-- 부서 이동 발령만 건너뛴다. 감사 로그(change_log)는 그대로 남긴다 — 값이 바뀐 사실은 기록 대상.

create or replace function public.log_appointment() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on    date := coalesce(new.effective_date, current_date);
  v_actor text := public.actor();
  -- 부서 명칭 변경(FK cascade)으로 들어온 UPDATE 인가
  v_rename boolean := coalesce(current_setting('app.dept_rename', true), '') = '1';
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

  if new.department is distinct from old.department and not v_rename then
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

-- 명칭 수정은 이 함수로만 — 로그인 사용자만 호출 가능(RLS 대신 함수 권한으로)
create or replace function public.rename_department(p_code text, p_name text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.actor() is null then
    raise exception '로그인이 필요합니다';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception '부서명은 비울 수 없습니다';
  end if;
  perform set_config('app.dept_rename', '1', true);   -- 트랜잭션 로컬
  update public.departments set name = btrim(p_name) where code = p_code;
  if not found then
    raise exception '부서 코드 % 가 없습니다', p_code;
  end if;
end;
$$;

revoke all on function public.rename_department(text, text) from public, anon;
grant execute on function public.rename_department(text, text) to authenticated;

-- ---------------------------------------------------------------- 260901 검증 잔재 정리
-- 위 결함으로 생긴 발령 18건(총무팀 ↔ 총무·시설팀)과 같은 시각의 감사 로그를 지운다.
delete from public.appointments
 where appointed_on = date '2026-09-01'
   and kind = '발령'
   and detail in ('총무팀 → 총무·시설팀 부서 이동', '총무·시설팀 → 총무팀 부서 이동');

delete from public.change_log
 where field = 'department'
   and changed_at >= date '2026-09-01'
   and (old_value, new_value) in (('총무팀', '총무·시설팀'), ('총무·시설팀', '총무팀'));
