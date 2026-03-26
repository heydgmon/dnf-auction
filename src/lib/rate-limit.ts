/** 간단한 인메모리 레이트 리미터 (이메일 스팸 방지) */

const rateMap = new Map<string, { count: number; resetAt: number }>();

const MAX_REQUESTS = 5;       // 윈도우당 최대 요청 수
const WINDOW_MS = 60 * 60 * 1000;  // 1시간

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true };
}

/** 오래된 엔트리 정리 (메모리 관리) */
export function cleanupRateMap(): void {
  const now = Date.now();
  for (const [key, entry] of rateMap.entries()) {
    if (now > entry.resetAt) rateMap.delete(key);
  }
}
