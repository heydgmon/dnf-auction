import { NextResponse } from "next/server";
import { ensureSnapshotCollected } from "@/lib/snapshot-collector";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await ensureSnapshotCollected();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}