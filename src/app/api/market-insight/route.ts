import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000;
let buildPromise: Promise<any> | null = null;

/**
 * 인사이트 API — 최적화 버전
 *
 * 이전: getTopItemNames()에서 10개 키워드 × 100건 호출 → 15개 아이템 개별 시세 조회 = 25~40회 API
 * 지금: 10개 키워드로 시세 데이터 한번에 수집 → 응답 자체에서 인사이트 추출 = 10회 API
 *
 * 핵심: 아이템 이름 수집과 시세 조회를 분리하지 않고,
 *       auction-sold를 한번만 호출해서 이름+시세를 동시에 얻음
 */

const KEYWORDS = [
  "강화권", "카드", "큐브", "토큰", "증폭",
  "패키지", "순례", "골고", "에픽", "소울",
];

interface ItemInsight {
  itemName: string;
  itemId: string;
  itemRarity: string;
  trades: { date: string; unitPrice: number; count: number }[];
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalVolume: number;
  totalValue: number;
  priceChange: number;
}

async function buildInsightData(): Promise<ItemInsight[]> {
  // ── 10개 키워드 전부 동시 호출 (배치 없음) ──
  const results = await Promise.all(
    KEYWORDS.map(async (kw) => {
      try {
        const { data, ok } = await neopleGet("/df/auction-sold", {
          itemName: kw,
          wordType: "full",
          limit: "100",
        });
        return ok && data.rows ? data.rows : [];
      } catch { return []; }
    })
  );

  const allRows = results.flat();

  // ── 아이템별 그룹핑 (한 패스) ──
  const itemMap = new Map<string, {
    itemName: string;
    itemId: string;
    itemRarity: string;
    prices: number[];
    dates: { date: string; unitPrice: number; count: number }[];
    totalCount: number;
  }>();

  for (const row of allRows) {
    const name = row.itemName;
    if (!name || !row.unitPrice) continue;

    const existing = itemMap.get(name);
    const dateStr = (row.soldDate || "").slice(0, 10);

    if (existing) {
      existing.prices.push(row.unitPrice);
      existing.totalCount += row.count || 1;
      if (dateStr) existing.dates.push({ date: dateStr, unitPrice: row.unitPrice, count: row.count || 1 });
    } else {
      itemMap.set(name, {
        itemName: name,
        itemId: row.itemId || "",
        itemRarity: row.itemRarity || "",
        prices: [row.unitPrice],
        dates: dateStr ? [{ date: dateStr, unitPrice: row.unitPrice, count: row.count || 1 }] : [],
        totalCount: row.count || 1,
      });
    }
  }

  // ── 거래총액 상위 15개 선정 → 인사이트 빌드 ──
  const sorted = [...itemMap.values()]
    .map(item => ({
      ...item,
      totalValue: item.prices.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 15);

  return sorted.map(item => {
    const prices = item.prices;
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // 가격 변동률
    const half = Math.floor(prices.length / 2);
    let priceChange = 0;
    if (half > 0) {
      const recentAvg = prices.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const olderAvg = prices.slice(half).reduce((a, b) => a + b, 0) / (prices.length - half);
      if (olderAvg > 0) priceChange = Math.round(((recentAvg - olderAvg) / olderAvg) * 10000) / 100;
    }

    // 날짜별 그룹핑
    const dateMap = new Map<string, { prices: number[]; volume: number }>();
    for (const d of item.dates) {
      const entry = dateMap.get(d.date) || { prices: [], volume: 0 };
      entry.prices.push(d.unitPrice);
      entry.volume += d.count;
      dateMap.set(d.date, entry);
    }

    const trades = [...dateMap.entries()]
      .map(([date, { prices: p, volume }]) => ({
        date,
        unitPrice: Math.round(p.reduce((a, b) => a + b, 0) / p.length),
        count: volume,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      itemName: item.itemName,
      itemId: item.itemId,
      itemRarity: item.itemRarity,
      trades,
      avgPrice,
      minPrice,
      maxPrice,
      totalVolume: item.totalCount,
      totalValue: item.totalValue,
      priceChange,
    };
  });
}

// ── 동시 요청 방지 ──
function getBuildPromise(): Promise<ItemInsight[]> {
  if (!buildPromise) {
    buildPromise = buildInsightData().finally(() => { buildPromise = null; });
  }
  return buildPromise as Promise<ItemInsight[]>;
}

// ── 서버 시작 시 워밍업 ──
getBuildPromise().then(items => {
  if (items.length > 0) {
    cache = { data: { items, updatedAt: new Date().toISOString() }, updatedAt: Date.now() };
    console.log("[INSIGHT] Warmup done:", items.length);
  }
}).catch(() => {});

export async function GET() {
  try {
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const items = await getBuildPromise();
    const result = { items, updatedAt: new Date().toISOString() };
    cache = { data: result, updatedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err: any) {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ items: [], error: err.message });
  }
}