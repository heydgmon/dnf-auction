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

async function buildInsightData(): Promise<ItemInsight[]> {
  const results = await Promise.all(
    KEYWORDS.map(async (kw) => {
      try {
        const { data, ok } = await neopleGet("/df/auction-sold", { itemName: kw, wordType: "full", limit: "100" });
        return ok && data.rows ? data.rows : [];
      } catch { return []; }
    })
  );

  const allRows = results.flat();
  const itemMap = new Map<string, { itemName: string; itemId: string; itemRarity: string; prices: number[]; dates: { date: string; unitPrice: number; count: number }[]; totalCount: number; }>();

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
    .map(item => ({ ...item, totalValue: item.prices.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 20);

  return sorted.map(item => {
    const prices = item.prices;
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const half = Math.floor(prices.length / 2);
    let priceChange = 0;
    if (half > 0) {
      const recentAvg = prices.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const olderAvg = prices.slice(half).reduce((a, b) => a + b, 0) / (prices.length - half);
      if (olderAvg > 0) priceChange = Math.round(((recentAvg - olderAvg) / olderAvg) * 10000) / 100;
    }
    const dateMap = new Map<string, { prices: number[]; volume: number }>();
    for (const d of item.dates) { const e = dateMap.get(d.date) || { prices: [], volume: 0 }; e.prices.push(d.unitPrice); e.volume += d.count; dateMap.set(d.date, e); }
    const trades = [...dateMap.entries()].map(([date, { prices: p, volume }]) => ({ date, unitPrice: Math.round(p.reduce((a, b) => a + b, 0) / p.length), count: volume })).sort((a, b) => a.date.localeCompare(b.date));
    return { itemName: item.itemName, itemId: item.itemId, itemRarity: item.itemRarity, trades, avgPrice, minPrice: Math.min(...prices), maxPrice: Math.max(...prices), totalVolume: item.totalCount, totalValue: item.totalValue, priceChange };
  });
}

function getBuildPromise(): Promise<ItemInsight[]> {
  if (!buildPromise) { buildPromise = buildInsightData().finally(() => { buildPromise = null; }); }
  return buildPromise as Promise<ItemInsight[]>;
}

getBuildPromise().then(items => {
  if (items.length > 0) { cache = { data: { items, updatedAt: new Date().toISOString() }, updatedAt: Date.now() }; console.log("[INSIGHT] Warmup done:", items.length); }
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