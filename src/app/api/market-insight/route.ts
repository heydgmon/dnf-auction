import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
let buildPromise: Promise<any> | null = null;
const CACHE_TTL = 3 * 60 * 1000;

const KEYWORDS = [
  "강화권", "카드", "큐브", "토큰", "증폭",
  "패키지", "순례", "골고", "에픽", "소울",
];

interface ItemInsight {
  itemName: string; itemId: string; itemRarity: string;
  trades: { date: string; unitPrice: number; count: number }[];
  avgPrice: number; minPrice: number; maxPrice: number;
  totalVolume: number; totalValue: number; priceChange: number;
}

// BIS와 동일한 이상치 제거 로직
function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return prices.filter(p => p >= median * 0.2 && p <= median * 3);
}

async function buildInsightData(): Promise<ItemInsight[]> {
  const results = await Promise.all(
    KEYWORDS.map(async (kw) => {
      try {
        const { data, ok } = await neopleGet("/df/auction-sold", {
          itemName: kw,
          wordType: "match", // fix: "full"(완전일치) → "match"(부분일치)
          limit: "200",      // fix: 100 → 200 (샘플 확대)
        });
        return ok && data.rows ? data.rows : [];
      } catch { return []; }
    })
  );

  const allRows = results.flat();
  const itemMap = new Map<string, {
    itemName: string; itemId: string; itemRarity: string;
    prices: number[];
    dates: { date: string; unitPrice: number; count: number }[];
    totalCount: number;
  }>();

  for (const row of allRows) {
    const name = row.itemName;
    if (!name || !row.unitPrice) continue;
    const dateStr = (row.soldDate || "").slice(0, 10);
    const existing = itemMap.get(name);
    if (existing) {
      existing.prices.push(row.unitPrice);
      existing.totalCount += row.count || 1;
      if (dateStr) existing.dates.push({ date: dateStr, unitPrice: row.unitPrice, count: row.count || 1 });
    } else {
      itemMap.set(name, {
        itemName: name, itemId: row.itemId || "", itemRarity: row.itemRarity || "",
        prices: [row.unitPrice],
        dates: dateStr ? [{ date: dateStr, unitPrice: row.unitPrice, count: row.count || 1 }] : [],
        totalCount: row.count || 1,
      });
    }
  }

  const sorted = [...itemMap.values()]
    .map(item => {
      // fix: 이상치 제거 후 totalValue 계산
      const cleaned = removeOutliers(item.prices);
      const totalValue = cleaned.reduce((a, b) => a + b, 0);
      return { ...item, cleanedPrices: cleaned, totalValue };
    })
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 20);

  return sorted.map(item => {
    const prices = item.cleanedPrices; // fix: 이상치 제거된 가격으로 통계 계산
    const avgPrice = prices.length > 0
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : 0;

    // 가격 변동률: 최신 절반 vs 이전 절반 비교
    const half = Math.floor(prices.length / 2);
    let priceChange = 0;
    if (half > 0) {
      const recentAvg = prices.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const olderAvg = prices.slice(half).reduce((a, b) => a + b, 0) / (prices.length - half);
      if (olderAvg > 0) priceChange = Math.round(((recentAvg - olderAvg) / olderAvg) * 10000) / 100;
    }

    // 날짜별 집계
    const dateMap = new Map<string, { prices: number[]; volume: number }>();
    for (const d of item.dates) {
      const e = dateMap.get(d.date) || { prices: [], volume: 0 };
      e.prices.push(d.unitPrice);
      e.volume += d.count;
      dateMap.set(d.date, e);
    }
    const trades = [...dateMap.entries()]
      .map(([date, { prices: p, volume }]) => {
        const cleanedDay = removeOutliers(p); // fix: 날짜별 일별 평균도 이상치 제거
        return {
          date,
          unitPrice: cleanedDay.length > 0
            ? Math.round(cleanedDay.reduce((a, b) => a + b, 0) / cleanedDay.length)
            : Math.round(p.reduce((a, b) => a + b, 0) / p.length),
          count: volume,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      itemName: item.itemName,
      itemId: item.itemId,
      itemRarity: item.itemRarity,
      trades,
      avgPrice,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      totalVolume: item.totalCount,
      totalValue: item.totalValue,
      priceChange,
    };
  });
}

function getBuildPromise(): Promise<ItemInsight[]> {
  if (!buildPromise) { buildPromise = buildInsightData().finally(() => { buildPromise = null; }); }
  return buildPromise as Promise<ItemInsight[]>;
}

getBuildPromise().then(items => {
  if (items.length > 0) {
    cache = { data: { items, updatedAt: new Date().toISOString() }, updatedAt: Date.now() };
    console.log("[INSIGHT] Warmup done:", items.length);
  }
}).catch(() => {});

export async function GET() {
  try {
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) return NextResponse.json(cache.data);
    const items = await getBuildPromise();
    const result = { items, updatedAt: new Date().toISOString() };
    cache = { data: result, updatedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err: any) {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ items: [], error: err.message });
  }
}