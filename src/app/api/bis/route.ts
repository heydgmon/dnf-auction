import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 종결템 Top 3 — 2단계 방식
 *
 * Step 1: /df/items (아이템 DB)에서 카테고리 키워드 검색
 *         → itemType 필드로 해당 카테고리만 필터
 *         → 아이템 이름 목록 확보
 *
 * Step 2: 확보된 아이템 이름으로 /df/auction-sold 시세 조회
 *         → 이상치 제거 → 평균 체결가 Top 3 선정
 *         → 경매장 현재 최저가 조회
 */

const CATEGORIES = [
  {
    category: "칭호",
    emoji: "👑",
    // /df/items에서 검색할 키워드 (itemName으로 검색)
    itemSearchKeywords: ["칭호"],
    // 응답의 itemType으로 필터
    typeMatch: (type: string) => type === "칭호",
  },
  {
    category: "크리쳐",
    emoji: "🐉",
    itemSearchKeywords: ["크리쳐"],
    typeMatch: (type: string) => type === "크리쳐",
  },
  {
    category: "오라",
    emoji: "✨",
    itemSearchKeywords: ["오라"],
    typeMatch: (type: string) => type === "오라",
  },
  {
    category: "마법부여",
    emoji: "🃏",
    itemSearchKeywords: ["카드"],
    typeMatch: (type: string) => type === "카드",
  },
];

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return prices.filter(p => p >= median * 0.2 && p <= median * 3);
}

/**
 * Step 1: /df/items로 해당 카테고리의 아이템 이름 목록 확보
 */
async function getItemNamesByCategory(
  keywords: string[],
  typeMatch: (type: string) => boolean
): Promise<string[]> {
  const names = new Set<string>();

  for (const kw of keywords) {
    try {
      const { data, ok } = await neopleGet("/df/items", {
        itemName: kw,
        wordType: "full",
        limit: "100",
      });
      if (!ok || !data.rows) continue;

      for (const item of data.rows) {
        if (typeMatch(item.itemType || "")) {
          names.add(item.itemName);
        }
      }
    } catch {
      // skip
    }
  }

  console.log(`[BIS] Found ${names.size} item names from /df/items`);
  return [...names];
}

/**
 * Step 2: 아이템 이름으로 시세(실체결) 조회
 */
async function fetchSoldForItem(itemName: string): Promise<any[]> {
  try {
    const { data, ok } = await neopleGet("/df/auction-sold", {
      itemName,
      wordType: "match",
      limit: "100",
    });
    if (!ok || !data.rows) return [];
    // 정확히 이름 일치하는 것만
    return data.rows.filter((r: any) => r.itemName === itemName);
  } catch {
    return [];
  }
}

/**
 * 경매장 현재 최저가
 */
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
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const results = [];

    for (const cat of CATEGORIES) {
      // ── Step 1: 아이템 DB에서 이름 목록 확보 ──
      const itemNames = await getItemNamesByCategory(
        cat.itemSearchKeywords,
        cat.typeMatch
      );

      console.log(`[BIS] ${cat.category}: ${itemNames.length} items from DB`);

      if (itemNames.length === 0) {
        results.push({ category: cat.category, emoji: cat.emoji, items: [] });
        continue;
      }

      // ── Step 2: 각 아이템의 시세 조회 (5개씩 배치) ──
      const itemData = new Map<string, {
        itemName: string;
        itemId: string;
        itemRarity: string;
        prices: number[];
        totalCount: number;
      }>();

      for (let i = 0; i < itemNames.length; i += 5) {
        const batch = itemNames.slice(i, i + 5);
        const batchResults = await Promise.all(
          batch.map(async (name) => ({
            name,
            rows: await fetchSoldForItem(name),
          }))
        );

        for (const { name, rows } of batchResults) {
          if (rows.length === 0) continue;
          const prices = rows.map((r: any) => r.unitPrice).filter(Boolean);
          if (prices.length === 0) continue;

          itemData.set(name, {
            itemName: name,
            itemId: rows[0].itemId || "",
            itemRarity: rows[0].itemRarity || "",
            prices,
            totalCount: rows.reduce((sum: number, r: any) => sum + (r.count || 1), 0),
          });
        }
      }

      // ── Step 3: 이상치 제거 → 평균 체결가 → Top 3 ──
      const ranked = [...itemData.values()]
        .map((item) => {
          const cleaned = removeOutliers(item.prices);
          const avgPrice = cleaned.length > 0
            ? Math.round(cleaned.reduce((a, b) => a + b, 0) / cleaned.length)
            : 0;
          return {
            itemName: item.itemName,
            itemId: item.itemId,
            itemRarity: item.itemRarity,
            avgPrice,
            tradeCount: item.totalCount,
            dataPoints: item.prices.length,
          };
        })
        .filter((item) => item.avgPrice > 0)
        .sort((a, b) => b.avgPrice - a.avgPrice)
        .slice(0, 3);

      // ── Step 4: 경매장 현재 최저가 ──
      const withLowest = await Promise.all(
        ranked.map(async (item) => {
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

    cache = { data: result, updatedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[BIS] error:", err.message);
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ categories: [], error: err.message });
  }
}