import { NextResponse } from "next/server";
import { getPopularItems } from "@/lib/alert-store";

export async function GET() {
  try {
    const items = await getPopularItems();
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ items: [] });
  }
}
