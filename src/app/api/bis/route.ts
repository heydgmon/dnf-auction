import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 던파 경매장 카테고리별 종결템 Top 3
 *
 * 방식:
 * 1. 카테고리별 키워드로 /df/auction-sold (시세=실체결 데이터) 100건씩 수집
 * 2. 응답의 itemType 필드로 해당 카테고리만 정확히 필터
 * 3. 아이템 이름별 그룹핑 → 이상치 제거(중앙값 기준 3배 초과 제거)
 * 4. 이상치 제거 후 평균 체결가 기준 비싼 순 Top 3 선정
 * 5. Top 3 아이템의 경매장 현재 최저가도 별도 조회하여 함께 표시
 */

const CATEGORIES = [
  {
    category: "칭호",
    emoji: "👑",
    // 던파 경매장 칭호 탭 — 시세 API에서 itemType이 "칭호"인 것
    keywords: ["칭호", "패키지", "용사", "모험가", "마스터", "영웅", "아르카나", "서핑", "여행자"],
    typeFilter: (type: string) => type === "칭호",
  },
  {
    category: "크리쳐",
    emoji: "🐉",
    // 던파 경매장 크리쳐 탭 — itemType이 "크리쳐"인 것
    keywords: ["크리쳐", "패키지", "정령", "드래곤", "펫", "수호", "여왕"],
    typeFilter: (type: string) => type === "크리쳐",
  },
  {
    category: "오라",
    emoji: "✨",
    // 던파 경매장 오라 탭 — itemType에 "오라" 포함
    keywords: ["오라", "계약", "패키지", "상자", "그랜드"],
    typeFilter: (type: string) => type.includes("오라"),
  },
  {
    category: "마법부여",
    emoji: "🃏",
    // 던파 경매장 마법부여 탭 — itemType이 "카드" 또는 이름에 "카드" 포함
    keywords: ["카드", "마법부여", "소울", "엠블렘"],
    typeFilter: (type: string, name: string) =>
      type === "카드" || type.includes("마법부여") || type.includes("엠블렘") ||
      name.includes("카드"),
  },
];

/**
 * 이상치 제거: 중앙값 기준 3배 초과 / 0.2배 미만 제거
 */
function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return prices.filter(p => p >= median * 0.2 && p <= median * 3);
}

/**
 * 시세(실체결) 데이터 100건 수집
 */
async function fetchSold(keyword: string): Promise<any[]> {
  try {
    const { data, ok } = await neopleGet("/df/auction-sold", {
      itemName: keyword,
      wordType: "full",
      limit: "100",
    });
    return ok && data.rows ? data.rows : [];
  } catch {
    return [];
  }
}

/**
 * 경매장 현재 최저가 조회
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
      // ── Step 1: 키워드별로 시세 데이터 100건씩 수집 (3개씩 배치) ──
      let allRows: any[] = [];
      for (let i = 0; i < cat.keywords.length; i += 3) {
        const batch = cat.keywords.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map((kw) => fetchSold(kw))
        );
        allRows = allRows.concat(batchResults.flat());
      }

      // ── Step 2: itemType으로 해당 카테고리만 필터 ──
      const filtered = allRows.filter((row) =>
        cat.typeFilter(row.itemType || "", row.itemName || "")
      );

      // ── Step 3: 아이템 이름별 그룹핑 ──
      const itemMap = new Map<string, {
        itemName: string;
        itemId: string;
        itemRarity: string;
        prices: number[];
        totalCount: number;
      }>();

      for (const row of filtered) {
        const name = row.itemName;
        if (!name || !row.unitPrice) continue;

        const existing = itemMap.get(name);
        if (existing) {
          existing.prices.push(row.unitPrice);
          existing.totalCount += row.count || 1;
        } else {
          itemMap.set(name, {
            itemName: name,
            itemId: row.itemId || "",
            itemRarity: row.itemRarity || "",
            prices: [row.unitPrice],
            totalCount: row.count || 1,
          });
        }
      }

      // ── Step 4: 이상치 제거 → 평균 체결가 → 비싼 순 Top 3 ──
      const ranked = [...itemMap.values()]
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

      // ── Step 5: Top 3 각각의 경매장 현재 최저가 조회 ──
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
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ categories: [], error: err.message });
  }
}