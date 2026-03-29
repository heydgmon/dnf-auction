import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

const CATEGORIES = [
  {
    category: "칭호",
    emoji: "👑",
    keywords: ["칭호", "용사", "모험가", "아르카나", "여행자", "서핑", "마스터", "영웅", "전설"],
    typeFilter: (type: string) => type === "칭호",
  },
  {
    category: "크리쳐",
    emoji: "🐉",
    keywords: ["크리쳐", "정령", "수호자", "백호", "여왕", "드래곤", "펫"],
    typeFilter: (type: string) => type === "크리쳐",
  },
  {
    category: "오라",
    emoji: "✨",
    keywords: ["오라", "계약", "상자"],
    typeFilter: (type: string, name: string) =>
      type.includes("오라") || name.includes("오라") || name.includes("계약"),
  },
  {
    category: "마법부여 카드",
    emoji: "🃏",
    keywords: ["카드"],
    typeFilter: (type: string, name: string) =>
      type === "카드" || name.includes("카드"),
  },
];

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const upperBound = median * 3;
  const lowerBound = median * 0.2;
  return prices.filter(p => p >= lowerBound && p <= upperBound);
}

async function fetchSoldForKeyword(keyword: string): Promise<any[]> {
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

export async function GET() {
  try {
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const results = [];

    for (const cat of CATEGORIES) {
      let allRows: any[] = [];
      for (let i = 0; i < cat.keywords.length; i += 3) {
        const batch = cat.keywords.slice(i, i + 3);
        const batchResults = await Promise.all(
          batch.map((kw) => fetchSoldForKeyword(kw))
        );
        allRows = allRows.concat(batchResults.flat());
      }

      const filtered = allRows.filter((row) =>
        cat.typeFilter(row.itemType || "", row.itemName || "")
      );

      const itemMap = new Map<
        string,
        {
          itemName: string;
          itemId: string;
          itemRarity: string;
          prices: number[];
          tradeCount: number;
        }
      >();

      for (const row of filtered) {
        const name = row.itemName;
        if (!name || !row.unitPrice) continue;

        const existing = itemMap.get(name);
        if (existing) {
          existing.prices.push(row.unitPrice);
          existing.tradeCount += row.count || 1;
        } else {
          itemMap.set(name, {
            itemName: name,
            itemId: row.itemId || "",
            itemRarity: row.itemRarity || "",
            prices: [row.unitPrice],
            tradeCount: row.count || 1,
          });
        }
      }

      const ranked = [...itemMap.values()]
        .map((item) => {
          const cleaned = removeOutliers(item.prices);
          const avgPrice =
            cleaned.length > 0
              ? Math.round(cleaned.reduce((a, b) => a + b, 0) / cleaned.length)
              : 0;
          return {
            itemName: item.itemName,
            itemId: item.itemId,
            itemRarity: item.itemRarity,
            avgPrice,
            tradeCount: item.tradeCount,
            dataPoints: item.prices.length,
          };
        })
        .filter((item) => item.avgPrice > 0 && item.dataPoints >= 1)
        .sort((a, b) => b.avgPrice - a.avgPrice)
        .slice(0, 3);

      results.push({
        category: cat.category,
        emoji: cat.emoji,
        items: ranked,
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