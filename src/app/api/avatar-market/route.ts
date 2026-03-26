import { NextRequest, NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string> = {};
  searchParams.forEach((v, k) => { params[k] = v; });

  try {
    const { data, status, ok } = await neopleGet("/df/avatar-market/sale", params);
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
