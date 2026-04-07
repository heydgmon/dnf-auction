/**
 * 일별 시세 스냅샷 수집 모듈
 *
 * auction-sold에서 당일 거래 데이터를 수집하여
 * 품목별 일평균가를 DynamoDB에 저장.
 *
 * totalValue = Σ(unitPrice × count) — 실제 거래 총액
 */

import { neopleGet } from "@/lib/neople";
import { saveDailyPricesBatch, DailyPriceRecord } from "@/lib/price-history";

const KEYWORDS = [
  "강화권", "카드", "큐브", "토큰", "증폭",
  "패키지", "순례", "골고", "에픽", "소울",
];

let lastSnapshotDate = "";
let snapshotPromise: Promise<{ saved: number; date: string }> | null = null;

export async function collectAndSaveSnapshot(): Promise<{ saved: number; date: string }> {
  const today = new Date().toISOString().slice(0, 10);

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

  const itemMap = new Map<string, {
    itemName: string;
    itemId: string;
    itemRarity: string;
    prices: number[];
    totalVolume: number;
    totalValue: number;
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
      existing.totalValue += unitPrice * count;
    } else {
      itemMap.set(name, {
        itemName: name,
        itemId: row.itemId || "",
        itemRarity: row.itemRarity || "",
        prices: [unitPrice],
        totalVolume: count,
        totalValue: unitPrice * count,
      });
    }
  }

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

  if (records.length > 0) {
    await saveDailyPricesBatch(records);
    lastSnapshotDate = today;
    console.log(`[PriceSnapshot] Saved ${records.length} items for ${today}`);
  }

  return { saved: records.length, date: today };
}

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