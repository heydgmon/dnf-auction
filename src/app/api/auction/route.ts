import { NextRequest, NextResponse } from "next/server";
import { trackSearch } from "@/lib/alert-store";

const API_BASE = "https://api.neople.co.kr";

function getApiKey(): string {
  const key = process.env.NEOPLE_API_KEY;
  if (!key) throw new Error("NEOPLE_API_KEY not configured");
  return key;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const itemName = searchParams.get("itemName") || "";
  const wordType = searchParams.get("wordType") || "match";
  const limit = searchParams.get("limit") || "400";
  const apiKey = getApiKey();

  const queryStr = [
    `itemName=${encodeURIComponent(itemName)}`,
    `wordType=${encodeURIComponent(wordType)}`,
    `limit=${encodeURIComponent(limit)}`,
    `apikey=${encodeURIComponent(apiKey)}`,
  ].join("&");

  const url = `${API_BASE}/df/auction?${queryStr}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error(`Non-JSON response (status ${res.status})`);
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || { message: `API error (${res.status})` } },
        { status: res.status }
      );
    }

    // 서버에서 unitPrice 오름차순 정렬
    if (data.rows && Array.isArray(data.rows)) {
      data.rows.sort((a: any, b: any) => (a.unitPrice || 0) - (b.unitPrice || 0));
    }

    // 조회수 트래킹
    if (itemName && data.rows?.length > 0) {
      const first = data.rows[0];
      trackSearch(itemName, first.unitPrice, first.itemRarity).catch(() => {});
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message || "Failed to fetch" } },
      { status: 502 }
    );
  }
}