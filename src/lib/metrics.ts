import { Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus 메트릭 레지스트리
 * 서버 사이드에서만 사용됩니다.
 */
export const register = new Registry();

// Node.js 기본 메트릭 수집 (CPU, 메모리, 이벤트 루프 등)
// 서버 사이드 (Node.js runtime)에서만 실행됩니다.
if (typeof window === 'undefined') {
  collectDefaultMetrics({
    register,
  });
}
