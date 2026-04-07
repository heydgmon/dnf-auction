import { NextResponse } from "next/server";
import { isSharedCacheValid, getSharedCache, getSharedBuildPromise } from "@/lib/auction-shared-cache";

export const dynamic = "force-dynamic"; //API는 정적으로 굳혀두지 말고, 요청 올 때마다 동적으로 처리

export async function GET() {
  try {
    if (isSharedCacheValid()) {
      return NextResponse.json({ items: getSharedCache()!.trendingItems }); // 공유 캐시가 아직 유효하면 캐시 데이터 바로 반환
    }
    const data = await getSharedBuildPromise();     // 캐시가 없으면 새 데이터 생성 작업 결과를 기다림
    if (data) return NextResponse.json({ items: data.trendingItems });
    return NextResponse.json({ items: [] });
  } catch (err: any) {
    const cached = getSharedCache();
    if (cached) return NextResponse.json({ items: cached.trendingItems });
    return NextResponse.json({ items: [], error: err.message });
  }
}//홈 화면이 요청하면 인기 아이템 목록을 JSON으로 보내주는 코드