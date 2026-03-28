import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

/**
 * 인기 아이템 API
 *
 * Neople에는 "인기 아이템" 전용 엔드포인트가 없으므로,
 * 경매장 시세 API(/df/auction-sold)를 활용하여
 * 최근 거래가 활발한 아이템을 자동으로 추출합니다.
 *
 * 방식:
 * 1. 던파에서 자주 거래되는 대표 키워드들로 시세 API 호출
 * 2. 거래 결과를 아이템 이름별로 그룹핑
 * 3. 거래 건수(= 인기도)순으로 정렬
 * 4. 5분 캐시하여 API 호출 부담 최소화
 */

// ─── 인메모리 캐시 (5분) ───
let cache: { items: any[]; updatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분

// 던파에서 거래가 활발한 대표 키워드 (Open API를 통해 실제 데이터 수집)
const TRENDING_KEYWORDS = [
  "큐브",
  "강화권",
  "토큰",
  "정수",
  "카드",
  "증폭",
  "에픽",
  "속성",
  "보주",
  "젤",
];

export async function GET() {
  try {
    // 캐시가 유효하면 바로 반환
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json({ items: cache.items });
    }

    // 여러 키워드로 시세 API 병렬 호출
    const promises = TRENDING_KEYWORDS.map(async (keyword) => {
      try {
        const { data, ok } = await neopleGet("/df/auction-sold", {
          itemName: keyword,
          wordType: "full",
          limit: "20",
        });
        if (ok && data.rows) return data.rows;
        return [];
      } catch {
        return [];
      }
    });

    const allResults = await Promise.all(promises);
    const allRows = allResults.flat();

    // 아이템 이름별로 그룹핑하여 거래 건수 집계
    const itemMap = new Map<string, {
      itemName: string;
      tradeCount: number;
      lastPrice: number;
      itemRarity: string;
      itemId: string;
    }>();

    for (const row of allRows) {
      const name = row.itemName;
      if (!name) continue;

      const existing = itemMap.get(name);
      if (existing) {
        existing.tradeCount += 1;
        // 가장 최근 가격으로 업데이트
        if (row.unitPrice) existing.lastPrice = row.unitPrice;
      } else {
        itemMap.set(name, {
          itemName: name,
          tradeCount: 1,
          lastPrice: row.unitPrice || 0,
          itemRarity: row.itemRarity || "",
          itemId: row.itemId || "",
        });
      }
    }

    // 거래 건수순 정렬 → 상위 20개
    const sorted = [...itemMap.values()]
      .sort((a, b) => b.tradeCount - a.tradeCount)
      .slice(0, 20)
      .map((item) => ({
        itemName: item.itemName,
        searchCount: item.tradeCount, // 프론트 PopularItem 타입 호환
        lastPrice: item.lastPrice,
        itemRarity: item.itemRarity,
        itemId: item.itemId,
      }));

    // 캐시 업데이트
    cache = { items: sorted, updatedAt: Date.now() };

    return NextResponse.json({ items: sorted });
  } catch (err: any) {
    // 에러 시 캐시가 있으면 캐시 반환, 없으면 빈 배열
    if (cache) {
      return NextResponse.json({ items: cache.items });
    }
    return NextResponse.json({ items: [] });
  }
}