import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = "https://api.neople.co.kr";

let cache: { items: any[]; updatedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000;
let buildPromise: Promise<any[]> | null = null;

// ── 키워드 10개로 축소 (20→10, API 호출 절반) ──
// 페이징도 1페이지만 (MAX_PAGES=1, 400건이면 충분)
const KEYWORDS = [
  "카드", "강화권", "큐브", "토큰", "증폭",
  "패키지", "골고", "순례", "크리쳐", "오라",
];

async function fetchKeyword(keyword: string, apiKey: string): Promise<any[]> {
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

async function buildTrendingData(): Promise<any[]> {
  const apiKey = process.env.NEOPLE_API_KEY;
  if (!apiKey) return [];

  // ── 10개 전부 동시 호출 (배치 없음, 1초면 끝남) ──
  const results = await Promise.all(
    KEYWORDS.map((kw) => fetchKeyword(kw, apiKey))
  );
  const allRows = results.flat();

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

// ── 동시 요청 방지: 같은 빌드를 여러 요청이 공유 ──
function getBuildPromise(): Promise<any[]> {
  if (!buildPromise) {
    buildPromise = buildTrendingData().finally(() => { buildPromise = null; });
  }
  return buildPromise;
}

// ── 서버 시작 시 워밍업 ──
getBuildPromise().then(items => {
  if (items.length > 0) {
    cache = { items, updatedAt: Date.now() };
    console.log("[TRENDING] Warmup done:", items.length);
  }
}).catch(() => {});

export async function GET() {
  try {
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json({ items: cache.items });
    }

    const items = await getBuildPromise();
    if (items.length > 0) {
      cache = { items, updatedAt: Date.now() };
    }
    return NextResponse.json({ items });
  } catch (err: any) {
    if (cache) return NextResponse.json({ items: cache.items });
    return NextResponse.json({ items: [], error: err.message });
  }
}