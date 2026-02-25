#!/bin/bash
set -e

# 설정
DEPLOY_DIR="/home/ubuntu/app"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "BeforeInstall: 배포 디렉토리 확인"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 배포 디렉토리만 확실히 보장
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "📁 배포 디렉토리 생성..."
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown -R ubuntu:ubuntu "$DEPLOY_DIR"
fi

echo "✅ BeforeInstall 완료"