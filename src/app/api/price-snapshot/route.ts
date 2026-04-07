/**
 * /api/price-snapshot
 *
 * auction-sold에서 당일 거래 데이터를 수집하여
 * 품목별 일평균가를 DynamoDB에 저장하는 API.
 *
 * - 서버 시작 시 자동 워밍업
 * - /api/market-insight 호출 시에도 자동 트리거
 * - 하루에 여러 번 호출되어도 같은 날짜에 덮어씌움 (PutItem)
 *
 * totalValue = Σ(unitPrice × count) — 실제 거래 총액
 */

import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";
import { saveDailyPricesBatch, DailyPriceRecord } from "@/lib/price-history";

export const dynamic = "force-dynamic";

// 수집 대상 키워드 (market-insight와 동일)
const KEYWORDS = [
  "강화권", "카드", "큐브", "토큰", "증폭",
  "패키지", "순례", "골고", "에픽", "소울",
];

let lastSnapshotDate = "";
let snapshotPromise: Promise<any> | null = null;

/**
 * auction-sold 데이터를 수집하여 품목별 일평균을 계산하고 DynamoDB에 저장
 */
export async function collectAndSaveSnapshot(): Promise<{ saved: number; date: string }> {
  const today = new Date().toISOString().slice(0, 10);

  // 같은 날 이미 저장했으면 스킵
  if (lastSnapshotDate === today) {
    return { saved: 0, date: today };
  }

  const results = await Promise.all(
    KEYWORDS.map(async (kw) => {
      try {
        const { data, ok } = await neopleGet("/df/auction-sold", {
          itemName: kw,
          wordType: "full",
          limit: "400",
        });
        return ok && data.rows ? data.rows : [];
      } catch {
        return [];
      }
    })
  );

  const allRows = results.flat();

  // 품목별 집계
  const itemMap = new Map<string, {
    itemName: string;
    itemId: string;
    itemRarity: string;
    prices: number[];      // unitPrice 목록
    totalVolume: number;    // Σ count
    totalValue: number;     // Σ (unitPrice × count)
  }>();

  for (const row of allRows) {
    const name = row.itemName;
    if (!name || !row.unitPrice) continue;

    const count = row.count || 1;
    const unitPrice = row.unitPrice;

    const existing = itemMap.get(name);
    if (existing) {
      existing.prices.push(unitPrice);
      existing.totalVolume += count;
      existing.totalValue += unitPrice * count; // ★ 가격 × 수량
    } else {
      itemMap.set(name, {
        itemName: name,
        itemId: row.itemId || "",
        itemRarity: row.itemRarity || "",
        prices: [unitPrice],
        totalVolume: count,
        totalValue: unitPrice * count,          // ★ 가격 × 수량
      });
    }
  }

  // DailyPriceRecord 변환
  const records: DailyPriceRecord[] = [];
  for (const item of itemMap.values()) {
    if (item.prices.length === 0) continue;
    const avgPrice = Math.round(
      item.prices.reduce((a, b) => a + b, 0) / item.prices.length
    );
    records.push({
      itemName:    item.itemName,
      date:        today,
      avgPrice,
      minPrice:    Math.min(...item.prices),
      maxPrice:    Math.max(...item.prices),
      totalVolume: item.totalVolume,
      totalValue:  item.totalValue,
      itemId:      item.itemId,
      itemRarity:  item.itemRarity,
    });
  }

  // DynamoDB 저장
  if (records.length > 0) {
    await saveDailyPricesBatch(records);
    lastSnapshotDate = today;
    console.log(`[PriceSnapshot] Saved ${records.length} items for ${today}`);
  }

  return { saved: records.length, date: today };
}

/**
 * 스냅샷 수집을 중복 없이 실행 (Promise 공유)
 */
export function ensureSnapshotCollected(): Promise<{ saved: number; date: string }> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastSnapshotDate === today) {
    return Promise.resolve({ saved: 0, date: today });
  }
  if (!snapshotPromise) {
    snapshotPromise = collectAndSaveSnapshot().finally(() => {
      snapshotPromise = null;
    });
  }
  return snapshotPromise;
}

// 서버 시작 시 워밍업
ensureSnapshotCollected().catch(() => {});

export async function GET() {
  try {
    const result = await ensureSnapshotCollected();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}