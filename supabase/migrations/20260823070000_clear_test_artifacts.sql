-- 검증 과정에서 생긴 이력 정리
--
-- FK 제약·트리거를 실제로 확인하려면 진짜 UPDATE 를 날려야 했고, 그때마다 트리거가
-- 발령이력과 변경 기록을 남겼다. 데모 데이터에 "2026-09-01 재무팀 → 인사팀" 같은
-- 검증 흔적이 섞여 있으면 안 된다.
--
-- 시드 데이터는 actor_email 이 null 이고 검증분만 값이 있으므로 그것으로 구분한다.
-- 데모 중 실제로 만드는 기록은 이 마이그레이션 이후에 생기므로 영향받지 않는다.

delete from public.appointments where actor_email is not null;
delete from public.change_log;
