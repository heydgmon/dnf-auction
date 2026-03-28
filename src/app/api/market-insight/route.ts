import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000; // 3분

// 인사이트용 대표 아이템 (거래 활발 + 다양한 가격대)
const INSIGHT_ITEMS = [
  "무색 큐브 조각",
  "흑색 큐브 조각",
  "적색 큐브 조각",
  "PC방 토큰 교환권",
  "닳아버린 순례의 증표",
  "적아 울라드 카드",
  "에픽 소울 결정",
  "광휘의 소울 결정",
  "태초 소울 결정",
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
  totalValue: number; // 거래 총액 (시가총액 대용)
  priceChange: number; // 가격 변동률 (%)
}

async function fetchSoldData(itemName: string): Promise<any[]> {
  try {
    const { data, ok } = await neopleGet("/df/auction-sold", {
      itemName,
      wordType: "match",
      limit: "100",
    });
    if (ok && data.rows) return data.rows;
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
    // rows는 최신순 정렬 가정
    const recentAvg = prices.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const olderAvg = prices.slice(half).reduce((a, b) => a + b, 0) / (prices.length - half);
    if (olderAvg > 0) {
      priceChange = Math.round(((recentAvg - olderAvg) / olderAvg) * 10000) / 100;
    }
  }

  // 거래 내역 (날짜별 그룹핑)
  const dateMap = new Map<string, { prices: number[]; volume: number }>();
  for (const r of rows) {
    const date = (r.soldDate || "").slice(0, 10); // YYYY-MM-DD
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

    // 5개씩 배치로 호출
    const BATCH = 5;
    let allRows: { itemName: string; rows: any[] }[] = [];

    for (let i = 0; i < INSIGHT_ITEMS.length; i += BATCH) {
      const batch = INSIGHT_ITEMS.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (name) => ({
          itemName: name,
          rows: await fetchSoldData(name),
        }))
      );
      allRows = allRows.concat(results);
    }

    const insights: ItemInsight[] = allRows
      .map(({ itemName, rows }) => buildInsight(itemName, rows))
      .filter(Boolean) as ItemInsight[];

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