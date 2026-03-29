import { NextResponse } from "next/server";
import { isSharedCacheValid, getSharedCache, getSharedBuildPromise } from "@/lib/auction-shared-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isSharedCacheValid()) {
      return NextResponse.json({ items: getSharedCache()!.trendingItems });
    }
    const data = await getSharedBuildPromise();
    if (data) return NextResponse.json({ items: data.trendingItems });
    return NextResponse.json({ items: [] });
  } catch (err: any) {
    const cached = getSharedCache();
    if (cached) return NextResponse.json({ items: cached.trendingItems });
    return NextResponse.json({ items: [], error: err.message });
  }
}