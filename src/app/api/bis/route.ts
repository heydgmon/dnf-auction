import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";
import { isSharedCacheValid, getSharedCache, getSharedBuildPromise } from "@/lib/auction-shared-cache";

export const dynamic = "force-dynamic";

let bisCache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

const CATEGORIES = [
  { category: "칭호",    emoji: "👑", typeMatch: (t: string) => t === "칭호" },
  { category: "크리쳐",  emoji: "🐉", typeMatch: (t: string) => t === "크리쳐" },
  { category: "오라",    emoji: "✨", typeMatch: (t: string) => t === "오라" },
  { category: "마법부여", emoji: "🃏", typeMatch: (t: string) => t === "카드" || t === "엠블렘" || t.includes("마법부여") },
];

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return prices.filter(p => p >= median * 0.2 && p <= median * 3);
}

async function fetchSold(itemName: string): Promise<any[]> {
  try {
    const { data, ok } = await neopleGet("/df/auction-sold", { itemName, wordType: "match", limit: "100" });
    if (!ok || !data.rows) return [];
    return data.rows.filter((r: any) => r.itemName === itemName);
  } catch { return []; }
}

async function fetchCurrentLowest(itemName: string): Promise<number | null> {
  try {
    const { data, ok } = await neopleGet("/df/auction", { itemName, wordType: "match", limit: "5" });
    if (!ok || !data.rows || data.rows.length === 0) return null;
    const prices = data.rows.map((r: any) => r.unitPrice).filter(Boolean);
    return prices.length > 0 ? Math.min(...prices) : null;
  } catch { return null; }
}

export async function GET() {
  try {
    if (bisCache && Date.now() - bisCache.updatedAt < CACHE_TTL) {
      return NextResponse.json(bisCache.data);
    }

    if (!isSharedCacheValid()) await getSharedBuildPromise();
    const shared = getSharedCache();
    if (!shared || shared.allAuctionRows.length === 0) {
      return NextResponse.json({ categories: [], error: "No auction data" });
    }

    // ── itemType으로 분류 ──
    const typeToItems = new Map<string, Map<string, { itemName: string; itemId: string; itemRarity: string; unitPrice: number }>>();
    for (const row of shared.allAuctionRows) {
      const type = row.itemType || "";
      const name = row.itemName || "";
      if (!type || !name) continue;
      if (!typeToItems.has(type)) typeToItems.set(type, new Map());
      const items = typeToItems.get(type)!;
      const existing = items.get(name);
      // 최저가 유지
      if (!existing || (row.unitPrice && row.unitPrice < existing.unitPrice)) {
        items.set(name, {
          itemName: name,
          itemId: row.itemId || "",
          itemRarity: row.itemRarity || "",
          unitPrice: row.unitPrice || 0,
        });
      }
    }

    const results = [];

    for (const cat of CATEGORIES) {
      // 해당 카테고리 아이템 수집
      let categoryItems: { itemName: string; itemId: string; itemRarity: string; unitPrice: number }[] = [];
      for (const [type, items] of typeToItems) {
        if (cat.typeMatch(type)) {
          categoryItems = categoryItems.concat([...items.values()]);
        }
      }

      console.log(`[BIS] ${cat.category}: ${categoryItems.length} items from auction`);

      if (categoryItems.length === 0) {
        results.push({ category: cat.category, emoji: cat.emoji, items: [] });
        continue;
      }

      // ── 시세(실체결) 조회 시도 ──
      const categoryNames = categoryItems.map(i => i.itemName);
      const soldResults = await Promise.all(
        categoryNames.map(async (name) => ({ name, rows: await fetchSold(name) }))
      );

      const withSoldData = soldResults.filter(({ rows }) => rows.length > 0);

      let ranked: any[];

      if (withSoldData.length >= 3) {
        // ── 시세 데이터 충분 → 실체결 기준 Top 3 ──
        ranked = withSoldData
          .map(({ name, rows }) => {
            const prices = rows.map((r: any) => r.unitPrice).filter(Boolean);
            if (prices.length === 0) return null;
            const cleaned = removeOutliers(prices);
            const avgPrice = cleaned.length > 0 ? Math.round(cleaned.reduce((a, b) => a + b, 0) / cleaned.length) : 0;
            const totalValue = cleaned.reduce((a, b) => a + b, 0);
            return {
              itemName: name,
              itemId: rows[0].itemId || "",
              itemRarity: rows[0].itemRarity || "",
              avgPrice,
              tradeCount: rows.reduce((s: number, r: any) => s + (r.count || 1), 0),
              totalValue,
              source: "시세",
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.totalValue - a.totalValue)
          .slice(0, 3);
      } else {
        // ── 시세 데이터 부족 → 경매장 등록 매물 최저가 기준 Top 3 ──
        console.log(`[BIS] ${cat.category}: sold data insufficient (${withSoldData.length}), using auction listings`);
        ranked = categoryItems
          .filter(i => i.unitPrice > 0)
          .sort((a, b) => b.unitPrice - a.unitPrice)
          .slice(0, 3)
          .map(i => ({
            itemName: i.itemName,
            itemId: i.itemId,
            itemRarity: i.itemRarity,
            avgPrice: i.unitPrice,
            tradeCount: 0,
            totalValue: i.unitPrice,
            source: "경매장",
          }));
      }

      // ── 경매장 현재 최저가 ──
      const withLowest = await Promise.all(
        ranked.map(async (item: any) => {
          const lowestPrice = await fetchCurrentLowest(item.itemName);
          return { ...item, lowestPrice };
        })
      );

      results.push({ category: cat.category, emoji: cat.emoji, items: withLowest });
    }

    const result = { categories: results, updatedAt: new Date().toISOString() };
    bisCache = { data: result, updatedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[BIS] error:", err.message);
    if (bisCache) return NextResponse.json(bisCache.data);
    return NextResponse.json({ categories: [], error: err.message });
  }
}