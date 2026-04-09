"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AuctionSoldItem, PopularItem } from "@/lib/types";
import { getRarityColor, formatGold, formatDate } from "@/lib/utils";
import {
  Card, ItemImg, ErrorMsg, SkeletonList, Empty,
  AutocompleteSearch, SearchHelpers, addRecent, filterByItemName,
} from "@/components/shared";

// Y축 tick 포매터
function formatYTick(v: any): string {
  const n = Number(v);
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + "억";
  if (n >= 10_000) return Math.round(n / 10_000) + "만";
  return n.toLocaleString();
}

// 단일 가격 배열에서 Y축 범위 계산
function calcSingleYRange(prices: number[]): { min: number; max?: number } {
  const valid = prices.filter(p => p > 0);
  if (valid.length === 0) return { min: 0 };
  const rawMin = Math.min(...valid);
  const rawMax = Math.max(...valid);
  const range = rawMax - rawMin || rawMax;
  const pad = range * 0.2;
  return {
    min: Math.max(0, rawMin - pad),
    max: rawMax + pad,
  };
}

// 인사이트 데이터 → 차트용 멀티 데이터셋 (% 변동률 기반)
const COLORS = [
  "#E24B4A","#378ADD","#1D9E75","#EF9F27","#7F77DD",
  "#D85A30","#D4537E","#639922","#2196F3","#FF5722",
  "#009688","#795548","#607D8B","#E91E63","#3F51B5",
  "#00BCD4","#CDDC39","#FF9800","#8BC34A","#673AB7",
];

function buildOverviewDatasets(items: any[]) {
  // 모든 아이템 사용 (최대 20개)
  const allItems = items.slice(0, 20);

  return allItems.map((item, i) => {
    const trades = item.trades || [];
    if (trades.length === 0) return null;

    // 첫 번째 가격을 기준으로 % 변동률 계산
    const basePrice = trades[0].unitPrice;
    if (!basePrice || basePrice <= 0) return null;

    const normalizedData = trades.map((t: any) => ({
      x: t.date,
      y: ((t.unitPrice - basePrice) / basePrice) * 100, // % 변동
    }));

    return {
      label: item.itemName,
      data: normalizedData,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + "18",
      borderWidth: 1.5,
      pointRadius: 2,
      tension: 0.35,
      fill: false,
      yAxisID: "y",
    };
  }).filter(Boolean);
}

// % 변동률 데이터셋의 Y축 범위 계산
function calcPercentYRange(datasets: any[]): { min: number; max: number } {
  const allValues: number[] = [];
  for (const ds of datasets) {
    for (const pt of ds.data) {
      if (typeof pt.y === "number" && isFinite(pt.y)) allValues.push(pt.y);
    }
  }
  if (allValues.length === 0) return { min: -5, max: 5 };

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = rawMax - rawMin || 5;
  const pad = range * 0.15;
  return {
    min: rawMin - pad,
    max: rawMax + pad,
  };
}

