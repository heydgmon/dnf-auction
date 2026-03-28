import { NextResponse } from "next/server";

// Next.js가 빌드 시 정적으로 캐시하지 않도록 강제
export const dynamic = "force-dynamic";

const API_BASE = "https://api.neople.co.kr";
const PAGE_LIMIT = 400;
const MAX_PAGES = 2;

let cache: { items: any[]; updatedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000;

// ─── 서버 시작 직후 워밍업 플래그 ───
let warmupPromise: Promise<void> | null = null;

const KEYWORDS = [
  "카드", "강화권", "큐브", "토큰", "정수", "증폭", "보주",
  "속성", "젤", "에픽", "소울", "순례", "패키지", "골고",
  "리노", "서약", "칭호", "크리쳐", "오라", "무기",
];

async function fetchKeyword(keyword: string, apiKey: string): Promise<any[]> {
  let allRows: any[] = [];
  let lastAuctionNo: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = [
      `itemName=${encodeURIComponent(keyword)}`,
      `wordType=full`,
      `limit=${PAGE_LIMIT}`,
      `apikey=${encodeURIComponent(apiKey)}`,
    ];

    if (lastAuctionNo !== null) {
      params.push(`auctionNo=${lastAuctionNo}`);
    }

    try {
      const res = await fetch(`${API_BASE}/df/auction?${params.join("&")}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) break;
      const data = await res.json();
      if (!data.rows || data.rows.length === 0) break;

      const newRows = lastAuctionNo !== null
        ? data.rows.filter((r: any) => r.auctionNo !== lastAuctionNo)
        : data.rows;

      allRows = allRows.concat(newRows);
      lastAuctionNo = data.rows[data.rows.length - 1].auctionNo;

      if (data.rows.length < PAGE_LIMIT) break;
    } catch {
      break;
    }
  }

  return allRows;
}

async function buildTrendingData(): Promise<any[]> {
  const apiKey = process.env.NEOPLE_API_KEY;
  if (!apiKey) return [];

  // ── 동시 요청 제한: 5개씩 배치로 나눠서 호출 ──
  const BATCH_SIZE = 5;
  let allRows: any[] = [];

  for (let i = 0; i < KEYWORDS.length; i += BATCH_SIZE) {
    const batch = KEYWORDS.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((keyword) => fetchKeyword(keyword, apiKey))
    );
    allRows = allRows.concat(results.flat());
  }

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

  return Array.from(itemMap.values())
    .sort((a, b) => b.auctionCount - a.auctionCount)
    .slice(0, 30);
}

// ─── 서버 모듈 로드 시 백그라운드 워밍업 시작 ───
// 서버가 시작되자마자 캐시를 미리 채워둠
function startWarmup() {
  if (warmupPromise) return warmupPromise;
  warmupPromise = (async () => {
    try {
      console.log("[TRENDING] Background warmup started");
      const items = await buildTrendingData();
      if (items.length > 0) {
        cache = { items, updatedAt: Date.now() };
        console.log("[TRENDING] Background warmup done:", items.length, "items cached");
      }
    } catch (err: any) {
      console.log("[TRENDING] Background warmup failed:", err.message);
    } finally {
      warmupPromise = null;
    }
  })();
  return warmupPromise;
}

// 서버 시작 시 자동 워밍업
startWarmup();

export async function GET() {
  console.log("[TRENDING] called");

  try {
    // 캐시 히트 → 즉시 반환
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      console.log("[TRENDING] returning cached data");
      return NextResponse.json({ items: cache.items });
    }

    // 워밍업 진행 중이면 기다림 (첫 요청 시 워밍업과 겹칠 수 있음)
    if (warmupPromise) {
      console.log("[TRENDING] waiting for warmup...");
      await warmupPromise;
      if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
        return NextResponse.json({ items: cache.items });
      }
    }

    // 캐시 만료 → 새로 빌드
    const items = await buildTrendingData();
    console.log("[TRENDING] result items:", items.length);

    if (items.length > 0) {
      cache = { items, updatedAt: Date.now() };
    }
    return NextResponse.json({ items });
  } catch (err: any) {
    console.log("[TRENDING] error:", err.message);
    if (cache) return NextResponse.json({ items: cache.items });
    return NextResponse.json({ items: [], error: err.message });
  }
}