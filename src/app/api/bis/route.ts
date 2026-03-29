import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 종결템 Top 3 — 경매장 등록 아이템 기반 2단계
 *
 * Step 1: /df/auction (경매장 등록 아이템) 광범위 수집
 *         → 현재 경매장에 실제로 올라와 있는 아이템 + itemType 확보
 *         → itemType으로 칭호/크리쳐/오라/카드 분류
 *         → 카테고리별 고유 아이템 이름 목록 확보
 *
 * Step 2: 카테고리별 아이템 이름으로 /df/auction-sold 시세 조회
 *         → 이상치 제거 → 평균 체결가 Top 3
 *         → 경매장 현재 최저가 조회
 */

// ── 경매장 등록 아이템을 광범위하게 수집하기 위한 키워드 ──
// /df/auction은 wordType=full로 1~2글자만 넣어도 최대 400건 반환
// 다양한 글자를 넣어서 최대한 많은 아이템을 수집
const AUCTION_SWEEP_CHARS = [
  "의", "은", "된", "한", "를",
  "상", "패", "알", "봉", "운",
  "카", "오", "크", "칭", "마",
  "드", "서", "전", "계", "영",
];

const CATEGORY_FILTERS: {
  category: string;
  emoji: string;
  typeMatch: (type: string) => boolean;
}[] = [
  {
    category: "칭호",
    emoji: "👑",
    typeMatch: (type) => type === "칭호",
  },
  {
    category: "크리쳐",
    emoji: "🐉",
    typeMatch: (type) => type === "크리쳐",
  },
  {
    category: "오라",
    emoji: "✨",
    typeMatch: (type) => type === "오라",
  },
  {
    category: "마법부여",
    emoji: "🃏",
    typeMatch: (type) => type === "카드",
  },
];

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return prices.filter(p => p >= median * 0.2 && p <= median * 3);
}

async function fetchAuction(keyword: string): Promise<any[]> {
  try {
    const { data, ok } = await neopleGet("/df/auction", {
      itemName: keyword,
      wordType: "full",
      limit: "400",
    });
    return ok && data.rows ? data.rows : [];
  } catch {
    return [];
  }
}

async function fetchSoldForItem(itemName: string): Promise<any[]> {
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
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // ══ Step 1: 경매장 등록 아이템 광범위 수집 ══
    // 다양한 키워드로 /df/auction을 호출하여
    // 현재 경매장에 등록된 아이템의 이름 + itemType을 수집
    const itemsByType = new Map<string, Set<string>>(); // itemType → Set<itemName>

    for (let i = 0; i < AUCTION_SWEEP_CHARS.length; i += 5) {
      const batch = AUCTION_SWEEP_CHARS.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map((kw) => fetchAuction(kw))
      );
      for (const rows of batchResults) {
        for (const row of rows) {
          const type = row.itemType || "";
          const name = row.itemName || "";
          if (!type || !name) continue;
          if (!itemsByType.has(type)) itemsByType.set(type, new Set());
          itemsByType.get(type)!.add(name);
        }
      }
    }

    // 디버그: 어떤 itemType들이 수집되었는지 로깅
    for (const [type, names] of itemsByType) {
      console.log(`[BIS] itemType="${type}": ${names.size} unique items`);
    }

    // ══ Step 2: 카테고리별 분류 → 시세 조회 → Top 3 ══
    const results = [];

    for (const cat of CATEGORY_FILTERS) {
      // itemType으로 해당 카테고리 아이템 이름 추출
      let categoryItems: string[] = [];
      for (const [type, names] of itemsByType) {
        if (cat.typeMatch(type)) {
          categoryItems = categoryItems.concat([...names]);
        }
      }
      // 중복 제거
      categoryItems = [...new Set(categoryItems)];

      console.log(`[BIS] ${cat.category}: ${categoryItems.length} items found in auction`);

      if (categoryItems.length === 0) {
        results.push({ category: cat.category, emoji: cat.emoji, items: [] });
        continue;
      }

      // 각 아이템의 시세 조회 (5개씩 배치)
      const itemData = new Map<string, {
        itemName: string;
        itemId: string;
        itemRarity: string;
        prices: number[];
        totalCount: number;
      }>();

      for (let i = 0; i < categoryItems.length; i += 5) {
        const batch = categoryItems.slice(i, i + 5);
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

      // 이상치 제거 → 평균 체결가 → Top 3
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

      // 경매장 현재 최저가
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