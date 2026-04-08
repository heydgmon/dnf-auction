/**

* [시세 스냅샷 저장 트리거 흐름]
*
* 1. 사용자가 "경매장" 또는 "시세" 탭 클릭
* 2. /api/market-insight API 호출
* 3. buildInsightData() 실행
* 4. ensureSnapshotCollected() 호출 (오늘 스냅샷 존재 여부 확인)
* 5. collectAndSaveSnapshot() 실행 (미수집 시 데이터 수집)
* 6. saveDailyPricesBatch() 호출 (DynamoDB 배치 저장)
* 7. DynamoDB에 일별 시세 데이터 저장 완료
*
* ※ 특징:
* * 사용자 요청 기반 lazy 트리거 방식
* * 하루 1회 저장 (메모리 기준 중복 방지)
* * 서버 시작 시가 아닌, API 최초 호출 시 실행될 수 있음
    */

import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";
import {
  getMultiItemPriceHistory,
  DailyPriceRecord,
} from "@/lib/price-history";
import { ensureSnapshotCollected } from "@/lib/snapshot-collector";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
let buildPromise: Promise<any> | null = null;
const CACHE_TTL = 3 * 60 * 1000;

const KEYWORDS = [
  "강화권", "카드", "큐브", "토큰", "증폭",
  "패키지", "순례", "골고", "에픽", "소울",
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
  totalValue: number;   // ★ unitPrice × count 합산
  priceChange: number;  // ★ 전날 대비 변동률
}

async function buildInsightData(): Promise<ItemInsight[]> {
  // 1. 먼저 오늘의 스냅샷이 DynamoDB에 저장되도록 보장
  await ensureSnapshotCollected().catch(() => {});

  // 2. auction-sold에서 당일 데이터 가져오기 (실시간 데이터용)
  const results = await Promise.all(
    KEYWORDS.map(async (kw) => {
      try {
        const { data, ok } = await neopleGet("/df/auction-sold", {
          itemName: kw,
          wordType: "full",
          limit: "100",
        });
        return ok && data.rows ? data.rows : [];
      } catch {
        return [];
      }
    })
  );

  const allRows = results.flat();

  // 3. 품목별 당일 데이터 집계
  const itemMap = new Map<string, {
    itemName: string;
    itemId: string;
    itemRarity: string;
    prices: number[];
    totalVolume: number;   // Σ count
    totalValue: number;    // ★ Σ (unitPrice × count)
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

  // 4. 상위 20개 아이템 선택 (totalValue 기준)
  const sorted = [...itemMap.values()]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 20);

  // 5. DynamoDB에서 7일치 히스토리 조회
  const itemNames = sorted.map(i => i.itemName);
  const historyMap = await getMultiItemPriceHistory(itemNames, 7);

  // 6. 인사이트 데이터 조합
  return sorted.map(item => {
    const prices = item.prices;
    const avgPrice = Math.round(
      prices.reduce((a, b) => a + b, 0) / prices.length
    );

    // DynamoDB 히스토리 → trades 배열
    const dbHistory = historyMap.get(item.itemName) || [];
    const today = new Date().toISOString().slice(0, 10);

    // DB 히스토리 + 오늘 당일 데이터 병합
    const tradesMap = new Map<string, { unitPrice: number; count: number }>();
    for (const rec of dbHistory) {
      tradesMap.set(rec.date, {
        unitPrice: rec.avgPrice,
        count: rec.totalVolume,
      });
    }
    // 오늘 데이터 덮어쓰기 (최신 실시간)
    tradesMap.set(today, {
      unitPrice: avgPrice,
      count: item.totalVolume,
    });

    const trades = [...tradesMap.entries()]
      .map(([date, { unitPrice, count }]) => ({ date, unitPrice, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ★ 가격 변동률: 전날 DB 저장값 vs 오늘 평균가
    let priceChange = 0;
    if (dbHistory.length > 0) {
      // 어제(= DB에서 오늘을 제외한 가장 최근 날짜) 기준
      const yesterdayRecords = dbHistory.filter(r => r.date !== today);
      if (yesterdayRecords.length > 0) {
        const lastRecord = yesterdayRecords[yesterdayRecords.length - 1];
        if (lastRecord.avgPrice > 0) {
          priceChange = Math.round(
            ((avgPrice - lastRecord.avgPrice) / lastRecord.avgPrice) * 10000
          ) / 100;
        }
      }
    }

    return {
      itemName: item.itemName,
      itemId: item.itemId,
      itemRarity: item.itemRarity,
      trades,
      avgPrice,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      totalVolume: item.totalVolume,
      totalValue: item.totalValue,   // ★ 이미 unitPrice × count
      priceChange,                   // ★ 전날 대비
    };
  });
}

function getBuildPromise(): Promise<ItemInsight[]> {
  if (!buildPromise) {
    buildPromise = buildInsightData().finally(() => {
      buildPromise = null;
    });
  }
  return buildPromise as Promise<ItemInsight[]>;
}

getBuildPromise()
  .then(items => {
    if (items.length > 0) {
      cache = {
        data: { items, updatedAt: new Date().toISOString() },
        updatedAt: Date.now(),
      };
      console.log("[INSIGHT] Warmup done:", items.length);
    }
  })
  .catch(() => {});

export async function GET() {
  try {
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }
    const items = await getBuildPromise();
    const result = { items, updatedAt: new Date().toISOString() };
    cache = { data: result, updatedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err: any) {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ items: [], error: err.message });
  }
}