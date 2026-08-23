-- 부서 마스터 (R13)
--
-- 부서명이 자유 텍스트라 '인사팀'과 '인사 팀'이 공존할 수 있었다. 엑셀의 문제를
-- 그대로 옮겨온 셈이라, 오전에는 마스터 없이 경고만 띄우는 절충안을 썼다.
-- HR 패널 2차 평가에서 마스터 도입으로 결론이 나 자유 입력을 폐지한다.
--
-- 승격 전 검증: employees 부서명 10종이 각각 정확히 한 소속에만 속하고
-- (1:N 없음), 공백 제거 후 중복 표기 0건. 발령이력 190건의 부서명 문자열도
-- 이 10종과 정확히 일치한다.

create table if not exists public.departments (
  code       text primary key,
  name       text not null unique,
  company    text not null,
  sort_order int  not null default 0,
  -- 폐지된 부서는 지우지 않고 내린다. 삭제하면 과거 발령이력의 부서명이 깨진다.
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.departments is
  '부서 마스터. 신규 등록·수정 화면은 여기서만 부서를 고를 수 있다.';
comment on column public.departments.active is
  '폐지 부서는 false. 과거 이력 보존을 위해 행을 삭제하지 않는다.';

insert into public.departments (code, name, company, sort_order) values
  ('HQ-01', '경영지원팀',  '본사',         10),
  ('HQ-02', '인사팀',      '본사',         20),
  ('HQ-03', '재무팀',      '본사',         30),
  ('HQ-04', '기술연구소',  '본사',         40),
  ('GP-01', '사업 1팀',    '가온플러스',   50),
  ('GP-02', '사업 2팀',    '가온플러스',   60),
  ('GP-03', '사업 3팀',    '가온플러스',   70),
  ('GS-01', '제작 1팀',    '가온스튜디오', 80),
  ('GS-02', '제작 2팀',    '가온스튜디오', 90),
  ('GL-01', '총무팀',      '가온랩',      100)
on conflict (code) do nothing;

-- 마스터에 없는 부서명이 employees 에 남아 있으면 이 제약이 실패한다.
-- 조용히 넘어가는 것보다 마이그레이션이 깨지는 편이 낫다.
alter table public.employees
  drop constraint if exists employees_department_fkey;

alter table public.employees
  add constraint employees_department_fkey
  foreign key (department) references public.departments (name)
  on update cascade;

-- ---------------------------------------------------------------- RLS
-- 다른 표와 같은 원칙: 읽기는 공개, 쓰기는 로그인.
alter table public.departments enable row level security;

create policy "read_departments" on public.departments
  for select to anon, authenticated using (true);
create policy "auth_write_departments" on public.departments
  for insert to authenticated with check (true);
create policy "auth_update_departments" on public.departments
  for update to authenticated using (true) with check (true);
