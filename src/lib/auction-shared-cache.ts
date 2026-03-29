/**
 * 경매장 데이터 공유 캐시
 *
 * trending API가 수집한 전체 raw row를 여기에 저장하면
 * BIS API가 별도 API 호출 없이 itemType으로 분류 가능
 */

interface AuctionRow {
  itemName: string;
  itemId: string;
  itemRarity: string;
  itemType: string;
  unitPrice: number;
  count: number;
  [key: string]: any;
}

interface SharedCache {
  // trending용 가공 데이터
  trendingItems: any[];
  // BIS용 raw row (itemType 분류에 사용)
  allAuctionRows: AuctionRow[];
  updatedAt: number;
}

let sharedCache: SharedCache | null = null;
let buildPromise: Promise<SharedCache | null> | null = null;

const CACHE_TTL = 3 * 60 * 1000;
const API_BASE = "https://api.neople.co.kr";

// 광범위 키워드 — 경매장의 다양한 카테고리를 커버
const KEYWORDS = [
  "카드", "강화권", "큐브", "토큰", "증폭",
  "패키지", "골고", "순례", "크리쳐", "오라",
  "칭호", "상자", "계약", "운명", "알",
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

  // 중복 제거 (auctionNo 기준)
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
      });
    }
  }

  const trendingItems = Array.from(itemMap.values())
    .sort((a, b) => b.auctionCount - a.auctionCount)
    .slice(0, 30);

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