/**
 * 경매장 데이터 공유 캐시 (stale-while-revalidate)
 *
 * ★ 속도 최적화:
 * 1. FRESH 상태 (10분 이내): 캐시 즉시 반환
 * 2. STALE 상태 (10~30분): 캐시 즉시 반환 + 백그라운드 갱신
 * 3. EXPIRED 상태 (30분 초과): 새로 빌드 (초기 로딩만)
 *
 * 서버 시작 시 워밍업하므로 첫 사용자 요청부터 즉시 응답 가능.
 */

interface SharedCache {
  trendingItems: any[];
  allAuctionRows: any[];
  updatedAt: number;
}

let sharedCache: SharedCache | null = null;
let buildPromise: Promise<SharedCache | null> | null = null;

const FRESH_TTL  = 10 * 60 * 1000;  // 10분: 캐시 그대로 사용
const STALE_TTL  = 30 * 60 * 1000;  // 30분: stale 허용 (백그라운드 갱신)
const API_BASE = "https://api.neople.co.kr";

// ── 키워드 ──
const KEYWORDS = [
  "카드", "강화권", "큐브", "토큰", "증폭",
  "패키지", "골고", "순례", "에픽", "소울",
  "칭호", "크리쳐", "오라", "상자",
  "계약", "운명", "알", "봉인",
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

  const start = Date.now();

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
      });
    }
  }

  const trendingItems = Array.from(itemMap.values())
    .sort((a, b) => b.auctionCount - a.auctionCount)
    .slice(0, 30);

  const elapsed = Date.now() - start;
  console.log(`[SHARED] Build done in ${elapsed}ms: ${trendingItems.length} trending, ${allRows.length} total rows`);

  return {
    trendingItems,
    allAuctionRows: allRows,
    updatedAt: Date.now(),
  };
}

export function getSharedCache(): SharedCache | null {
  return sharedCache;
}

/**
 * 캐시가 FRESH 상태인지 (10분 이내)
 */
export function isSharedCacheValid(): boolean {
  return !!sharedCache && (Date.now() - sharedCache.updatedAt < FRESH_TTL);
}

/**
 * 캐시가 STALE이지만 사용 가능한 상태인지 (30분 이내)
 */
export function isSharedCacheUsable(): boolean {
  return !!sharedCache && (Date.now() - sharedCache.updatedAt < STALE_TTL);
}

/**
 * 백그라운드에서 캐시를 갱신한다 (호출자를 블로킹하지 않음)
 */
function triggerBackgroundRefresh(): void {
  if (buildPromise) return; // 이미 빌드 중이면 스킵

  buildPromise = buildData()
    .then(data => {
      if (data) {
        sharedCache = data;
        console.log("[SHARED] Background refresh done");
      }
      return data;
    })
    .catch(err => {
      console.error("[SHARED] Background refresh failed:", err);
      return null;
    })
    .finally(() => {
      buildPromise = null;
    });
}

/**
 * 캐시를 가져온다.
 * - FRESH: 즉시 반환
 * - STALE: 즉시 반환 + 백그라운드 갱신 트리거
 * - EXPIRED/없음: 빌드 완료까지 대기
 */
export async function getSharedData(): Promise<SharedCache | null> {
  // 1. FRESH — 바로 반환
  if (isSharedCacheValid()) {
    return sharedCache;
  }

  // 2. STALE — 바로 반환하되 백그라운드 갱신
  if (isSharedCacheUsable()) {
    triggerBackgroundRefresh();
    return sharedCache;
  }

  // 3. EXPIRED 또는 없음 — 빌드 대기
  return getSharedBuildPromise();
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

// 서버 시작 시 워밍업 — 첫 사용자 요청 전에 캐시 준비
getSharedBuildPromise().then(data => {
  if (data) console.log("[SHARED] Warmup done:", data.trendingItems.length, "trending,", data.allAuctionRows.length, "total rows");
}).catch(() => {});