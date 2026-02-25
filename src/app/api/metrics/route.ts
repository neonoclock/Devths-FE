import { NextResponse } from 'next/server';

import { register } from '@/lib/metrics';

/**
 * Prometheus 메트릭 엔드포인트
 * GET /api/metrics
 *
 * Prometheus가 주기적으로 이 엔드포인트를 스크랩하여 메트릭을 수집합니다.
 *
 * @example
 * curl http://localhost:3000/api/metrics
 */
export async function GET() {
  try {
    const metrics = await register.metrics();

    return new NextResponse(metrics, {
      headers: {
        'Content-Type': register.contentType,
      },
    });
  } catch (error) {
    console.error('Failed to collect metrics:', error);
    return NextResponse.json(
      { error: 'Failed to collect metrics' },
      {
        status: 500,
      },
    );
  }
}

// Prometheus가 주기적으로 scrape하므로 캐싱 비활성화
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Node.js 런타임 사용 (prom-client는 Node.js API를 사용하므로 Edge Runtime 불가)
export const runtime = 'nodejs';
