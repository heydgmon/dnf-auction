import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

let cache: { data: any; updatedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000;

// ─── 카테고리별 종결템 목록 ───
// 던파 시즌에 따라 수동 업데이트 필요
const BIS_DATA = [
  {
    category: "칭호",
    emoji: "👑",
    items: [
      "이 세계의 진정한 용사",
      "무한한 가능성의 모험가",
      "운명의 아르카나",
      "차원을 넘어선 여행자",
      "서핑 아라드",
    ],
  },
  {
    category: "크리쳐",
    emoji: "🐉",
    items: [
      "정령왕 에키드나",
      "빛의 수호자 아이리스",
      "화염의 정령왕",
      "신성한 백호",
      "얼음 여왕 프레이야",
    ],
  },
  {
    category: "오라",
    emoji: "✨",
    items: [
      "그랜드 마스터 계약",
      "차원 행운의 오라",
      "빛나는 영광의 오라",
      "심연의 힘 오라",
      "대자연의 숨결 오라",
    ],
  },
  {
    category: "마법부여 카드",
    emoji: "🃏",
    items: [
      "적아 울라드 카드",
      "광휘의 소울",
      "에픽 소울 결정",
      "태초 소울 결정",
      "유니크 소울 결정",
    ],
  },
];

async function fetchLowestPrice(itemName: string): Promise<{
  itemName: string;
  itemId: string;
  itemRarity: string;
  lowestPrice: number;
  auctionCount: number;
} | null> {
  try {
    // 먼저 match로 정확 검색
    let { data, ok } = await neopleGet("/df/auction", {
      itemName,
      wordType: "match",
      limit: "10",
    });

    let rows = ok && data.rows ? data.rows : [];

    // match 결과 없으면 full로 재시도 후 이름 필터
    if (rows.length === 0) {
      ({ data, ok } = await neopleGet("/df/auction", {
        itemName,
        wordType: "full",
        limit: "50",
      }));
      rows = ok && data.rows ? data.rows.filter((r: any) => r.itemName === itemName) : [];
    }

    if (rows.length === 0) return null;

    // 최저가 순 정렬
    rows.sort((a: any, b: any) => (a.unitPrice || 0) - (b.unitPrice || 0));

    return {
      itemName: rows[0].itemName,
      itemId: rows[0].itemId || "",
      itemRarity: rows[0].itemRarity || "",
      lowestPrice: rows[0].unitPrice || 0,
      auctionCount: rows.length,
    };
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

    for (const cat of BIS_DATA) {
      // 카테고리 내 아이템 5개씩 병렬 호출
      const itemResults = await Promise.all(
        cat.items.map((name) => fetchLowestPrice(name))
      );

      results.push({
        category: cat.category,
        emoji: cat.emoji,
        items: itemResults.filter(Boolean),
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