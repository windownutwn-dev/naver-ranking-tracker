#!/bin/sh
echo "=== [1] 시작 ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL 설정 여부: $([ -n "$DATABASE_URL" ] && echo 'YES' || echo 'NO')"

echo "=== [2] Prisma DB Push ==="
npx prisma db push --accept-data-loss
echo "DB Push 결과: $?"

echo "=== [3] Deploy Init ==="
npx tsx scripts/deploy-init.ts
echo "Deploy Init 결과: $?"

echo "=== [4] 서버 시작 ==="
exec node server.js
