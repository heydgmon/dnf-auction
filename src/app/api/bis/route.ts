import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 던파 종결템 Top 3 — 완전 자동 분류
 *
 * 핵심: itemType 필드"만" 사용하여 분류 (이름 기반 필터 없음)
 *
 * 1. 광범위한 1~2글자 키워드로 auction-sold 100건씩 대량 수집
 * 2. 응답의 itemType 필드로만 카테고리 분류 (이름 무관)
 * 3. 아이템별 그룹핑 → 이상치 제거 → 평균 체결가 Top 3
 * 4. Top 3의 경매장 현재 최저가 조회
 */

// ── 넓은 키워드 풀: 1~2글자로 최대한 많은 아이템을 수집 ──
// auction-sold API는 itemName 필수이므로 다양한 짧은 키워드로 스윕
const SWEEP_KEYWORDS = [
  // 일반적으로 많이 걸리는 1글자
  "의", "은", "된", "한", "를", "에", "로", "이",
  // 카테고리 관련
  "칭호", "크리쳐", "오라", "카드",
  // 패키지/상자류 (고가 아이템 다수 포함)
  "패키지", "상자", "계약",
  // 자주 거래되는 키워드
  "강화", "증폭", "소울", "골고", "토큰", "큐브",
  "정수", "보주", "젤", "순례", "에픽",
  // 크리쳐/칭호/오라에 흔한 단어
  "운명", "전설", "영웅", "마스터", "서핑",
  "알", "봉인", "선물", "교환", "제련",
];

/**
 * 카테고리 정의 — itemType 필드만으로 분류
 * 이름("카드", "오라" 등)은 절대 보지 않음
 */
const CATEGORIES = [
  {
    category: "칭호",
    emoji: "👑",
    typeMatch: (type: string) => type === "칭호",
  },
  {
    category: "크리쳐",
    emoji: "🐉",
    typeMatch: (type: string) => type === "크리쳐",
  },
  {
    category: "오라",
    emoji: "✨",
    typeMatch: (type: string) => type === "오라",
  },
  {
    category: "마법부여",
    emoji: "🃏",
    // 마법부여 카테고리: 카드, 엠블렘 등
    typeMatch: (type: string) =>
      type === "카드" || type === "엠블렘" || type.includes("마법부여"),
  },
];

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return prices.filter(p => p >= median * 0.2 && p <= median * 3);
}

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

    // ── Step 1: 광범위 키워드 스윕으로 대량 수집 (5개씩 배치) ──
    let allRows: any[] = [];
    const seen = new Set<string>(); // 중복 제거용 (soldDate+itemName+unitPrice)

    for (let i = 0; i < SWEEP_KEYWORDS.length; i += 5) {
      const batch = SWEEP_KEYWORDS.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map((kw) => fetchSold(kw))
      );
      for (const rows of batchResults) {
        for (const row of rows) {
          const key = `${row.soldDate}_${row.itemName}_${row.unitPrice}`;
          if (!seen.has(key)) {
            seen.add(key);
            allRows.push(row);
          }
        }
      }
    }

    console.log(`[BIS] Total unique sold rows: ${allRows.length}`);

    // ── Step 2~4: 카테고리별 분류 → 그룹핑 → 이상치 제거 → Top 3 ──
    const results = [];

    for (const cat of CATEGORIES) {
      // itemType으로만 필터 (이름 무관)
      const filtered = allRows.filter((row) =>
        cat.typeMatch(row.itemType || "")
      );

      console.log(`[BIS] ${cat.category}: ${filtered.length} rows after type filter`);

      // 아이템별 그룹핑
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

      // 이상치 제거 → 평균 체결가 → 비싼 순 Top 3
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

      // ── Step 5: 경매장 현재 최저가 조회 ──
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