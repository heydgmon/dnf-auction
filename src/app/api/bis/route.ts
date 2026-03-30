import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";
import { isSharedCacheValid, getSharedCache, getSharedBuildPromise } from "@/lib/auction-shared-cache";

export const dynamic = "force-dynamic";

let bisCache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// ── 하드코딩 아이템 목록 ──
// searchKeyword : API 검색에 쓸 키워드 (wordType: "full" — 포함 검색)
// displayName   : 실제 표시할 이름 (결과 필터링 기준, itemName.includes(displayName))
interface HardcodedItem {
  searchKeyword: string; // API 호출 시 itemName 파라미터
  displayName: string;   // 결과 필터링 및 카드 표시용
}

const HARDCODED_ITEMS: Record<string, HardcodedItem[]> = {
  "칭호": [
    { searchKeyword: "프로스트의 전설", displayName: "프로스트의 전설" },
    { searchKeyword: "군자의 사계",     displayName: "군자의 사계" },
  ],
  "오라": [
    { searchKeyword: "카드 오브 파툼 오라 상자",       displayName: "카드 오브 파툼 오라 상자" },
    { searchKeyword: "고결한 영혼의 잔상 오라 상자",   displayName: "고결한 영혼의 잔상 오라 상자" },
    { searchKeyword: "초월한 폭풍의 기세 오라 상자",   displayName: "초월한 폭풍의 기세 오라 상자" },
  ],
  "마법부여": [
    { searchKeyword: "조율의 감시자 오르테르 카드", displayName: "조율의 감시자 오르테르 카드" },
    { searchKeyword: "거짓의 베리디쿠스 카드",     displayName: "거짓의 베리디쿠스 카드" },
    { searchKeyword: "해방된 비올렌티아 카드",     displayName: "해방된 비올렌티아 카드" },
  ],
};

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

async function fetchSoldByKeyword(searchKeyword: string, displayName: string): Promise<any[]> {
  try {
    const { data, ok } = await neopleGet("/df/auction-sold", { itemName: searchKeyword, wordType: "match", limit: "100" });
    if (!ok || !data.rows) return [];
    const filtered = data.rows.filter((r: any) => (r.itemName as string).includes(displayName));
    return filtered.length > 0 ? filtered : data.rows;
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

async function fetchCurrentLowestByKeyword(searchKeyword: string, displayName: string): Promise<number | null> {
  try {
    const { data, ok } = await neopleGet("/df/auction", { itemName: searchKeyword, wordType: "match", limit: "20" });
    if (!ok || !data.rows || data.rows.length === 0) return null;
    const filtered = data.rows.filter((r: any) => (r.itemName as string).includes(displayName));
    const target = filtered.length > 0 ? filtered : data.rows;
    const prices = target.map((r: any) => r.unitPrice).filter(Boolean);
    return prices.length > 0 ? Math.min(...prices) : null;
  } catch { return null; }
}

// 하드코딩 아이템 목록을 크리쳐와 동일한 방식으로 처리
async function resolveHardcodedItems(items: HardcodedItem[]): Promise<any[]> {
  const soldResults = await Promise.all(
    items.map(async ({ searchKeyword, displayName }) => ({
      searchKeyword,
      displayName,
      rows: await fetchSoldByKeyword(searchKeyword, displayName),
    }))
  );

  const ranked = await Promise.all(
    soldResults.map(async ({ searchKeyword, displayName, rows }) => {
      const lowestPrice = await fetchCurrentLowestByKeyword(searchKeyword, displayName);

      if (rows.length > 0) {
        // 시세 데이터 있음 → 실체결 기준
        const prices = rows.map((r: any) => r.unitPrice).filter(Boolean);
        if (prices.length === 0) {
          return {
            itemName: displayName,
            itemId: rows[0]?.itemId || "",
            itemRarity: rows[0]?.itemRarity || "",
            avgPrice: lowestPrice ?? 0,
            tradeCount: 0,
            totalValue: lowestPrice ?? 0,
            lowestPrice,
            source: "경매장",
          };
        }
        const cleaned = removeOutliers(prices);
        const avgPrice = cleaned.length > 0
          ? Math.round(cleaned.reduce((a, b) => a + b, 0) / cleaned.length)
          : 0;
        const totalValue = cleaned.reduce((a, b) => a + b, 0);
        return {
          itemName: displayName,
          itemId: rows[0].itemId || "",
          itemRarity: rows[0].itemRarity || "",
          avgPrice,
          tradeCount: rows.reduce((s: number, r: any) => s + (r.count || 1), 0),
          totalValue,
          lowestPrice,
          source: "시세",
        };
      } else {
        // 시세 데이터 없음 → 경매장 최저가만
        // itemId/itemRarity는 경매장 API에서 fallback으로 조회
        let itemId = "";
        let itemRarity = "";
        try {
          const { data: aData, ok: aOk } = await neopleGet("/df/auction", { itemName: searchKeyword, wordType: "match", limit: "5" });
          if (aOk && aData.rows) {
            const match = aData.rows.find((r: any) => (r.itemName as string).includes(displayName));
            if (match) {
              itemId = match.itemId || "";
              itemRarity = match.itemRarity || "";
            }
          }
        } catch { /* itemId/itemRarity 없어도 무방 */ }

        return {
          itemName: displayName,
          itemId,
          itemRarity,
          avgPrice: lowestPrice ?? 0,
          tradeCount: 0,
          totalValue: lowestPrice ?? 0,
          lowestPrice,
          source: "경매장",
        };
      }
    })
  );

  // totalValue 기준 정렬 (0인 항목은 뒤로)
  return ranked.sort((a, b) => {
    if (a.totalValue === 0 && b.totalValue === 0) return 0;
    if (a.totalValue === 0) return 1;
    if (b.totalValue === 0) return -1;
    return b.totalValue - a.totalValue;
  });
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
      const hardcoded = HARDCODED_ITEMS[cat.category];

      // ── 하드코딩 카테고리: shared cache 우회, 직접 API 조회 ──
      if (hardcoded) {
        console.log(`[BIS] ${cat.category}: using hardcoded items (${hardcoded.length})`);
        const items = await resolveHardcodedItems(hardcoded);
        results.push({ category: cat.category, emoji: cat.emoji, items });
        continue;
      }

      // ── 기존 로직: shared cache 기반 (크리쳐 등) ──
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
            const avgPrice = cleaned.length > 0
              ? Math.round(cleaned.reduce((a, b) => a + b, 0) / cleaned.length)
              : 0;
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