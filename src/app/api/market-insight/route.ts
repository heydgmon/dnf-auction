/**
 * [Market Insight API] — stale-while-revalidate 적용
 *
 * ■ 속도 최적화:
 * 1. FRESH (3분): 캐시 즉시 반환
 * 2. STALE (3~30분): 캐시 즉시 반환 + 백그라운드 갱신
 * 3. EXPIRED (30분+): 빌드 대기 (서버 시작 시 워밍업으로 최소화)
 */

import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";
import {
  getMultiItemPriceHistory,
  DailyPriceRecord,
} from "@/lib/price-history";
import { ensureSnapshotCollected } from "@/lib/snapshot-collector";

export const dynamic = "force-dynamic";

/* ── 캐시 ── */
let cache: { data: any; updatedAt: number } | null = null;
let buildPromise: Promise<any> | null = null;
const FRESH_TTL = 3 * 60 * 1000;   // 3분
const STALE_TTL = 30 * 60 * 1000;  // 30분

function isCacheFresh(): boolean {
  return !!cache && Date.now() - cache.updatedAt < FRESH_TTL;
}
function isCacheUsable(): boolean {
  return !!cache && Date.now() - cache.updatedAt < STALE_TTL;
}

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
  const start = Date.now();

  // 1. 스냅샷 보장 (비블로킹 — 실패해도 진행)
  await ensureSnapshotCollected().catch(() => {});

  // 2. auction-sold에서 당일 데이터
  const results = await Promise.all(
    KEYWORDS.map(async (kw) => {
      try {
        const { data, ok } = await neopleGet("/df/auction-sold", {
          itemName: kw, wordType: "full", limit: "100",
        });
        return ok && data.rows ? data.rows : [];
      } catch { return []; }
    })
  );

  const allRows = results.flat();

  // 3. 품목별 집계
  const itemMap = new Map<string, {
    itemName: string; itemId: string; itemRarity: string;
    prices: number[]; totalVolume: number; totalValue: number;
  }>();

  for (const row of allRows) {
    const name = row.itemName;
    if (!name || !row.unitPrice) continue;
    const count = row.count || 1;
    const unitPrice = row.unitPrice;
    const existing = itemMap.get(name);
    if (existing) {
      existing.prices.push(unitPrice);
      existing.totalVolume += count;
      existing.totalValue += unitPrice * count;
    } else {
      itemMap.set(name, {
        itemName: name, itemId: row.itemId || "", itemRarity: row.itemRarity || "",
        prices: [unitPrice], totalVolume: count, totalValue: unitPrice * count,
      });
    }
  }

  // 4. 상위 20개
  const sorted = [...itemMap.values()]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 20);

  // 5. DynamoDB 히스토리
  const itemNames = sorted.map(i => i.itemName);
  const historyMap = await getMultiItemPriceHistory(itemNames, 7);

  // 6. 조합
  const items = sorted.map(item => {
    const prices = item.prices;
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

    const dbHistory = historyMap.get(item.itemName) || [];
    const today = new Date().toISOString().slice(0, 10);

    const tradesMap = new Map<string, { unitPrice: number; count: number }>();
    for (const rec of dbHistory) {
      tradesMap.set(rec.date, { unitPrice: rec.avgPrice, count: rec.totalVolume });
    }
    tradesMap.set(today, { unitPrice: avgPrice, count: item.totalVolume });

    const trades = [...tradesMap.entries()]
      .map(([date, { unitPrice, count }]) => ({ date, unitPrice, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let priceChange = 0;
    if (dbHistory.length > 0) {
      const yesterdayRecords = dbHistory.filter(r => r.date !== today);
      if (yesterdayRecords.length > 0) {
        const lastRecord = yesterdayRecords[yesterdayRecords.length - 1];
        if (lastRecord.avgPrice > 0) {
          priceChange = Math.round(((avgPrice - lastRecord.avgPrice) / lastRecord.avgPrice) * 10000) / 100;
        }
      }
    }

    return {
      itemName: item.itemName, itemId: item.itemId, itemRarity: item.itemRarity,
      trades, avgPrice, minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
      totalVolume: item.totalVolume, totalValue: item.totalValue, priceChange,
    };
  });

  const elapsed = Date.now() - start;
  console.log(`[INSIGHT] Build done in ${elapsed}ms: ${items.length} items`);
  return items;
}

function triggerBackgroundRefresh(): void {
  if (buildPromise) return;
  buildPromise = buildInsightData()
    .then(items => {
      const result = { items, updatedAt: new Date().toISOString() };
      cache = { data: result, updatedAt: Date.now() };
      console.log("[INSIGHT] Background refresh done");
      return result;
    })
    .catch(err => {
      console.error("[INSIGHT] Background refresh failed:", err);
      return null;
    })
    .finally(() => { buildPromise = null; });
}

export async function GET() {
  try {
    // 1. FRESH → 즉시 반환
    if (isCacheFresh()) {
      return NextResponse.json(cache!.data);
    }

    // 2. STALE → 즉시 반환 + 백그라운드 갱신
    if (isCacheUsable()) {
      triggerBackgroundRefresh();
      return NextResponse.json(cache!.data);
    }

    // 3. EXPIRED → 빌드 대기
    if (!buildPromise) {
      buildPromise = buildInsightData()
        .then(items => {
          const result = { items, updatedAt: new Date().toISOString() };
          cache = { data: result, updatedAt: Date.now() };
          return result;
        })
        .finally(() => { buildPromise = null; });
    }
    const result = await buildPromise;
    return NextResponse.json(result || { items: [] });
  } catch (err: any) {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ items: [], error: err.message });
  }
}

// ── 서버 시작 시 워밍업 ──
buildInsightData()
  .then(items => {
    if (items.length > 0) {
      cache = {
        data: { items, updatedAt: new Date().toISOString() },
        updatedAt: Date.now(),
      };
      console.log("[INSIGHT] Warmup done:", items.length);
    }
  })
  .catch(() => {});