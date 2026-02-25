#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ApplicationStart: Docker 컨테이너 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DEPLOY_DIR="/home/ubuntu/app"
cd "$DEPLOY_DIR"

# image-info.env 파일에서 이미지 정보 로드
if [ ! -f "image-info.env" ]; then
    echo "❌ image-info.env 파일이 없습니다"
    exit 1
fi

source image-info.env
export ECR_IMAGE=$FULL_IMAGE
export ENV_FILE=${ENV_FILE:-.env.prod}

echo "🐳 Docker 이미지: $ECR_IMAGE"
echo "📝 환경 파일: $ENV_FILE"

# 환경 변수 파일 확인
if [ -f "$ENV_FILE" ]; then
    echo "✅ $ENV_FILE 파일 발견 (docker-compose가 자동으로 로드합니다)"
    echo "📝 환경 변수 미리보기:"
    head -n 3 "$ENV_FILE"
else
    echo "⚠️  $ENV_FILE 파일이 없습니다"
    echo "   환경 변수 없이 실행됩니다"
fi

# Docker Compose 실행
echo "🚀 Docker Compose로 컨테이너 시작..."

if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

# 컨테이너 시작 대기 (약간의 여유 시간)
echo "⏳ 컨테이너 시작 대기 중..."
sleep 5

# 컨테이너 상태 확인
echo "🔍 컨테이너 상태 확인..."
docker ps

# 주요 컨테이너 확인
REQUIRED_CONTAINERS=("devths-fe")

for CONTAINER in "${REQUIRED_CONTAINERS[@]}"; do
    if docker ps | grep -q "$CONTAINER"; then
        echo "✅ $CONTAINER 실행 중"
    else
        echo "❌ $CONTAINER 실행 실패"
        echo "로그 확인:"
        docker logs "$CONTAINER" --tail 50 || true
        exit 1
    fi
done

echo "✅ ApplicationStart 완료"
echo ""
echo "📌 다음 단계: ValidateService에서 헬스체크 통과 대기"
