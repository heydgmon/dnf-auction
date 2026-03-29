import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";
import { isSharedCacheValid, getSharedCache, getSharedBuildPromise } from "@/lib/auction-shared-cache";

export const dynamic = "force-dynamic";

let bisCache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 종결템 Top 3
 *
 * 1. 공유 캐시(경매장 등록 아이템)에서 itemType으로 분류
 *    → "칭호로 분류"된 아이템, "크리쳐로 분류"된 아이템 등
 *    → 단어 검색이 아님, itemType 필드 기준
 *
 * 2. 분류된 아이템 이름으로 /df/auction-sold 시세 조회
 *    → 이상치 제거 → 거래 규모(총액) Top 3
 *
 * 3. Top 3의 경매장 현재 최저가 조회
 */

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
    const { data, ok } = await neopleGet("/df/auction-sold", {
      itemName,
      wordType: "match",
      limit: "100",
    });
    if (!ok || !data.rows) return [];
    return data.rows.filter((r: any) => r.itemName === itemName);
  } catch {
    return [];
  }
}

async function fetchCurrentLowest(itemName: string): Promise<number | null> {
  try {
    const { data, ok } = await neopleGet("/df/auction", {
      itemName,
      wordType: "match",
      limit: "5",
    });
    if (!ok || !data.rows || data.rows.length === 0) return null;
    const prices = data.rows.map((r: any) => r.unitPrice).filter(Boolean);
    return prices.length > 0 ? Math.min(...prices) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    if (bisCache && Date.now() - bisCache.updatedAt < CACHE_TTL) {
      return NextResponse.json(bisCache.data);
    }

    // ── Step 1: 공유 캐시에서 itemType으로 분류 ──
    if (!isSharedCacheValid()) {
      await getSharedBuildPromise();
    }
    const shared = getSharedCache();
    if (!shared || shared.allAuctionRows.length === 0) {
      return NextResponse.json({ categories: [], error: "No auction data" });
    }

    // itemType으로 카테고리별 고유 아이템 이름 추출
    const typeToNames = new Map<string, Set<string>>();
    for (const row of shared.allAuctionRows) {
      const type = row.itemType || "";
      const name = row.itemName || "";
      if (!type || !name) continue;
      if (!typeToNames.has(type)) typeToNames.set(type, new Set());
      typeToNames.get(type)!.add(name);
    }

    // 디버그
    for (const [type, names] of typeToNames) {
      if (["칭호", "크리쳐", "오라", "카드"].includes(type)) {
        console.log(`[BIS] itemType="${type}": ${names.size} items → ${[...names].slice(0, 5).join(", ")}...`);
      }
    }

    const results = [];

    for (const cat of CATEGORIES) {
      // itemType 기준으로 해당 카테고리 아이템 이름 수집
      let categoryNames: string[] = [];
      for (const [type, names] of typeToNames) {
        if (cat.typeMatch(type)) {
          categoryNames = categoryNames.concat([...names]);
        }
      }
      categoryNames = [...new Set(categoryNames)];

      console.log(`[BIS] ${cat.category}: ${categoryNames.length} items classified`);

      if (categoryNames.length === 0) {
        results.push({ category: cat.category, emoji: cat.emoji, items: [] });
        continue;
      }

      // ── Step 2: 시세(실체결) 조회 — 전부 동시 호출 ──
      const soldResults = await Promise.all(
        categoryNames.map(async (name) => ({
          name,
          rows: await fetchSold(name),
        }))
      );

      // 그룹핑 + 이상치 제거 + 거래 규모 순 정렬
      const ranked = soldResults
        .filter(({ rows }) => rows.length > 0)
        .map(({ name, rows }) => {
          const prices = rows.map((r: any) => r.unitPrice).filter(Boolean);
          if (prices.length === 0) return null;

          const cleaned = removeOutliers(prices);
          const avgPrice = cleaned.length > 0
            ? Math.round(cleaned.reduce((a, b) => a + b, 0) / cleaned.length)
            : 0;
          const totalValue = cleaned.reduce((a, b) => a + b, 0);
          const totalCount = rows.reduce((sum: number, r: any) => sum + (r.count || 1), 0);

          return {
            itemName: name,
            itemId: rows[0].itemId || "",
            itemRarity: rows[0].itemRarity || "",
            avgPrice,
            tradeCount: totalCount,
            dataPoints: prices.length,
            totalValue,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.totalValue - a.totalValue)
        .slice(0, 3);

      // ── Step 3: 경매장 현재 최저가 ──
      const withLowest = await Promise.all(
        ranked.map(async (item: any) => {
          const lowestPrice = await fetchCurrentLowest(item.itemName);
          return { ...item, lowestPrice };
        })
      );

      results.push({
        category: cat.category,
        emoji: cat.emoji,
        items: withLowest,
      });
    }

    const result = {
      categories: results,
      updatedAt: new Date().toISOString(),
    };

    bisCache = { data: result, updatedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[BIS] error:", err.message);
    if (bisCache) return NextResponse.json(bisCache.data);
    return NextResponse.json({ categories: [], error: err.message });
  }
}