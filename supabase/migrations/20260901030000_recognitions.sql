-- 인정 이력 (260901 dev 지시서 1호 B2 — 체크리스트 3-8 수상이력 · 성장카드 설계 260901 "인정 = 축")
--
-- 평가 점수·등급이 아니라 "한 일이 보였다는 증거"를 쌓는다. 가산 규칙은 평가제도 설계 시(로드맵 미결값).
-- 유형 5종은 지시서 B2 그대로. 후배 육성 배출 등 확장은 2차.

create table if not exists public.recognitions (
  id             uuid primary key default gen_random_uuid(),
  employee_no    text not null references public.employees (employee_no)
                 on update cascade on delete cascade,
  awarded_on     date not null,                            -- 일자
  kind           text not null                             -- 유형 5종
                 check (kind in ('사내 수상', '대외 수상', '대외 활동', '클라이언트 인정', '리더 인정')),
  title          text not null,                            -- 제목
  project        text,                                     -- 관련 프로젝트
  registered_by  text,                                     -- 등록자 (JWT email · 시드는 표시용 이름)
  created_at     timestamptz not null default now()
);

create index if not exists recognitions_employee_idx
  on public.recognitions (employee_no, awarded_on desc);

comment on table public.recognitions is
  '인정 이력 — 사내/대외 수상 · 대외 활동 · 클라이언트/리더 인정. 성장카드 인정 축의 1차 원천.';

-- 등록자는 DB가 채운다 (interviews 와 같은 함수 재사용 — 컬럼명이 달라 별도 함수)
create or replace function public.stamp_registered_by() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.registered_by is null then
    new.registered_by := public.actor();
  end if;
  return new;
end;
$$;

drop trigger if exists recognitions_stamp on public.recognitions;
create trigger recognitions_stamp
  before insert on public.recognitions
  for each row execute function public.stamp_registered_by();

-- ---------------------------------------------------------------- RLS
alter table public.recognitions enable row level security;

create policy "read_recognitions" on public.recognitions
  for select to anon, authenticated using (true);
create policy "auth_insert_recognitions" on public.recognitions
  for insert to authenticated with check (true);
create policy "auth_update_recognitions" on public.recognitions
  for update to authenticated using (true) with check (true);
create policy "auth_delete_recognitions" on public.recognitions
  for delete to authenticated using (true);

-- ---------------------------------------------------------------- 데모 기록
-- 결정적 규칙(사번 숫자 n). 현원 중 n % 3 = 1 에게 1건, n % 7 = 2 에게 1건 더 — 0~2건 분포.
create temp view src as
  select employee_no, (substring(employee_no from 3))::bigint as n, hire_date
  from public.employees
  where status <> '퇴사' or resign_date > date '2026-09-01';

insert into public.recognitions (employee_no, awarded_on, kind, title, project, registered_by)
select employee_no,
       date '2025-06-01' + ((n * 17) % 450)::int,
       (array['사내 수상', '대외 수상', '대외 활동', '클라이언트 인정', '리더 인정'])[(n % 5) + 1],
       (array['하반기 우수사원상', '광고제 브론즈 — 브랜디드 콘텐츠', '업계 세미나 연사', '클라이언트 감사 서한 — 론칭 행사', '분기 리더 추천 — 협업 기여'])[(n % 5) + 1],
       (array['신제품 론칭 캠페인', '국제 포럼 운영', '브랜드 팝업 스토어', null, '사내 프로세스 개선'])[(n % 5) + 1],
       '시드 · 인사팀'
  from src
 where n % 3 = 1
   and hire_date <= date '2025-06-01';

insert into public.recognitions (employee_no, awarded_on, kind, title, project, registered_by)
select employee_no,
       date '2026-01-15' + ((n * 23) % 220)::int,
       (array['리더 인정', '클라이언트 인정', '사내 수상'])[(n % 3) + 1],
       (array['프로젝트 완수 리더 인정', '클라이언트 재계약 기여 인정', '상반기 협업상'])[(n % 3) + 1],
       (array['연간 대행 계약', '전시 부스 운영', '영상 시리즈 제작'])[(n % 3) + 1],
       '시드 · 인사팀'
  from src
 where n % 7 = 2;

drop view src;
