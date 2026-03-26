import { NextRequest, NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export async function GET(request: NextRequest) {
  const itemId = new URL(request.url).searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: { message: "itemId is required" } }, { status: 400 });
  }
  try {
    const { data, status, ok } = await neopleGet(`/df/items/${itemId}/shop`);
    if (!ok) {
      return NextResponse.json({ error: data.error || { message: `API error (${status})` } }, { status });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 502 });
  }
}
