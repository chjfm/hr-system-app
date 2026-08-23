-- 직원 정보 관리 시스템 — 직원 대장 테이블
-- 공개 데모용. 실직원 정보는 절대 넣지 않는다 (가상 회사·가상 인물만).

create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  department      text not null,
  position        text not null,
  hire_date       date not null,
  employment_type text not null default '정규직'
                  check (employment_type in ('정규직', '계약직', '인턴', '파견')),
  status          text not null default '재직'
                  check (status in ('재직', '휴직', '퇴사')),
  resign_date     date,
  memo            text,
  created_at      timestamptz not null default now(),

  -- 퇴사일과 상태는 항상 함께 움직인다
  constraint resign_date_matches_status check (
    (status = '퇴사' and resign_date is not null) or
    (status <> '퇴사' and resign_date is null)
  ),
  -- 퇴사일이 입사일보다 앞설 수 없다
  constraint resign_after_hire check (
    resign_date is null or resign_date >= hire_date
  )
);

create index if not exists employees_department_idx on public.employees (department);
create index if not exists employees_status_idx      on public.employees (status);

-- ---------------------------------------------------------------- RLS
-- 로그인이 스코프에서 제외된 공개 데모이므로 익명 접근을 명시적으로 허용한다.
-- 정책이 없으면 RLS가 모든 요청을 차단해 "데이터가 안 보이는" 상태가 된다.
alter table public.employees enable row level security;

drop policy if exists "demo_anon_select" on public.employees;
drop policy if exists "demo_anon_insert" on public.employees;
drop policy if exists "demo_anon_update" on public.employees;
drop policy if exists "demo_anon_delete" on public.employees;

create policy "demo_anon_select" on public.employees
  for select to anon, authenticated using (true);

create policy "demo_anon_insert" on public.employees
  for insert to anon, authenticated with check (true);

create policy "demo_anon_update" on public.employees
  for update to anon, authenticated using (true) with check (true);

create policy "demo_anon_delete" on public.employees
  for delete to anon, authenticated using (true);

-- ---------------------------------------------------------------- 더미데이터
-- 가상 회사 "가온컴퍼니" 직원 10명. 실존 인물·실데이터 아님.
insert into public.employees (name, department, position, hire_date, employment_type, status, resign_date, memo)
values
  ('강도윤', '경영지원팀', '팀장',   '2019-03-04', '정규직', '재직', null, '경영지원 총괄'),
  ('노서진', '경영지원팀', '주임',   '2024-01-08', '정규직', '재직', null, null),
  ('명하람', '인사팀',     '책임',   '2021-07-01', '정규직', '재직', null, '채용·평가 담당'),
  ('배윤슬', '인사팀',     '사원',   '2025-03-17', '계약직', '재직', null, '2026-03 계약 만료 예정'),
  ('서주하', '기획팀',     '수석',   '2018-05-14', '정규직', '재직', null, '신규 서비스 기획'),
  ('오시현', '기획팀',     '대리',   '2022-09-19', '정규직', '휴직', null, '육아휴직 (2026-11 복직 예정)'),
  ('유건우', '개발팀',     '팀장',   '2020-02-03', '정규직', '재직', null, '백엔드'),
  ('임세아', '개발팀',     '사원',   '2025-06-02', '인턴',   '재직', null, '프론트엔드 인턴'),
  ('정민찬', '디자인팀',   '책임',   '2021-11-15', '정규직', '재직', null, 'BX 디자인'),
  ('최나영', '디자인팀',   '대리',   '2022-04-11', '정규직', '퇴사', '2026-06-30', '개인 사유 퇴사')
on conflict do nothing;
