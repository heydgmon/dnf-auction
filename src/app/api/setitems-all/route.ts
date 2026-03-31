import { NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

let cache: {
  data: Record<number, any[]>;
  timestamp: number;
} | null = null;

const CACHE_TTL = 1000 * 60 * 10; // 10분

export async function GET() {
  try {
    const now = Date.now();

    // ✅ 캐시
    if (cache && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const years = Array.from({ length: 15 }, (_, i) => 2012 + i);

    const results = await Promise.all(
      years.map(async (year) => {
        const { data, ok } = await neopleGet("/df/setitems", {
          setItemName: String(year),
          wordType: "full",
        });

        if (!ok) return { year, items: [] };

        return {
          year,
          items: data.rows || [],
        };
      })
    );

    const grouped: Record<number, any[]> = {};
    results.forEach(({ year, items }) => {
      grouped[year] = items;
    });

    cache = {
      data: grouped,
      timestamp: now,
    };

    return NextResponse.json(grouped);
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message } },
      { status: 502 }
    );
  }
}