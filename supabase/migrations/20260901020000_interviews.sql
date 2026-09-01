-- 면담 기록 (260901 dev 지시서 1호 B1 — 체크리스트 3-6 · 성장카드 설계 260901 부가층)
--
-- 1차의 핵심: 성장관리에서 유일하게 선행 없이 쌓을 수 있는 축. 면담은 당사자 동기가
-- 아니라 인사팀 관제 항목이므로(설계 260901) 성장 탭 하단·현황 A4 진행률의 입력이 된다.
-- 100일/1년 알림은 2차 — 여기는 기록 CRUD까지.

create table if not exists public.interviews (
  id           uuid primary key default gen_random_uuid(),
  employee_no  text not null references public.employees (employee_no)
               on update cascade on delete cascade,
  held_on      date not null,                             -- 면담 일자
  kind         text not null                              -- 유형 6종 (지시서 B1)
               check (kind in ('100일', '1년', '수습', '정기', '퇴사', '수시')),
  interviewer  text not null,                             -- 면담자 (이름 자유 입력)
  memo         text,                                      -- 메모
  next_on      date,                                      -- 다음 면담 예정일
  created_by   text,                                      -- 등록 계정 (JWT email)
  created_at   timestamptz not null default now(),

  constraint interviews_next_after_held check (next_on is null or next_on >= held_on)
);

create index if not exists interviews_employee_idx
  on public.interviews (employee_no, held_on desc);

comment on table public.interviews is
  '면담 기록 — 인사카드 성장 탭. 100일/1년/수습/정기/퇴사/수시. 알림 발송은 2차.';

-- 등록 계정은 클라이언트가 아니라 DB가 채운다 — 변경자 기록과 같은 원칙
create or replace function public.stamp_created_by() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := public.actor();
  end if;
  return new;
end;
$$;

drop trigger if exists interviews_stamp on public.interviews;
create trigger interviews_stamp
  before insert on public.interviews
  for each row execute function public.stamp_created_by();

-- ---------------------------------------------------------------- RLS
-- 읽기 공개(데모) · 쓰기·수정·삭제는 로그인
alter table public.interviews enable row level security;

create policy "read_interviews" on public.interviews
  for select to anon, authenticated using (true);
create policy "auth_insert_interviews" on public.interviews
  for insert to authenticated with check (true);
create policy "auth_update_interviews" on public.interviews
  for update to authenticated using (true) with check (true);
create policy "auth_delete_interviews" on public.interviews
  for delete to authenticated using (true);

-- ---------------------------------------------------------------- 데모 기록
-- 결정적 규칙(사번 숫자 n). 현원 중 n % 5 <> 0 인 사람에게 정기 면담 1건(2026 상반기 또는 하반기),
-- 2025-09 이후 입사자는 100일 면담, 근속 1년차(2025 입사)는 1년 면담. n % 5 = 0 은 무기록(공백 감지 재현).
create temp view src as
  select employee_no, (substring(employee_no from 3))::bigint as n, hire_date, status, resign_date
  from public.employees
  where status <> '퇴사' or resign_date > date '2026-09-01';

insert into public.interviews (employee_no, held_on, kind, interviewer, memo, next_on)
select employee_no,
       date '2026-02-02' + ((n * 31) % 200)::int,
       '정기',
       (array['김민준 팀장', '이서연 인사팀', '박지훈 본부장', '최수아 인사팀'])[(n % 4) + 1],
       (array['업무 적응 양호 · 하반기 목표 합의', '역할 확대 의사 확인', '협업 이슈 청취 · 후속 조치 예정', '교육 지원 요청 접수'])[(n % 4) + 1],
       case when n % 3 = 0 then date '2026-02-02' + ((n * 31) % 200)::int + 180 else null end
  from src
 where n % 5 <> 0
   and hire_date <= date '2026-02-01';

insert into public.interviews (employee_no, held_on, kind, interviewer, memo, next_on)
select employee_no,
       hire_date + 100,
       '100일',
       '이서연 인사팀',
       '입사 100일 면담 — 온보딩 점검',
       hire_date + interval '1 year'
  from src
 where n % 5 <> 0
   and hire_date >= date '2025-09-01'
   and hire_date + 100 <= date '2026-09-01';

insert into public.interviews (employee_no, held_on, kind, interviewer, memo, next_on)
select employee_no,
       hire_date + interval '1 year',
       '1년',
       '박지훈 본부장',
       '입사 1년 면담 — 역할·성장 목표 점검',
       null
  from src
 where n % 5 <> 0
   and hire_date between date '2025-01-01' and date '2025-08-31';

drop view src;
