import { NextRequest, NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export async function GET() {
  try {
    const { data, status, ok } = await neopleGet("/df/avatar-market/hashtag");
    if (!ok) {
      return NextResponse.json({ error: data.error || { message: `API error (${status})` } }, { status });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 502 });
  }
}
