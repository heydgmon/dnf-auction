/**
 * 경매장 데이터 공유 캐시
 *
 * 서버 시작 시 한번 Neople API를 호출하여 경매장 등록 아이템을 수집.
 * trending, insight, bis API가 이 캐시를 공유.
 * 던파 경매장 데이터를 잠깐 저장해두는 공용 창고
 * ★ 핵심: 키워드를 매우 넓게 잡아서 칭호/크리쳐/오라/카드 등
 *   이름에 카테고리 단어가 없는 아이템도 수집
 */

interface SharedCache {
  trendingItems: any[];
  allAuctionRows: any[];
  updatedAt: number; // trendingItems → 인기 아이템 목록 allAuctionRows → 원본 경매장 데이터 전체 updatedAt → 언제 저장했는지 시간
}

let sharedCache: SharedCache | null = null;
let buildPromise: Promise<SharedCache | null> | null = null;

const CACHE_TTL = 3 * 60 * 1000; //저장한 데이터는 3분 동안 유효하다
const API_BASE = "https://api.neople.co.kr";

// ── 광범위 키워드 ──
// 경매장의 모든 탭(장비/소비/기타/칭호/크리쳐/오라/카드 등)을 커버하려면
// 아이템 이름에 자주 등장하는 짧은 글자로 수집해야 함
// wordType=full + limit=400으로 각 키워드당 최대 400건
const KEYWORDS = [
  // 거래 활발 키워드 (기존)
  "카드", "강화권", "큐브", "토큰", "증폭",
  "패키지", "골고", "순례", "에픽", "소울",
  // 칭호/크리쳐/오라를 잡기 위한 넓은 키워드
  "칭호", "크리쳐", "오라", "상자",
  "계약", "운명", "알", "봉인",
  // 1글자 — 이름에 카테고리명이 없는 아이템까지 수집
  "의", "은",
];

async function fetchAuction(keyword: string, apiKey: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${API_BASE}/df/auction?itemName=${encodeURIComponent(keyword)}&wordType=full&limit=400&apikey=${encodeURIComponent(apiKey)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.rows || [];
  } catch {
    return [];
  }
}

async function buildData(): Promise<SharedCache | null> {
  const apiKey = process.env.NEOPLE_API_KEY;
  if (!apiKey) return null;

  // 전부 동시 호출
  const results = await Promise.all(
    KEYWORDS.map((kw) => fetchAuction(kw, apiKey))
  );

  // auctionNo 기준 중복 제거
  const seen = new Set<number>();
  const allRows: any[] = [];
  for (const rows of results) {
    for (const row of rows) {
      if (row.auctionNo && !seen.has(row.auctionNo)) {
        seen.add(row.auctionNo);
        allRows.push(row);
      }
    }
  }

  // trending용 가공
  const itemMap = new Map<string, {
    itemName: string;
    auctionCount: number;
    itemRarity: string;
    itemId: string;
    itemType: string;
  }>();

  for (const row of allRows) {
    const name = row.itemName;
    if (!name) continue;
    const existing = itemMap.get(name);
    if (existing) {
      existing.auctionCount += 1;
    } else {
      itemMap.set(name, {
        itemName: name,
        auctionCount: 1,
        itemRarity: row.itemRarity || "",
        itemId: row.itemId || "",
        itemType: row.itemType || "",
      }); //같은 이름의 아이템을 묶어서 몇 개 등록됐는지 세기 위한 도구
    }
  }

  const trendingItems = Array.from(itemMap.values())
    .sort((a, b) => b.auctionCount - a.auctionCount)
    .slice(0, 30);

  // 디버그: 카테고리별 수집 현황
  const typeCounts = new Map<string, number>();
  for (const row of allRows) {
    const t = row.itemType || "unknown";
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  console.log("[SHARED] itemType distribution:");
  for (const [type, count] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${type}: ${count}`);
  }

  return {
    trendingItems,
    allAuctionRows: allRows,
    updatedAt: Date.now(),
  };
}

export function getSharedCache(): SharedCache | null {
  return sharedCache;
}

export function isSharedCacheValid(): boolean {
  return !!sharedCache && (Date.now() - sharedCache.updatedAt < CACHE_TTL);
}

export function getSharedBuildPromise(): Promise<SharedCache | null> {
  if (!buildPromise) {
    buildPromise = buildData()
      .then(data => {
        if (data) sharedCache = data;
        return data;
      })
      .finally(() => { buildPromise = null; });
  }
  return buildPromise;
}

// 서버 시작 시 워밍업
getSharedBuildPromise().then(data => {
  if (data) console.log("[SHARED] Warmup done:", data.trendingItems.length, "trending,", data.allAuctionRows.length, "total rows");
}).catch(() => {});