function PriceChart({ chartData, mode, itemName, insightItems }: {
  chartData: { date: string; avg: number; count: number }[];
  mode: "overview" | "search";
  itemName: string;
  insightItems: any[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let destroyed = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const tryBuild = () => {
      const Chart = (window as any).Chart;
      if (!Chart || !canvasRef.current || destroyed) return;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      const tickColor = isDark ? "#666" : "#bbb";
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      if (mode === "overview" && insightItems.length > 0) {
        const datasets = buildOverviewDatasets(insightItems);
        const { min, max } = calcPercentYRange(datasets);

        chartRef.current = new Chart(ctx, {
          type: "line",
          data: { datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (c: any) => {
                    const pct = Number(c.parsed.y).toFixed(1);
                    const sign = Number(c.parsed.y) >= 0 ? "+" : "";
                    // 원래 가격도 표시
                    const item = insightItems.find((it: any) => it.itemName === c.dataset.label);
                    const trades = item?.trades || [];
                    const trade = trades.find((t: any) => t.date === c.parsed.x);
                    const priceStr = trade ? ` (${Number(trade.unitPrice).toLocaleString()}G)` : "";
                    return ` ${c.dataset.label}: ${sign}${pct}%${priceStr}`;
                  },
                },
              },
            },
            scales: {
              x: {
                type: "category",
                ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 7 },
                grid: { color: gridColor },
              },
              y: {
                position: "right",
                min,
                max,
                ticks: {
                  color: tickColor,
                  font: { size: 10 },
                  maxTicksLimit: 6,
                  callback: (v: any) => {
                    const n = Number(v);
                    const sign = n >= 0 ? "+" : "";
                    return `${sign}${n.toFixed(0)}%`;
                  },
                },
                grid: {
                  color: (ctx: any) => {
                    // 0% 라인을 더 진하게
                    if (ctx.tick && ctx.tick.value === 0) {
                      return isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
                    }
                    return gridColor;
                  },
                },
              },
            },
          },
        });

      } else if (mode === "search" && chartData.length > 0) {
        const labels = chartData.map(d => d.date.slice(5));
        const priceData = chartData.map(d => d.avg);
        const volData = chartData.map(d => d.count);
        const isUp = priceData.length >= 2 && priceData[priceData.length - 1] >= priceData[0];
        const lineColor = isUp ? "#E24B4A" : "#378ADD";
        const { min: yMin, max: yMax } = calcSingleYRange(priceData);

        chartRef.current = new Chart(ctx, {
          data: {
            labels,
            datasets: [
              {
                type: "line", label: "평균가", data: priceData,
                borderColor: lineColor, backgroundColor: lineColor + "12",
                borderWidth: 2, pointRadius: 3, pointBackgroundColor: lineColor,
                tension: 0.35, fill: true, yAxisID: "y", order: 1,
              },
              {
                type: "bar", label: "거래량", data: volData,
                backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                borderRadius: 3, yAxisID: "y2", order: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (c: any) => {
                    if (c.dataset.label === "평균가") return ` 평균가: ${Number(c.parsed.y).toLocaleString()}G`;
                    return ` 거래량: ${c.parsed.y}건`;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: { color: tickColor, font: { size: 10 } },
                grid: { color: gridColor },
              },
              y: {
                position: "right",
                min: yMin,
                ...(yMax !== undefined ? { max: yMax } : {}),
                ticks: {
                  color: tickColor,
                  font: { size: 10 },
                  maxTicksLimit: 6,
                  callback: formatYTick,
                },
                grid: { color: gridColor },
              },
              y2: { display: false },
            },
          },
        });
      }
    };

    const startPolling = () => {
      pollInterval = setInterval(() => {
        if ((window as any).Chart) {
          if (pollInterval) clearInterval(pollInterval);
          if (!destroyed) tryBuild();
        }
      }, 100);
    };

    if ((window as any).Chart) { tryBuild(); }
    else if (document.getElementById("chartjs-cdn")) { startPolling(); }
    else {
      const s = document.createElement("script");
      s.id = "chartjs-cdn";
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = () => { if (!destroyed) tryBuild(); };
      s.onerror = () => console.error("[Chart.js] CDN 로드 실패");
      document.head.appendChild(s);
    }

    return () => {
      destroyed = true;
      if (pollInterval) clearInterval(pollInterval);
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [mode, chartData, insightItems]);

  return (<div style={{ position: "relative", width: "100%", height: 260 }}><canvas ref={canvasRef} /></div>);
}

