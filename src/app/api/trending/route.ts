import { NextResponse } from "next/server";

const API_BASE = "https://api.neople.co.kr";
const PAGE_LIMIT = 400;
const MAX_PAGES = 2;

let cache: { items: any[]; updatedAt: number } | null = null;
const CACHE_TTL = 3 * 60 * 1000;

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

export async function GET() {
  try {
    if (cache && Date.now() - cache.updatedAt < CACHE_TTL) {
      return NextResponse.json({ items: cache.items });
    }

    const apiKey = process.env.NEOPLE_API_KEY;

    console.log("[TRENDING] NEOPLE_API_KEY exists:", !!apiKey);

    if (!apiKey) {
      return NextResponse.json({ items: [], error: "NEOPLE_API_KEY not configured" });
    }

    const promises = KEYWORDS.map((keyword) => fetchKeyword(keyword, apiKey));
    const allResults = await Promise.all(promises);
    const allRows = allResults.flat();

    console.log("[TRENDING] total rows fetched:", allRows.length);

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

    const sorted = Array.from(itemMap.values())
      .sort((a, b) => b.auctionCount - a.auctionCount)
      .slice(0, 30);

    console.log("[TRENDING] result items:", sorted.length);

    cache = { items: sorted, updatedAt: Date.now() };
    return NextResponse.json({ items: sorted });
  } catch (err: any) {
    console.log("[TRENDING] error:", err.message);
    if (cache) return NextResponse.json({ items: cache.items });
    return NextResponse.json({ items: [], error: err.message });
  }
}