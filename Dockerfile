# 1. Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# pnpm 설치 및 의존성 복사
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 소스 및 환경 변수 파일 복사
COPY . .

# Next.js 빌드 (Next.js가 자동으로 .env.production 파일을 읽음)
RUN pnpm run build

# 2. Runtime Stage (최종 이미지 경량화)
FROM node:22-alpine
WORKDIR /app

# standalone 모드에서는 node 사용자로 실행 (보안 강화)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone 빌드 결과물 복사 (필요한 의존성만 포함)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# standalone 모드에서는 node로 직접 실행 (pnpm 불필요)
CMD ["node", "server.js"]