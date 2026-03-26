import { NextRequest, NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export async function GET(request: NextRequest) {
  const goodsNo = new URL(request.url).searchParams.get("goodsNo");
  if (!goodsNo) {
    return NextResponse.json({ error: { message: "goodsNo is required" } }, { status: 400 });
  }
  try {
    const { data, status, ok } = await neopleGet(`/df/avatar-market/sold/${goodsNo}`);
    if (!ok) {
      return NextResponse.json({ error: data.error || { message: `API error (${status})` } }, { status });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 502 });
  }
}
