/**
 * /api/auction-sold-history
 *
 * 차트용 시세 히스토리 API
 *
 * 변경점:
 * 1. DynamoDB에서 7일/30일 히스토리 조회 → 차트 데이터
 * 2. auction-sold에서 당일 실시간 거래 내역 → 리스트 데이터
 * 3. DB에 데이터 없으면 기존 auction-sold fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { neopleGet } from "@/lib/neople";
import { getItemPriceHistory } from "@/lib/price-history";

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
  const daysParam = searchParams.get("days");
  const days = daysParam ? Math.min(Number(daysParam), 30) : 7;

  if (!itemName) {
    return NextResponse.json(
      { chartRows: [], recentRows: [], error: "itemName required" },
      { status: 400 }
    );
  }

  try {
    // ── 1. DynamoDB에서 히스토리 조회 ──
    const dbRecords = await getItemPriceHistory(itemName, days);

    // ── 2. auction-sold에서 당일 실시간 데이터 ──
    let recentRows: any[] = [];
    try {
      const { data: soldData, ok: soldOk } = await neopleGet(
        "/df/auction-sold",
        { itemName, wordType, limit: "100" }
      );
      if (soldOk && soldData.rows) {
        recentRows = (soldData.rows as any[]).filter(r =>
          (r.itemName as string).includes(itemName)
        );
      }
    } catch {}

    // ── 3. DB 데이터가 있으면 차트에 사용 ──
    if (dbRecords.length > 0) {
      // DB 레코드 → chartRows 변환
      const chartRows = dbRecords.map(rec => ({
        date: rec.date,
        avg: rec.avgPrice,
        count: rec.totalVolume,
        min: rec.minPrice,
        max: rec.maxPrice,
      }));

      // 오늘 당일 실시간 데이터로 마지막 포인트 업데이트/추가
      const today = new Date().toISOString().slice(0, 10);
      const todayRows = recentRows.filter(r =>
        (r.soldDate || "").startsWith(today)
      );
      if (todayRows.length > 0) {
        const prices = todayRows.map((r: any) => r.unitPrice).filter(Boolean);
        const volumes = todayRows.reduce((s: number, r: any) => s + (r.count || 1), 0);
        if (prices.length > 0) {
          const cleaned = removeOutliers(prices);
          const avg = cleaned.length > 0
            ? Math.round(cleaned.reduce((s, v) => s + v, 0) / cleaned.length)
            : Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);

          const existingIdx = chartRows.findIndex(r => r.date === today);
          const todayPoint = {
            date: today,
            avg,
            count: volumes,
            min: Math.min(...prices),
            max: Math.max(...prices),
          };
          if (existingIdx >= 0) {
            chartRows[existingIdx] = todayPoint;
          } else {
            chartRows.push(todayPoint);
          }
        }
      }

      return NextResponse.json({
        chartRows,
        recentRows,
        source: "dynamodb",
        dbDays: dbRecords.length,
      });
    }

    // ── 4. Fallback: DB 데이터 없으면 auction-sold 단일 호출 ──
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
      e.txCount += r.count || 1;
      dateMap.set(d, e);
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days - 1));
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

    if (!recentRows.length) {
      recentRows = [...filtered]
        .sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""))
        .slice(0, 100);
    }

    return NextResponse.json({
      chartRows,
      recentRows,
      source: "auction-sold",
    });
  } catch (err: any) {
    return NextResponse.json(
      { chartRows: [], recentRows: [], error: err.message },
      { status: 502 }
    );
  }
}