export default function SoldClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuctionSoldItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [insightItems, setInsightItems] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ date: string; avg: number; count: number }[]>([]);
  const [chartMode, setChartMode] = useState<"overview" | "search">("overview");
  const [chartTitle, setChartTitle] = useState("인기 아이템 시세 변동률");

  useEffect(() => {
    fetch("/api/market-insight").then(r => r.json()).then(d => setInsightItems(d.items || [])).catch(() => {});
    fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {});
  }, []);

  const fetchHistory = useCallback(async (name: string) => {
    setChartLoading(true);
    try {
      const url = `/api/auction-sold-history?itemName=${encodeURIComponent(name)}&wordType=match&days=7`;
      const res = await fetch(url);
      const data = await res.json();
      const cd: { date: string; avg: number; count: number }[] = data.chartRows || [];
      setChartData(cd);
      setChartMode(cd.length > 0 ? "search" : "overview");
      setChartTitle(cd.length > 0 ? `"${name}" 시세 추이 (${cd.length}일)` : "인기 아이템 시세 변동률");
      return data.recentRows || [];
    } catch { return []; }
    finally { setChartLoading(false); }
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setChartLoading(true); setError(""); setSearched(true);
    addRecent(query.trim());
    try {
      const recentRows = await fetchHistory(query.trim());
      const filtered = (filterByItemName(recentRows, query.trim()) as AuctionSoldItem[]);
      filtered.sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""));
      setResults(filtered);
      if (filtered.length === 0 && recentRows.length === 0) setError("거래 내역이 없습니다.");
    } catch {
      setError("서버 연결에 실패했습니다.");
      setResults([]);
      setChartMode("overview");
      setChartTitle("인기 아이템 시세 변동률");
    } finally { setLoading(false); }
  }, [query, fetchHistory]);

  useEffect(() => {
    if (!query.trim() && searched) {
      setSearched(false);
      setResults([]);
      setChartMode("overview");
      setChartTitle("인기 아이템 시세 변동률");
      setChartData([]);
    }
  }, [query]);

  const handleChipClick = useCallback(async (name: string) => {
    setQuery(name);
    await fetchHistory(name);
  }, [fetchHistory]);

  // 모든 아이템 표시 (최대 20개)
  const allChipItems = insightItems.slice(0, 20);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>최근 거래 완료된 아이템의 실제 거래 가격을 확인합니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading} placeholder="아이템 이름 (예: 골고라이언, 리노, 패키지...)" buttonLabel="시세 검색" />
      </Card>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{chartTitle}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              {chartMode === "overview" ? "실체결 기준 · 첫날 대비 % 변동률 · 20개 아이템" : "실체결 기준 · 일별 평균가 + 거래량"}
            </div>
          </div>
          {chartMode === "search" && (
            <button
              onClick={() => { setChartMode("overview"); setChartTitle("인기 아이템 시세 변동률"); setChartData([]); }}
              style={{ fontSize: 10, padding: "4px 10px", borderRadius: 20, border: "0.5px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-muted)", cursor: "pointer" }}>
              전체 보기
            </button>
          )}
        </div>
        {chartLoading
          ? (<div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 12, color: "var(--text-muted)" }}>차트 로딩 중...</div></div>)
          : (<PriceChart chartData={chartData} mode={chartMode} itemName={query} insightItems={insightItems} />)
        }
        {chartMode === "overview" && allChipItems.length > 0 && (
          <div style={{ maxHeight: 80, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, padding: "2px 0" }}>
            {allChipItems.map((item, i) => (
              <button key={item.itemName} onClick={() => handleChipClick(item.itemName)}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, padding: "3px 8px", borderRadius: 20, border: `0.5px solid ${COLORS[i % COLORS.length]}40`, background: `${COLORS[i % COLORS.length]}12`, color: COLORS[i % COLORS.length], cursor: "pointer", whiteSpace: "nowrap" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "inline-block", flexShrink: 0 }} />
                {item.itemName}
              </button>
            ))}
          </div>
        )}
        {chartMode === "search" && chartData.length > 0 && (() => {
          const prices = chartData.map(d => d.avg);
          const latest = prices[prices.length - 1];
          const totalVol = chartData.reduce((s, d) => s + d.count, 0);
          const firstPrice = prices[0];
          const change = firstPrice > 0 ? Math.round(((latest - firstPrice) / firstPrice) * 10000) / 100 : 0;
          const isUp = change >= 0;
          return (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[
                { label: "최근 평균가", value: `${latest.toLocaleString()}G` },
                { label: "기간 변동", value: `${isUp ? "+" : ""}${change}%`, color: isUp ? "#E24B4A" : "#378ADD" },
                { label: "거래 건수", value: `${totalVol}건` },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: 1, background: "var(--bg-primary)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: color || "var(--text-primary)" }}>{value}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>
      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>최근 거래 {results.length}건</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((item, i) => (
              <div key={i} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
                <div style={{ flex: 1, minWidth: 0, fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.reinforce > 0 && <span style={{ color: "var(--color-accent-dim)" }}>+{item.reinforce} </span>}
                  {item.itemName}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.count > 1 ? `x${item.count}` : ""}</span>
                <span style={{ fontWeight: 600, color: "var(--color-accent-dim)", width: 64, textAlign: "right" }}>{formatGold(item.unitPrice)}</span>
                <span className="hidden sm:block" style={{ fontSize: 10, color: "var(--text-muted)", width: 100, textAlign: "right" }}>{formatDate(item.soldDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && searched && !results.length && !error && <Empty msg="거래 내역이 없습니다." />}
    </div>
  );
}