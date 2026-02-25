#!/bin/bash
set -e

DEPLOY_DIR="/home/ubuntu/app"
SERVICE_NAME="devths-fe"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ApplicationStop: $SERVICE_NAME 교체 준비"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "$DEPLOY_DIR/docker-compose.yml" ]; then
    cd "$DEPLOY_DIR"

    # 1. 특정 서비스만 중지 및 삭제
    echo "🛑 $SERVICE_NAME 컨테이너를 중지합니다..."
    docker compose stop $SERVICE_NAME || true
    docker compose rm -f $SERVICE_NAME || true

    # 2. 사용하지 않는 이미지 정리
    docker image prune -f || true
else
    echo "⚠️ docker-compose.yml이 없습니다."
fi

echo "✅ $SERVICE_NAME 정리 완료"