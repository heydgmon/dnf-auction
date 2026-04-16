/**
 * 경매장 데이터 공유 캐시 (stale-while-revalidate)
 *
 * ★ 속도 최적화:
 * 1. FRESH 상태 (10분 이내): 캐시 즉시 반환
 * 2. STALE 상태 (10~30분): 캐시 즉시 반환 + 백그라운드 갱신
 * 3. EXPIRED 상태 (30분 초과): 새로 빌드 (초기 로딩만)
 *
 * 서버 시작 시 워밍업하므로 첫 사용자 요청부터 즉시 응답 가능.
 *
 * ★ 거래 회전율 (turnoverRate):
 *   최근 7일 거래 건수 / 현재 등록 매물 수 × 100
 *   높을수록 "빠르게 팔리는" 아이템, 낮을수록 "쌓여있는" 아이템.
 */

import { getMultiItemPriceHistory } from "./price-history";

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

// 회전율 계산에 사용할 기간 (일)
const TURNOVER_WINDOW_DAYS = 7;
// 회전율 계산에 필요한 최소 매물 수 (노이즈 제거)
const MIN_LISTING_COUNT = 2;
// 상위 N개 아이템만 체결 데이터 조회 (API 호출 비용 절감)
const TOP_CANDIDATES_FOR_TURNOVER = 80;

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

/**
 * 특정 아이템의 최근 7일 체결 건수 조회 (auction-sold 직접 호출)
 * DynamoDB에 데이터가 없을 때의 fallback
 */
async function fetchSoldVolume(itemName: string, apiKey: string): Promise<number> {
  try {
    const res = await fetch(
      `${API_BASE}/df/auction-sold?itemName=${encodeURIComponent(itemName)}&wordType=match&limit=100&apikey=${encodeURIComponent(apiKey)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const rows = data.rows || [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TURNOVER_WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    return rows
      .filter((r: any) => (r.soldDate || "").slice(0, 10) >= cutoffStr)
      .filter((r: any) => (r.itemName || "") === itemName)
      .reduce((sum: number, r: any) => sum + (r.count || 1), 0);
  } catch {
    return 0;
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

  // 아이템별 집계 (매물 수 + 평균 개당 가격)
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

  // ── 회전율 계산 대상 선별 ──
  // 매물이 너무 적은 아이템은 제외 (노이즈), 너무 많은 후보는 API 비용 때문에 컷
  const candidates = Array.from(itemMap.values())
    .filter(i => i.auctionCount >= MIN_LISTING_COUNT)
    .sort((a, b) => b.auctionCount - a.auctionCount)
    .slice(0, TOP_CANDIDATES_FOR_TURNOVER);

  // ── 1단계: DynamoDB에서 7일치 체결량 조회 (주력) ──
  const candidateNames = candidates.map(c => c.itemName);
  const historyMap = await getMultiItemPriceHistory(candidateNames, TURNOVER_WINDOW_DAYS).catch(() => new Map());

  // ── 2단계: DB에 없는 아이템은 auction-sold API로 fallback (병렬, 상위만) ──
  const needsFallback: string[] = [];
  const soldVolumeMap = new Map<string, number>();

  for (const cand of candidates) {
    const records = historyMap.get(cand.itemName) || [];
    if (records.length > 0) {
      const vol = records.reduce((sum, rec) => sum + (rec.totalVolume || 0), 0);
      soldVolumeMap.set(cand.itemName, vol);
    } else {
      needsFallback.push(cand.itemName);
    }
  }

  // fallback은 상위 30개로 제한 (API 호출 폭발 방지)
  const fallbackTargets = needsFallback.slice(0, 30);
  const fallbackResults = await Promise.all(
    fallbackTargets.map(async (name) => ({
      name,
      volume: await fetchSoldVolume(name, apiKey),
    }))
  );
  for (const { name, volume } of fallbackResults) {
    soldVolumeMap.set(name, volume);
  }

  // ── 회전율 계산 및 정렬 ──
  const ranked = candidates
    .map(cand => {
      const soldVolume = soldVolumeMap.get(cand.itemName) ?? 0;
      // 회전율 = (7일 체결량 / 현재 매물 수) × 100
      const turnoverRate = cand.auctionCount > 0
        ? Math.round((soldVolume / cand.auctionCount) * 100)
        : 0;
      return {
        ...cand,
        soldVolume,
        turnoverRate,
      };
    })
    // 거래가 전혀 없는 아이템은 제외 (쌓여만 있는 것)
    .filter(i => i.soldVolume > 0)
    .sort((a, b) => b.turnoverRate - a.turnoverRate);

  const trendingItems = ranked.slice(0, 30);

  const elapsed = Date.now() - start;
  console.log(`[SHARED] Build done in ${elapsed}ms: ${trendingItems.length} trending (turnover), ${allRows.length} total rows, ${fallbackTargets.length} fallback fetches`);

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