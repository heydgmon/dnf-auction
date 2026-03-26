import { NextRequest, NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export async function GET(request: NextRequest) {
  const auctionNo = new URL(request.url).searchParams.get("auctionNo");
  if (!auctionNo) {
    return NextResponse.json({ error: { message: "auctionNo is required" } }, { status: 400 });
  }

  try {
    const { data, status, ok } = await neopleGet(`/df/auction/${auctionNo}`);
    if (!ok) {
      return NextResponse.json(
        { error: data.error || { message: `API error (${status})` } },
        { status }
      );
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 502 });
  }
}
