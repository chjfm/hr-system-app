-- 직원 사진 (260901 dev 지시서 1호 B3 — 체크리스트 2-2)
--
-- employees.photo_url + Storage 버킷 employee-photos(공개 읽기 · 쓰기 로그인).
-- 실사진 반입 금지 — 더미는 이름 첫 글자 + 사번 기반 색상의 SVG(data URI)로 생성한다.
-- 업로드하면 photo_url 이 스토리지 공개 URL로 바뀐다.

alter table public.employees
  add column if not exists photo_url text;

comment on column public.employees.photo_url is
  '프로필 사진 URL — 스토리지 공개 URL 또는 생성 더미(data:image/svg+xml)';

-- ---------------------------------------------------------------- 더미 아바타
with src as (
  select employee_no, name_ko, (substring(employee_no from 3))::bigint as n
  from public.employees
)
update public.employees e
   set photo_url = 'data:image/svg+xml;base64,' || replace(encode(convert_to(
         '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
         || '<rect width="96" height="96" rx="48" fill="hsl(' || ((s.n * 47) % 360)::text || ',38%,58%)"/>'
         || '<text x="48" y="61" font-size="38" font-family="Apple SD Gothic Neo, Malgun Gothic, sans-serif" '
         || 'font-weight="700" text-anchor="middle" fill="#ffffff">' || substring(s.name_ko from 1 for 1) || '</text>'
         || '</svg>', 'UTF8'), 'base64'), E'\n', '')
  from src s
 where s.employee_no = e.employee_no
   and e.photo_url is null;

-- ---------------------------------------------------------------- 스토리지 버킷
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-photos', 'employee-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos_public_read" on storage.objects;
create policy "photos_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'employee-photos');

drop policy if exists "photos_auth_insert" on storage.objects;
create policy "photos_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'employee-photos');

drop policy if exists "photos_auth_update" on storage.objects;
create policy "photos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'employee-photos') with check (bucket_id = 'employee-photos');

drop policy if exists "photos_auth_delete" on storage.objects;
create policy "photos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'employee-photos');

-- ---------------------------------------------------------------- 감사 로그 감시 필드 보강
create or replace function public.log_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := public.actor();
  v_field text;
  v_old   text;
  v_new   text;
begin
  foreach v_field in array array[
    'name_ko', 'name_en', 'company', 'department', 'position',
    'status', 'birth_date', 'hire_date', 'resign_date',
    'email', 'phone', 'hire_type', 'employment_type',
    'residence', 'effective_date',
    'contract_end_date', 'return_date', 'emergency_contact',
    'photo_url'
  ] loop
    execute format('select ($1).%I::text, ($2).%I::text', v_field, v_field)
      into v_old, v_new using old, new;

    if v_old is distinct from v_new then
      -- 사진은 URL 전문이 아니라 "변경됨"만 남긴다 — data URI 는 로그를 망친다
      if v_field = 'photo_url' then
        insert into public.change_log (employee_no, field, old_value, new_value, actor_email)
        values (new.employee_no, v_field,
                case when v_old is null then null else '(사진)' end,
                case when v_new is null then null else '(사진 변경)' end, v_actor);
      else
        insert into public.change_log (employee_no, field, old_value, new_value, actor_email)
        values (new.employee_no, v_field, v_old, v_new, v_actor);
      end if;
    end if;
  end loop;
  return new;
end;
$$;
