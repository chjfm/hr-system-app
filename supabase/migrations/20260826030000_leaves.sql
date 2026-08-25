-- 연차 사용 기록 (260826 9차 4단계 — 잔여연차 조회까지가 1차 범위)
--
-- 발생(부여)은 저장하지 않는다 — 근로기준법 기본 산식(입사일 기준)으로 화면에서
-- 계산한다. 저장하면 산정 기준이 인터뷰에서 바뀔 때(회계연도 기준 등) 데이터가
-- 거짓이 된다. 여기는 사용·조정 "사건"만 쌓는다.
--   · 사용: 잔여에서 차감 (반차 0.5 허용)
--   · 조정: 이월·특별부여 등 가산 (음수 허용)

create table if not exists public.leaves (
  id           uuid primary key default gen_random_uuid(),
  employee_no  text not null references public.employees (employee_no)
               on update cascade on delete cascade,
  kind         text not null check (kind in ('사용', '조정')),
  days         numeric(4, 1) not null,
  used_on      date not null,
  note         text
);

create index if not exists leaves_employee_idx
  on public.leaves (employee_no, used_on desc);

comment on table public.leaves is
  '연차 사용·조정 기록. 발생은 산식으로 계산 — 산정 기준은 인사팀 인터뷰에서 확정.';

alter table public.leaves enable row level security;

create policy "read_leaves" on public.leaves
  for select to anon, authenticated using (true);
create policy "auth_insert_leaves" on public.leaves
  for insert to authenticated with check (true);
create policy "auth_update_leaves" on public.leaves
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------- 데모 사용 기록
-- 결정적 규칙(사번 숫자 기반)이라 재실행해도 같은 분포가 나온다.
-- 재직·휴직자에게 0~8건, 2026년 안에서 입사일 이후 날짜만. 5건 중 1건은 반차.
insert into public.leaves (employee_no, kind, days, used_on, note)
select e.employee_no,
       '사용',
       case when (e.n + s.i) % 5 = 0 then 0.5 else 1 end,
       d.used_on,
       case when (e.n + s.i) % 5 = 0 then '반차' else '연차' end
from (
  select employee_no,
         (substring(employee_no from 3))::int as n,
         hire_date
  from public.employees
  where status <> '퇴사'
) e
cross join generate_series(1, 8) as s(i)
cross join lateral (
  select date '2026-01-02' + ((e.n * 37 + s.i * 29) % 234) as used_on
) d
where s.i <= (e.n % 9)
  and d.used_on >= e.hire_date
  and d.used_on <= date '2026-08-25';
