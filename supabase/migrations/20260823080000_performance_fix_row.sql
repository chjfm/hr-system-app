-- 성과 이력 351번째 건 추가
--
-- 최초 적재 때 시작일 2026-09-10 / 종료일 2026-01-20 으로 역전돼 있어 제외했던 건.
-- 원본 생성 스크립트의 연도 넘김 버그로 확인돼 시작일 2025-09-10 으로 정정됐다.
-- 350 → 351 건.

insert into public.performance (employee_no, project, role, started_on, ended_on, contribution)
values ('GA14125', '솔뫼제약 SNS 콘텐츠 시리즈', '촬영', '2025-09-10', '2026-01-20', '예산 10% 절감 운영')
on conflict do nothing;
