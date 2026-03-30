// src/app/api/auction-sold-history/route.ts
//
// 차트용 7일치 시세 히스토리
//
// 전략:
// 1. 프론트에서 인사이트 데이터(insightData)를 전달하면 → 그것을 차트에 사용 (이미 7일치)
// 2. 없으면 → auction-sold 단일 호출 (거래 적은 아이템은 이것만으로도 여러 날짜 커버)
//
// [API 한계 설명]
// Neople auction-sold에는 커서/오프셋이 없어서 동일 요청을 N번 해도
// 항상 같은 최신 데이터만 반환됩니다.
// 거래가 매우 많은 아이템(무색 큐브 조각 등)은 구조적으로 당일 데이터만 나옵니다.

import { NextRequest, NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";

export const dynamic = "force-dynamic";

function removeOutliers(prices: number[]): number[] {
  if (prices.length < 3) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return prices.filter(p => p >= median * 0.2 && p <= median * 3);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const itemName = searchParams.get("itemName") || "";
  const wordType = searchParams.get("wordType") || "match";
  const insightDataRaw = searchParams.get("insightData");

  if (!itemName) {
    return NextResponse.json({ chartRows: [], recentRows: [], error: "itemName required" }, { status: 400 });
  }

  try {
    // ── 1. 인사이트 데이터가 있으면 그것을 차트에 사용 ──
    if (insightDataRaw) {
      try {
        const insightItem = JSON.parse(decodeURIComponent(insightDataRaw));
        if (insightItem?.trades?.length > 0) {
          const chartRows = insightItem.trades.map((t: any) => ({
            date: t.date,
            avg: t.unitPrice,
            count: t.count || 1,
          }));

          // 리스트용 최신 거래는 별도로 100건 조회
          const { data: soldData, ok: soldOk } = await neopleGet("/df/auction-sold", {
            itemName,
            wordType,
            limit: "100",
          });
          const recentRows = soldOk && soldData.rows
            ? (soldData.rows as any[]).filter(r => (r.itemName as string).includes(itemName))
            : [];

          return NextResponse.json({ chartRows, recentRows, source: "insight" });
        }
      } catch {}
    }

    // ── 2. Fallback: auction-sold 단일 호출 ──
    const { data, ok } = await neopleGet("/df/auction-sold", {
      itemName,
      wordType,
      limit: "400",
    });

    if (!ok || !data.rows) {
      return NextResponse.json({ chartRows: [], recentRows: [] });
    }

    const filtered = (data.rows as any[]).filter(r =>
      (r.itemName as string).includes(itemName)
    );

    // 날짜별 집계
    const dateMap = new Map<string, { prices: number[]; txCount: number }>();
    for (const r of filtered) {
      const d = (r.soldDate || "").slice(0, 10);
      if (!d || !r.unitPrice) continue;
      const e = dateMap.get(d) || { prices: [], txCount: 0 };
      e.prices.push(r.unitPrice);
      e.txCount += 1;
      dateMap.set(d, e);
    }

    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const chartRows = [...dateMap.entries()]
      .filter(([d]) => d >= cutoffStr)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { prices, txCount }]) => {
        const cleaned = removeOutliers(prices);
        const avg = cleaned.length > 0
          ? Math.round(cleaned.reduce((s, v) => s + v, 0) / cleaned.length)
          : Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);
        return { date, avg, count: txCount };
      });

    const recentRows = [...filtered]
      .sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""))
      .slice(0, 100);

    return NextResponse.json({ chartRows, recentRows, source: "auction-sold" });
  } catch (err: any) {
    return NextResponse.json({ chartRows: [], recentRows: [], error: err.message }, { status: 502 });
  }
}