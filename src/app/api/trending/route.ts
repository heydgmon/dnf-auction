import { NextResponse } from "next/server";
import {
  isSharedCacheValid,
  isSharedCacheUsable,
  getSharedCache,
  getSharedData,
} from "@/lib/auction-shared-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. FRESH 캐시 → 즉시 반환 (0ms)
    if (isSharedCacheValid()) {
      return NextResponse.json(
        { items: getSharedCache()!.trendingItems },
        { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
      );
    }

    // 2. STALE 캐시 → 즉시 반환 + 백그라운드 갱신
    if (isSharedCacheUsable()) {
      const data = await getSharedData(); // 이 경우 즉시 반환됨
      if (data) {
        return NextResponse.json(
          { items: data.trendingItems },
          { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
        );
      }
    }

    // 3. 캐시 없음 → 빌드 대기
    const data = await getSharedData();
    if (data) {
      return NextResponse.json({ items: data.trendingItems });
    }
    return NextResponse.json({ items: [] });
  } catch (err: any) {
    // 에러 시에도 stale 캐시가 있으면 반환
    const cached = getSharedCache();
    if (cached) return NextResponse.json({ items: cached.trendingItems });
    return NextResponse.json({ items: [], error: err.message });
  }
}