import { NextRequest, NextResponse } from "next/server";
import { neopleGetRaw } from "@/lib/neople";
import { trackSearch } from "@/lib/alert-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const parts: string[] = [];
  searchParams.forEach((value, key) => {
    parts.push(`${key}=${encodeURIComponent(value)}`);
  });

  try {
    const { data, status, ok } = await neopleGetRaw("/df/auction", parts.join("&"));

    // 조회수 트래킹
    const itemName = searchParams.get("itemName");
    if (itemName && ok && data.rows?.length > 0) {
      const first = data.rows[0];
      trackSearch(itemName, first.unitPrice, first.itemRarity).catch(() => {});
    }

    if (!ok) {
      return NextResponse.json(
        { error: data.error || { message: `API error (${status})` } },
        { status }
      );
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err.message || "Failed to fetch" } },
      { status: 502 }
    );
  }
}
