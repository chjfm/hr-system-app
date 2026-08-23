-- 직원 정보 관리 시스템 — 직원 대장 + 발령이력
-- 기획: docs/[내부·기획] 직원정보관리_UX시나리오_260823.md (R1~R10)
--
-- 이 파일은 scripts/gen_migration.py 가 data/*.json 에서 생성한다. 직접 고치지 말 것.
-- 공개 배포이므로 회사 식별자는 가상값으로 치환돼 있다 (사람은 원래부터 가상).
-- R9: 주민번호·병역·장애 등 민감 항목은 스키마에 두지 않는다.

drop table if exists public.appointments cascade;
drop table if exists public.employees cascade;

-- ---------------------------------------------------------------- 직원 대장
create table public.employees (
  id           uuid primary key default gen_random_uuid(),
  employee_no  text not null unique,                        -- 사번
  name_ko      text not null,                               -- 한글성명
  name_en      text,                                        -- 영문성명
  status       text not null default '재직'                 -- 재직구분
               check (status in ('재직', '휴직', '퇴사')),
  company      text not null,                               -- 소속
  department   text not null,                               -- 부서명
  position     text not null,                               -- 직급
  birth_date   date,                                        -- 생년월일
  hire_date    date not null,                               -- 입사일
  resign_date  date,                                        -- 퇴사일
  email        text,                                        -- 메일계정
  phone        text,                                        -- 휴대전화
  hire_type    text check (hire_type in ('신입', '경력')),  -- 채용구분
  created_at   timestamptz not null default now(),

  -- R6: 퇴사면 퇴사일이 반드시 있고, 퇴사가 아니면 퇴사일이 없다
  constraint resign_date_matches_status check (
    (status = '퇴사' and resign_date is not null) or
    (status <> '퇴사' and resign_date is null)
  ),
  constraint resign_after_hire check (
    resign_date is null or resign_date >= hire_date
  )
);

create index employees_status_idx     on public.employees (status);
create index employees_department_idx on public.employees (department);
create index employees_company_idx    on public.employees (company);

-- ---------------------------------------------------------------- 발령이력 (R8)
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  employee_no  text not null references public.employees (employee_no)
               on update cascade on delete cascade,
  appointed_on date not null,                                -- 발령일자
  kind         text not null                                 -- 발령종류
               check (kind in ('입사', '승진', '발령', '휴직', '복직', '퇴사')),
  detail       text not null,                                -- 발령내용
  created_at   timestamptz not null default now()
);

create index appointments_employee_idx on public.appointments (employee_no, appointed_on);

-- ---------------------------------------------------------------- 더미데이터
insert into public.employees
  (employee_no, name_ko, name_en, status, company, department, position,
   birth_date, hire_date, resign_date, email, phone, hire_type)
values
  ('GA23001', '강지민', 'Jimin Kang', '재직', '본사', '경영지원팀', '부장', '1988-02-27', '2023-05-11', null, 'jimin.kang0@gaon.co.kr', '010-3954-5455', '경력'),
  ('GA25002', '전선우', 'Sunwoo Jeon', '재직', '본사', '재무팀', '대리', '1984-07-26', '2025-07-06', null, 'sunwoo.jeon1@gaon.co.kr', '010-8677-5542', '신입'),
  ('GA20003', '최서준', 'Seojun Choi', '재직', '본사', '기술연구소', '주임', '1999-06-26', '2020-08-18', null, 'seojun.choi2@gaon.co.kr', '010-5525-2820', '신입'),
  ('GA24004', '신재원', 'Jaewon Shin', '재직', '가온플러스', '사업 2팀', '사원', '1990-08-14', '2024-11-21', null, 'jaewon.shin3@gaon.co.kr', '010-6953-5239', '경력'),
  ('GA18005', '조예린', 'Yerin Cho', '퇴사', '가온랩', '총무팀', '부장', '1983-05-27', '2018-11-19', '2023-04-05', 'yerin.cho4@gaon.co.kr', '010-7349-8123', '경력'),
  ('GA15006', '김예린', 'Yerin Kim', '재직', '가온스튜디오', '제작 2팀', '대리', '1978-01-24', '2015-11-04', null, 'yerin.kim5@gaon.co.kr', '010-2023-6502', '경력'),
  ('GA22007', '홍준서', 'Junseo Hong', '재직', '가온스튜디오', '제작 2팀', '이사', '1996-02-16', '2022-02-15', null, 'junseo.hong6@gaon.co.kr', '010-3308-4551', '신입'),
  ('GA15008', '홍현우', 'Hyunwoo Hong', '재직', '본사', '기술연구소', '대리', '1991-01-09', '2015-07-18', null, 'hyunwoo.hong7@gaon.co.kr', '010-7034-1326', '경력'),
  ('GA18009', '서하린', 'Harin Seo', '휴직', '본사', '인사팀', '부장', '1981-11-02', '2018-08-11', null, 'harin.seo8@gaon.co.kr', '010-2572-4149', '경력'),
  ('GA17010', '장은우', 'Eunwoo Jang', '재직', '본사', '기술연구소', '이사', '1991-01-03', '2017-10-21', null, 'eunwoo.jang9@gaon.co.kr', '010-6618-2423', '경력'),
  ('GA16011', '김나윤', 'Nayun Kim', '재직', '가온랩', '총무팀', '주임', '1980-02-25', '2016-03-27', null, 'nayun.kim10@gaon.co.kr', '010-5107-9809', '경력'),
  ('GA19012', '한예린', 'Yerin Han', '재직', '가온플러스', '사업 3팀', '부장', '1984-03-01', '2019-05-16', null, 'yerin.han11@gaon.co.kr', '010-7391-8490', '경력'),
  ('GA21013', '강시은', 'Sieun Kang', '재직', '본사', '인사팀', '대리', '1995-12-20', '2021-01-12', null, 'sieun.kang12@gaon.co.kr', '010-3346-4532', '경력'),
  ('GA15014', '안유진', 'Yujin Ahn', '재직', '본사', '기술연구소', '부장', '1982-10-16', '2015-01-15', null, 'yujin.ahn13@gaon.co.kr', '010-5063-2723', '신입'),
  ('GA22015', '서주원', 'Juwon Seo', '휴직', '본사', '경영지원팀', '과장', '1983-02-04', '2022-12-24', null, 'juwon.seo14@gaon.co.kr', '010-7523-5983', '신입'),
  ('GA23016', '오시우', 'Siwoo Oh', '재직', '가온랩', '총무팀', '이사', '1985-12-11', '2023-05-06', null, 'siwoo.oh15@gaon.co.kr', '010-5397-7617', '경력'),
  ('GA18017', '황지호', 'Jiho Hwang', '재직', '본사', '인사팀', '이사', '1983-11-22', '2018-12-20', null, 'jiho.hwang16@gaon.co.kr', '010-4532-7970', '신입'),
  ('GA21018', '안우진', 'Woojin Ahn', '재직', '가온스튜디오', '제작 1팀', '사원', '1997-05-02', '2021-02-10', null, 'woojin.ahn17@gaon.co.kr', '010-5116-6783', '경력'),
  ('GA16019', '강승현', 'Seunghyun Kang', '퇴사', '가온플러스', '사업 3팀', '이사', '1981-12-27', '2016-12-02', '2026-11-01', 'seunghyun.kang18@gaon.co.kr', '010-4728-7796', '경력'),
  ('GA16020', '강은우', 'Eunwoo Kang', '재직', '가온플러스', '사업 2팀', '과장', '1997-04-18', '2016-07-02', null, 'eunwoo.kang19@gaon.co.kr', '010-7363-1153', '경력'),
  ('GA20021', '송선우', 'Sunwoo Song', '재직', '가온플러스', '사업 3팀', '부장', '1995-01-15', '2020-06-06', null, 'sunwoo.song20@gaon.co.kr', '010-5556-4818', '경력'),
  ('GA21022', '조서연', 'Seoyeon Cho', '재직', '가온플러스', '사업 3팀', '대리', '1993-10-24', '2021-02-26', null, 'seoyeon.cho21@gaon.co.kr', '010-7828-1466', '경력'),
  ('GA24023', '강지아', 'Jia Kang', '재직', '가온플러스', '사업 3팀', '사원', '1989-02-20', '2024-01-27', null, 'jia.kang22@gaon.co.kr', '010-3885-9041', '신입'),
  ('GA22024', '이수빈', 'Subin Lee', '재직', '가온스튜디오', '제작 2팀', '주임', '1981-06-16', '2022-09-24', null, 'subin.lee23@gaon.co.kr', '010-9192-7692', '경력'),
  ('GA20025', '정서준', 'Seojun Jung', '퇴사', '가온스튜디오', '제작 1팀', '주임', '1998-04-19', '2020-08-01', '2022-08-01', 'seojun.jung24@gaon.co.kr', '010-8630-2968', '경력'),
  ('GA23026', '윤나윤', 'Nayun Yoon', '재직', '가온플러스', '사업 1팀', '주임', '1982-08-01', '2023-09-12', null, 'nayun.yoon25@gaon.co.kr', '010-2204-2625', '신입'),
  ('GA22027', '박유진', 'Yujin Park', '퇴사', '가온랩', '총무팀', '대리', '1980-05-24', '2022-11-17', '2024-01-06', 'yujin.park26@gaon.co.kr', '010-4715-8040', '경력'),
  ('GA18028', '강하은', 'Haeun Kang', '재직', '본사', '경영지원팀', '차장', '1991-04-02', '2018-07-24', null, 'haeun.kang27@gaon.co.kr', '010-5963-4304', '신입'),
  ('GA25029', '윤준서', 'Junseo Yoon', '재직', '가온스튜디오', '제작 2팀', '이사', '1995-12-23', '2025-06-20', null, 'junseo.yoon28@gaon.co.kr', '010-7491-4266', '경력'),
  ('GA16030', '홍서준', 'Seojun Hong', '재직', '가온스튜디오', '제작 2팀', '차장', '1996-06-21', '2016-08-19', null, 'seojun.hong29@gaon.co.kr', '010-7310-3020', '경력');

insert into public.appointments (employee_no, appointed_on, kind, detail)
values
  ('GA23001', '2023-05-11', '입사', '경영지원팀 부장 입사'),
  ('GA25002', '2025-07-06', '입사', '재무팀 대리 입사'),
  ('GA25002', '2026-10-16', '승진', '주임 → 대리 승진'),
  ('GA20003', '2020-08-18', '입사', '기술연구소 주임 입사'),
  ('GA24004', '2024-11-21', '입사', '사업 2팀 사원 입사'),
  ('GA18005', '2018-11-19', '입사', '총무팀 부장 입사'),
  ('GA18005', '2023-04-05', '퇴사', '계약 만료'),
  ('GA15006', '2015-11-04', '입사', '제작 2팀 대리 입사'),
  ('GA22007', '2022-02-15', '입사', '제작 2팀 이사 입사'),
  ('GA15008', '2015-07-18', '입사', '기술연구소 대리 입사'),
  ('GA18009', '2018-08-11', '입사', '인사팀 부장 입사'),
  ('GA18009', '2025-03-08', '휴직', '육아휴직'),
  ('GA17010', '2017-10-21', '입사', '기술연구소 이사 입사'),
  ('GA16011', '2016-03-27', '입사', '총무팀 주임 입사'),
  ('GA19012', '2019-05-16', '입사', '사업 3팀 부장 입사'),
  ('GA19012', '2022-04-02', '승진', '차장 → 부장 승진'),
  ('GA21013', '2021-01-12', '입사', '인사팀 대리 입사'),
  ('GA15014', '2015-01-15', '입사', '기술연구소 부장 입사'),
  ('GA15014', '2016-03-08', '승진', '차장 → 부장 승진'),
  ('GA22015', '2022-12-24', '입사', '경영지원팀 과장 입사'),
  ('GA22015', '2025-07-09', '휴직', '육아휴직'),
  ('GA23016', '2023-05-06', '입사', '총무팀 이사 입사'),
  ('GA23016', '2026-10-06', '승진', '부장 → 이사 승진'),
  ('GA18017', '2018-12-20', '입사', '인사팀 이사 입사'),
  ('GA18017', '2021-07-21', '승진', '부장 → 이사 승진'),
  ('GA21018', '2021-02-10', '입사', '제작 1팀 사원 입사'),
  ('GA16019', '2016-12-02', '입사', '사업 3팀 이사 입사'),
  ('GA16019', '2019-07-06', '승진', '부장 → 이사 승진'),
  ('GA16019', '2026-11-01', '퇴사', '이직 퇴직'),
  ('GA16020', '2016-07-02', '입사', '사업 2팀 과장 입사'),
  ('GA20021', '2020-06-06', '입사', '사업 3팀 부장 입사'),
  ('GA20021', '2024-05-08', '승진', '차장 → 부장 승진'),
  ('GA21022', '2021-02-26', '입사', '사업 3팀 대리 입사'),
  ('GA24023', '2024-01-27', '입사', '사업 3팀 사원 입사'),
  ('GA22024', '2022-09-24', '입사', '제작 2팀 주임 입사'),
  ('GA20025', '2020-08-01', '입사', '제작 1팀 주임 입사'),
  ('GA20025', '2021-02-26', '승진', '사원 → 주임 승진'),
  ('GA20025', '2022-08-01', '퇴사', '개인 사유 퇴직'),
  ('GA23026', '2023-09-12', '입사', '사업 1팀 주임 입사'),
  ('GA22027', '2022-11-17', '입사', '총무팀 대리 입사'),
  ('GA22027', '2024-01-06', '퇴사', '개인 사유 퇴직'),
  ('GA18028', '2018-07-24', '입사', '경영지원팀 차장 입사'),
  ('GA18028', '2022-11-26', '승진', '과장 → 차장 승진'),
  ('GA25029', '2025-06-20', '입사', '제작 2팀 이사 입사'),
  ('GA16030', '2016-08-19', '입사', '제작 2팀 차장 입사'),
  ('GA16030', '2018-05-12', '승진', '과장 → 차장 승진');

-- ---------------------------------------------------------------- 이력 자동기록 (R3·R4·R5)
-- 수기 기록을 없애는 것이 이 시스템의 핵심이므로, 앱이 아니라 DB에서 보장한다.
create or replace function public.log_appointment() returns trigger
language plpgsql as $$
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

create trigger employees_log_insert
  after insert on public.employees
  for each row execute function public.log_appointment();

create trigger employees_log_update
  after update on public.employees
  for each row execute function public.log_appointment();

-- ---------------------------------------------------------------- RLS
-- 로그인이 스코프에서 제외된 공개 데모라 익명 접근을 명시적으로 허용한다.
-- 정책이 없으면 RLS가 모든 요청을 차단해 "데이터가 안 보이는" 상태가 된다.
-- R10: 삭제 없음 — delete 정책을 만들지 않는다. 퇴사도 상태 변경으로만 처리한다.
alter table public.employees    enable row level security;
alter table public.appointments enable row level security;

create policy "demo_select" on public.employees
  for select to anon, authenticated using (true);
create policy "demo_insert" on public.employees
  for insert to anon, authenticated with check (true);
create policy "demo_update" on public.employees
  for update to anon, authenticated using (true) with check (true);

create policy "demo_select" on public.appointments
  for select to anon, authenticated using (true);
