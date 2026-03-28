import { NextRequest, NextResponse } from "next/server";
import { trackSearch } from "@/lib/alert-store";

const API_BASE = "https://api.neople.co.kr";
const PAGE_LIMIT = 400;
const MAX_PAGES = 2; // 최대 800건 수집

function getApiKey(): string {
  const key = process.env.NEOPLE_API_KEY;
  if (!key) throw new Error("NEOPLE_API_KEY not configured");
  return key;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const itemName = searchParams.get("itemName") || "";
  const wordType = searchParams.get("wordType") || "match";
  const apiKey = getApiKey();

  try {
    let allRows: any[] = [];
    let lastAuctionNo: number | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = [
        `itemName=${encodeURIComponent(itemName)}`,
        `wordType=${encodeURIComponent(wordType)}`,
        `limit=${PAGE_LIMIT}`,
        `apikey=${encodeURIComponent(apiKey)}`,
      ];

      if (lastAuctionNo !== null) {
        params.push(`auctionNo=${lastAuctionNo}`);
      }

      const url = `${API_BASE}/df/auction?${params.join("&")}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { break; }
      if (!res.ok || !data.rows || data.rows.length === 0) break;

      const newRows = lastAuctionNo !== null
        ? data.rows.filter((r: any) => r.auctionNo !== lastAuctionNo)
        : data.rows;

      allRows = allRows.concat(newRows);
      lastAuctionNo = data.rows[data.rows.length - 1].auctionNo;

      if (data.rows.length < PAGE_LIMIT) break;
    }

    // 서버에서 unitPrice 오름차순 정렬
    allRows.sort((a: any, b: any) => (a.unitPrice || 0) - (b.unitPrice || 0));

    // 조회수 트래킹
    if (itemName && allRows.length > 0) {
      const first = allRows[0];
      trackSearch(itemName, first.unitPrice, first.itemRarity).catch(() => {});
    }

    return NextResponse.json({ rows: allRows });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message || "Failed to fetch" } },
      { status: 502 }
    );
  }
}