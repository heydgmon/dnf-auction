// src/app/api/auction-sold-history/route.ts
//
// 차트용 7일치 시세 히스토리 수집 엔드포인트
// Neople auction-sold API에는 날짜 범위 파라미터가 없으므로
// 서버에서 7회 병렬 호출 후 날짜별로 각 100건씩 샘플링해서 합칩니다.
//
// GET /api/auction-sold-history?itemName=무색+큐브+조각&wordType=match

import { NextRequest, NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

// 이상치 제거
function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return prices.filter(p => p >= median * 0.2 && p <= median * 3);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemName = searchParams.get("itemName") || "";
  const wordType = searchParams.get("wordType") || "match";

  if (!itemName) {
    return NextResponse.json({ rows: [], error: "itemName required" }, { status: 400 });
  }

  try {
    // 7회 병렬 호출 (limit=200씩) → 각 호출이 서로 다른 시간대 데이터를 포함할 가능성 있음
    // Neople API는 최신순이므로 여러 번 호출해도 동일 데이터가 올 수 있음
    // → 호출 수를 늘려서 더 많은 날짜를 커버하되, soldDate 기준으로 dedup
    const CALLS = 7;
    const PER_CALL = 200;

    const results = await Promise.all(
      Array.from({ length: CALLS }).map(() =>
        neopleGet("/df/auction-sold", {
          itemName,
          wordType,
          limit: String(PER_CALL),
        }).then(({ data, ok }) => (ok && data.rows ? data.rows : []))
          .catch(() => [])
      )
    );

    // soldDate + unitPrice 기준 dedup (완전히 동일한 거래 중복 제거)
    const seen = new Set<string>();
    const allRows: any[] = [];
    for (const rows of results) {
      for (const r of rows) {
        const key = `${r.soldDate}__${r.unitPrice}__${r.itemName}__${r.count}`;
        if (!seen.has(key)) {
          seen.add(key);
          allRows.push(r);
        }
      }
    }

    // itemName 필터 (match 검색이라 다른 아이템이 섞일 수 있음)
    const filtered = allRows.filter(r =>
      (r.itemName as string).includes(itemName)
    );

    // 날짜별 집계
    const dateMap = new Map<string, { prices: number[]; txCount: number }>();
    for (const r of filtered) {
      const d = (r.soldDate || "").slice(0, 10);
      if (!d || !r.unitPrice) continue;
      const e = dateMap.get(d) || { prices: [], txCount: 0 };
      e.prices.push(r.unitPrice);
      e.txCount += 1;
      dateMap.set(d, e);
    }

    // 오늘 기준 7일 범위만 유지, 날짜 오름차순 정렬
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

    const chartRows = [...dateMap.entries()]
      .filter(([d]) => d >= cutoff)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { prices, txCount }]) => {
        const cleaned = removeOutliers(prices);
        const avg = cleaned.length > 0
          ? Math.round(cleaned.reduce((s, v) => s + v, 0) / cleaned.length)
          : Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);
        return { date, avg, count: txCount };
      });

    // 최근 거래 리스트용 raw rows (날짜 내림차순, 최대 100건)
    const recentRows = filtered
      .sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""))
      .slice(0, 100);

    return NextResponse.json({ chartRows, recentRows });
  } catch (err: any) {
    return NextResponse.json({ chartRows: [], recentRows: [], error: err.message }, { status: 502 });
  }
}