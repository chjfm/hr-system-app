#!/usr/bin/env bash
# 데모 계정 재생성.
#
# 주의: `supabase db reset --linked` 는 auth 스키마까지 초기화해서 로그인 계정이
# 전부 지워진다. 마이그레이션에는 계정이 들어 있지 않으므로 reset 후에는 반드시
# 이 스크립트를 다시 돌려야 로그인이 된다.
#
# 사용법: bash scripts/seed_demo_user.sh
set -euo pipefail

cd "$(dirname "$0")/.."

EMAIL="hr.demo@gaon.co.kr"
PASSWORD="GaonDemo2026!"

URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2-)
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env.local | cut -d= -f2-)

echo "데모 계정 생성: $EMAIL"
curl -s -X POST "$URL/auth/v1/signup" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null

echo -n "로그인 확인: "
curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
if d.get('access_token'):
    print('성공 —', d['user']['email'])
else:
    print('실패 —', d)
    raise SystemExit(1)
"
