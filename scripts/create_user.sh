#!/usr/bin/env bash
# 관리자용 계정 발급 (260826 2단계 — self-signup 제거의 대체 경로)
#
# 화면의 "계정 만들기"는 제거됐다 — 공개 URL에서 누구나 가입하면 곧 편집 권한이었다.
# 계정은 관리자가 이 스크립트로 발급한다. service_role 키가 필요하며,
# 이 키는 절대 .env.local(NEXT_PUBLIC_*)이나 커밋에 넣지 않는다.
#
# 사용법:
#   SUPABASE_SERVICE_ROLE_KEY=<service_role 키> bash scripts/create_user.sh <이메일> <비밀번호>
#
# 키 위치: Supabase 대시보드 → Project Settings → API keys → service_role
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -ne 2 ]; then
  echo "사용법: SUPABASE_SERVICE_ROLE_KEY=<키> bash scripts/create_user.sh <이메일> <비밀번호>" >&2
  exit 1
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다 (대시보드 → API keys → service_role)" >&2
  exit 1
fi

EMAIL="$1"
PASSWORD="$2"
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-)

echo "계정 발급: $EMAIL"
curl -s -X POST "$URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('id'):
    print('성공 —', d['email'])
else:
    print('실패 —', d)
    raise SystemExit(1)
"
