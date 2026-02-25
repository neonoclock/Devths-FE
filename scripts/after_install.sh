#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "AfterInstall: Docker 이미지 준비"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DEPLOY_DIR="/home/ubuntu/app"
cd "$DEPLOY_DIR"

# 1. AWS 리전 확인 (EC2 메타데이터에서)
echo "🔍 AWS 리전 확인..."
AWS_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region || echo "ap-northeast-2")
export AWS_DEFAULT_REGION=$AWS_REGION
echo "📍 리전: $AWS_REGION"

# 2. image-info.env 파일 확인 (CI에서 생성됨)
if [ ! -f "image-info.env" ]; then
    echo "❌ image-info.env 파일이 없습니다"
    echo "ℹ️ CI 파이프라인에서 이 파일을 생성해야 합니다"
    exit 1
fi

source image-info.env

echo "📦 이미지 정보:"
echo "  - Registry: $ECR_REGISTRY"
echo "  - Repository: $ECR_REPOSITORY"
echo "  - Tag: $IMAGE_TAG"
echo "  - Full Image: $FULL_IMAGE"

# 4. ECR 로그인
echo "🔐 ECR 로그인..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_REGISTRY
echo "✅ ECR 로그인 완료"

# 5. Docker 이미지 Pull
echo "📥 Docker 이미지 Pull..."
docker pull $FULL_IMAGE

# 태그 확인
if docker images | grep -q "$ECR_REPOSITORY"; then
    echo "✅ 이미지 Pull 완료"
    docker images | grep "$ECR_REPOSITORY" | head -n 3
else
    echo "❌ 이미지 Pull 실패"
    exit 1
fi

# 6. 파일 권한 설정
echo "🔒 파일 권한 설정..."
sudo chown -R ubuntu:ubuntu "$DEPLOY_DIR"
sudo find "$DEPLOY_DIR" -type f -name "*.sh" -exec chmod +x {} \;

echo "✅ AfterInstall 완료"
