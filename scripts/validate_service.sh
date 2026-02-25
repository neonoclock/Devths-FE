#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ValidateService: 헬스체크 완료 대기"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DEPLOY_DIR="/home/ubuntu/app"

# ========================================
# 1. 컨테이너 헬스체크 (App 준비 확인)
# ========================================
echo ""
echo "==> 1단계: 로컬 컨테이너 헬스체크"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

APP_PORT=3000
HEALTH_CHECK_ENDPOINT="/"

MAX_RETRIES=60
RETRY_COUNT=0
RETRY_INTERVAL=2

echo "🔍 엔드포인트: http://localhost:$APP_PORT$HEALTH_CHECK_ENDPOINT"
echo "⏱️ 최대 대기 시간: $((MAX_RETRIES * RETRY_INTERVAL))초"
echo ""

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT$HEALTH_CHECK_ENDPOINT 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "304" ]; then
        echo "✅ 로컬 헬스체크 통과 (HTTP $HTTP_CODE)"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "⏳ 재시도 $RETRY_COUNT/$MAX_RETRIES (HTTP $HTTP_CODE) - ${RETRY_INTERVAL}초 후 재시도..."
    sleep $RETRY_INTERVAL
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ 로컬 헬스체크 타임아웃 실패"
    echo "컨테이너 로그 확인:"
    docker logs devths-fe --tail 100 || true
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ValidateService 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
