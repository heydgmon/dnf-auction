import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000;

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

// ★ 트렌딩 API에서 인기 아이템을 동적으로 가져옴
async function getTopItemNames(): Promise<string[]> {
  try {
    // 같은 서버 내 trending API의 로직을 직접 호출하기 어려우므로
    // popular-items API와 동일한 방식으로 시세 데이터에서 추출
    const KEYWORDS = ["강화권", "카드", "큐브", "토큰", "증폭", "패키지", "순례", "골고", "에픽", "소울"];
    const allRows: any[] = [];

    // 5개씩 배치
    for (let i = 0; i < KEYWORDS.length; i += 5) {
      const batch = KEYWORDS.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (kw) => {
          try {
            const { data, ok } = await neopleGet("/df/auction-sold", {
              itemName: kw,
              wordType: "full",
              limit: "100",
            });
            return ok && data.rows ? data.rows : [];
          } catch { return []; }
        })
      );
      allRows.push(...results.flat());
    }

    // 아이템별 거래총액 집계 → 상위 15개 선정
    const itemMap = new Map<string, { totalValue: number; count: number }>();
    for (const row of allRows) {
      const name = row.itemName;
      if (!name) continue;
      const existing = itemMap.get(name) || { totalValue: 0, count: 0 };
      existing.totalValue += (row.unitPrice || 0) * (row.count || 1);
      existing.count += row.count || 1;
      itemMap.set(name, existing);
    }

    return [...itemMap.entries()]
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .slice(0, 15)
      .map(([name]) => name);
  } catch {
    return [];
  }
}

async function fetchSoldData(itemName: string): Promise<any[]> {
  try {
    // ★ wordType=full → match 로 변경하여 정확한 아이템만 가져옴
    // 먼저 match로 시도, 없으면 full로 fallback
    let { data, ok } = await neopleGet("/df/auction-sold", {
      itemName,
      wordType: "match",
      limit: "100",
    });
    if (ok && data.rows && data.rows.length > 0) return data.rows;

    // match로 결과 없으면 full로 재시도
    ({ data, ok } = await neopleGet("/df/auction-sold", {
      itemName,
      wordType: "full",
      limit: "100",
    }));
    if (ok && data.rows) {
      // full 결과에서 이름이 정확히 일치하는 것만 필터
      return data.rows.filter((r: any) => r.itemName === itemName);
    }
    return [];
  } catch {
    return [];
  }
}

function buildInsight(itemName: string, rows: any[]): ItemInsight | null {
  if (!rows.length) return null;

  const prices = rows.map(r => r.unitPrice).filter(Boolean);
  if (!prices.length) return null;

  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const totalVolume = rows.reduce((sum, r) => sum + (r.count || 1), 0);
  const totalValue = rows.reduce((sum, r) => sum + (r.unitPrice * (r.count || 1)), 0);

  // 가격 변동률: 최근 절반 vs 이전 절반 평균 비교
  const half = Math.floor(prices.length / 2);
  let priceChange = 0;
  if (half > 0) {
    const recentAvg = prices.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const olderAvg = prices.slice(half).reduce((a, b) => a + b, 0) / (prices.length - half);
    if (olderAvg > 0) {
      priceChange = Math.round(((recentAvg - olderAvg) / olderAvg) * 10000) / 100;
    }
  }

  // 거래 내역 (날짜별 그룹핑)
  const dateMap = new Map<string, { prices: number[]; volume: number }>();
  for (const r of rows) {
    const date = (r.soldDate || "").slice(0, 10);
    if (!date) continue;
    const entry = dateMap.get(date) || { prices: [], volume: 0 };
    entry.prices.push(r.unitPrice);
    entry.volume += r.count || 1;
    dateMap.set(date, entry);
  }

  const trades = [...dateMap.entries()]
    .map(([date, { prices: p, volume }]) => ({
      date,
      unitPrice: Math.round(p.reduce((a, b) => a + b, 0) / p.length),
      count: volume,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    itemName,
    itemId: rows[0]?.itemId || "",
    itemRarity: rows[0]?.itemRarity || "",
    trades,
    avgPrice,
    minPrice,
    maxPrice,
    totalVolume,
    totalValue,
    priceChange,
  };
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // ★ 동적으로 인기 아이템 선정
    const itemNames = await getTopItemNames();
    if (itemNames.length === 0) {
      return NextResponse.json({ items: [], error: "No trending items found" });
    }

    // 5개씩 배치로 시세 데이터 수집
    const BATCH = 5;
    let allData: { itemName: string; rows: any[] }[] = [];

    for (let i = 0; i < itemNames.length; i += BATCH) {
      const batch = itemNames.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (name) => ({
          itemName: name,
          rows: await fetchSoldData(name),
        }))
      );
      allData = allData.concat(results);
    }

    const insights: ItemInsight[] = allData
      .map(({ itemName, rows }) => buildInsight(itemName, rows))
      .filter(Boolean) as ItemInsight[];

    // ★ 거래 총액 기준 정렬
    insights.sort((a, b) => b.totalValue - a.totalValue);

    const result = {
      items: insights,
      updatedAt: new Date().toISOString(),
    };

    cache = { data: result, updatedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err: any) {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ items: [], error: err.message });
  }
}