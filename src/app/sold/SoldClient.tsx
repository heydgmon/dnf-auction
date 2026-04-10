"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AuctionSoldItem, PopularItem } from "@/lib/types";
import { getRarityColor, formatGold, formatDate } from "@/lib/utils";
import {
  Card, ItemImg, ErrorMsg, SkeletonList, Empty,
  AutocompleteSearch, SearchHelpers, addRecent, filterByItemName,
} from "@/components/shared";

/* ════════════════════════════════════════
   Y축 포매터
   ════════════════════════════════════════ */
function formatYTick(v: any): string {
  const n = Number(v);
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + "억";
  if (n >= 10_000) return Math.round(n / 10_000) + "만";
  return n.toLocaleString();
}

function calcSingleYRange(prices: number[]): { min: number; max?: number } {
  const valid = prices.filter(p => p > 0);
  if (valid.length === 0) return { min: 0 };
  const rawMin = Math.min(...valid);
  const rawMax = Math.max(...valid);
  const range = rawMax - rawMin || rawMax;
  const pad = range * 0.2;
  return { min: Math.max(0, rawMin - pad), max: rawMax + pad };
}

/* ════════════════════════════════════════
   SVG 미니 스파크라인 (경량, Chart.js 불필요)
   ════════════════════════════════════════ */
function Sparkline({
  data,
  width = 120,
  height = 32,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color: string;
}) {
  if (data.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "var(--text-muted)" }}>
        데이터 부족
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const gid = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${pad},${height - pad} ${points} ${width - pad},${height - pad}`}
        fill={`url(#${gid})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {(() => {
        const lastX = pad + ((data.length - 1) / (data.length - 1)) * (width - pad * 2);
        const lastY = pad + (1 - (data[data.length - 1] - min) / range) * (height - pad * 2);
        return <circle cx={lastX} cy={lastY} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

/* ════════════════════════════════════════
   개별 아이템 상세 차트 (Chart.js, 1개만)
   ════════════════════════════════════════ */
function DetailChart({
  trades,
  color,
}: {
  trades: { date: string; unitPrice: number; count: number }[];
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let destroyed = false;

    const build = () => {
      const Chart = (window as any).Chart;
      if (!Chart || !canvasRef.current || destroyed) return;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
      const tickColor = isDark ? "#666" : "#bbb";
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const labels = trades.map(d => d.date.slice(5));
      const priceData = trades.map(d => d.unitPrice);
      const volData = trades.map(d => d.count);
      const { min: yMin, max: yMax } = calcSingleYRange(priceData);

      chartRef.current = new Chart(ctx, {
        data: {
          labels,
          datasets: [
            {
              type: "line", label: "평균가", data: priceData,
              borderColor: color, backgroundColor: color + "15",
              borderWidth: 2, pointRadius: 4, pointBackgroundColor: color,
              pointBorderColor: "#fff", pointBorderWidth: 1.5,
              tension: 0.35, fill: true, yAxisID: "y", order: 1,
            },
            {
              type: "bar", label: "거래량", data: volData,
              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              borderRadius: 4, yAxisID: "y2", order: 2, barPercentage: 0.4,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: isDark ? "#1E293B" : "#fff",
              titleColor: isDark ? "#E2E8F0" : "#0F172A",
              bodyColor: isDark ? "#94A3B8" : "#475569",
              borderColor: isDark ? "#334155" : "#E2E8F0",
              borderWidth: 1, padding: 10, cornerRadius: 8,
              callbacks: {
                label: (c: any) => {
                  if (c.dataset.label === "평균가") return ` 평균가: ${Number(c.parsed.y).toLocaleString()}G`;
                  return ` 거래량: ${c.parsed.y}건`;
                },
              },
            },
          },
          scales: {
            x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
            y: {
              position: "right", min: yMin, ...(yMax !== undefined ? { max: yMax } : {}),
              ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 5, callback: formatYTick },
              grid: { color: gridColor },
            },
            y2: { display: false },
          },
        },
      });
    };

    const poll = setInterval(() => { if ((window as any).Chart) { clearInterval(poll); if (!destroyed) build(); } }, 80);
    if ((window as any).Chart) { clearInterval(poll); build(); }
    else if (!document.getElementById("chartjs-cdn")) {
      const s = document.createElement("script");
      s.id = "chartjs-cdn";
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = () => { if (!destroyed) build(); };
      document.head.appendChild(s);
    }

    return () => { destroyed = true; clearInterval(poll); chartRef.current?.destroy(); chartRef.current = null; };
  }, [trades, color]);

  return <div style={{ position: "relative", width: "100%", height: 200 }}><canvas ref={canvasRef} /></div>;
}

/* ════════════════════════════════════════
   개요 대시보드: 테이블 + 스파크라인
   ════════════════════════════════════════ */
const COLORS = [
  "#E24B4A","#378ADD","#1D9E75","#EF9F27","#7F77DD",
  "#D85A30","#D4537E","#639922","#2196F3","#FF5722",
  "#009688","#795548","#607D8B","#E91E63","#3F51B5",
  "#00BCD4","#CDDC39","#FF9800","#8BC34A","#673AB7",
];

function OverviewDashboard({
  items,
  onItemClick,
}: {
  items: any[];
  onItemClick: (name: string) => void;
}) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "change">("volume");

  const sorted = [...items].sort((a, b) => {
    if (sortBy === "change") return Math.abs(b.priceChange) - Math.abs(a.priceChange);
    return b.totalValue - a.totalValue;
  });

  const toggle = (name: string) => {
    setExpandedItem(prev => prev === name ? null : name);
  };

  return (
    <div>
      {/* 정렬 탭 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {([
          { key: "volume", label: "거래 규모순" },
          { key: "change", label: "변동률순" },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSortBy(tab.key)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: "none", cursor: "pointer",
              background: sortBy === tab.key ? "var(--color-primary)" : "var(--bg-primary)",
              color: sortBy === tab.key ? "#fff" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 테이블 헤더 — 모바일은 스파크라인 숨김 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr 110px 76px 64px",
        gap: 6, padding: "0 10px 8px",
        fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
        borderBottom: "1px solid var(--border-color)",
      }}>
        <span>#</span>
        <span>아이템</span>
        <span className="hidden sm:block" style={{ textAlign: "center" }}>7일 추이</span>
        <span style={{ textAlign: "right" }}>평균가</span>
        <span style={{ textAlign: "right" }}>변동</span>
      </div>

      {/* 아이템 행들 */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {sorted.map((item, i) => {
          const trades = item.trades || [];
          const prices = trades.map((t: any) => t.unitPrice);
          const isUp = item.priceChange > 0;
          const isFlat = item.priceChange === 0;
          const changeColor = isFlat ? "var(--text-muted)" : isUp ? "#DC2626" : "#2563EB";
          const arrow = isFlat ? "—" : isUp ? "▲" : "▼";
          const rowColor = COLORS[i % COLORS.length];
          const isExpanded = expandedItem === item.itemName;

          return (
            <div key={item.itemName}>
              {/* 메인 행 */}
              <div
                onClick={() => toggle(item.itemName)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr 110px 76px 64px",
                  gap: 6, alignItems: "center",
                  padding: "9px 10px",
                  cursor: "pointer",
                  borderBottom: isExpanded ? "none" : "1px solid var(--border-color)",
                  background: isExpanded ? "var(--color-primary-light)" : "transparent",
                  borderRadius: isExpanded ? "8px 8px 0 0" : 0,
                  transition: "background 0.12s",
                }}
                onMouseOver={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"; }}
                onMouseOut={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* 순위 */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: i < 3 ? rowColor : "var(--bg-primary)",
                  color: i < 3 ? "#fff" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800,
                }}>
                  {i + 1}
                </div>

                {/* 아이템명 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={26} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600,
                      color: getRarityColor(item.itemRarity),
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.itemName}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
                      {item.totalVolume}건
                    </div>
                  </div>
                </div>

                {/* 스파크라인 — 모바일 숨김 */}
                <div className="hidden sm:flex" style={{ justifyContent: "center" }}>
                  <Sparkline data={prices} width={100} height={26} color={rowColor} />
                </div>

                {/* 평균가 */}
                <div style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                  {formatGold(item.avgPrice)}
                </div>

                {/* 변동률 */}
                <div style={{ textAlign: "right", fontSize: 11, fontWeight: 700, color: changeColor }}>
                  {arrow}{Math.abs(item.priceChange)}%
                </div>
              </div>

              {/* 확장 상세 */}
              {isExpanded && (
                <div
                  className="animate-slide-up"
                  style={{
                    padding: "14px",
                    background: "var(--color-primary-light)",
                    borderRadius: "0 0 8px 8px",
                    borderBottom: "1px solid var(--border-color)",
                    marginBottom: 2,
                  }}
                >
                  {/* 요약 카드 */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
                    {[
                      { label: "평균가", value: formatGold(item.avgPrice), color: "var(--text-primary)" },
                      { label: "최저가", value: formatGold(item.minPrice), color: "#2563EB" },
                      { label: "최고가", value: formatGold(item.maxPrice), color: "#DC2626" },
                      { label: "변동률", value: `${isUp ? "+" : ""}${item.priceChange}%`, color: changeColor },
                    ].map(s => (
                      <div key={s.label} style={{ padding: "7px 8px", borderRadius: 8, background: "var(--bg-card)" }}>
                        <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* 상세 차트 */}
                  {trades.length >= 2 && (
                    <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: "10px 6px 6px" }}>
                      <DetailChart trades={trades} color={rowColor} />
                    </div>
                  )}

                  {/* 일별 내역 */}
                  {trades.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>일별 거래</div>
                      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                        {[...trades].reverse().map((t: any, ti: number) => {
                          const prev = trades[trades.indexOf(t) - 1];
                          const diff = prev ? ((t.unitPrice - prev.unitPrice) / prev.unitPrice * 100) : 0;
                          return (
                            <div key={t.date} style={{
                              padding: "6px 10px", borderRadius: 8, background: "var(--bg-card)",
                              border: "1px solid var(--border-color)", fontSize: 10, minWidth: 76, flexShrink: 0,
                            }}>
                              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{t.date.slice(5)}</div>
                              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{formatGold(t.unitPrice)}</div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                                <span style={{ color: "var(--text-muted)" }}>{t.count}건</span>
                                {diff !== 0 && (
                                  <span style={{ color: diff > 0 ? "#DC2626" : "#2563EB", fontWeight: 600 }}>
                                    {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 시세 검색 버튼 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onItemClick(item.itemName); }}
                    style={{
                      marginTop: 10, width: "100%", padding: "8px 0",
                      borderRadius: 8, border: "1px solid var(--color-primary)",
                      background: "transparent", color: "var(--color-primary)",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    "{item.itemName}" 상세 시세 검색 →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   검색 결과 차트
   ════════════════════════════════════════ */
function SearchChart({ chartData }: { chartData: { date: string; avg: number; count: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    let destroyed = false;

    const build = () => {
      const Chart = (window as any).Chart;
      if (!Chart || !canvasRef.current || destroyed) return;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
      const tickColor = isDark ? "#666" : "#bbb";
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx || chartData.length === 0) return;

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
          responsive: true, maintainAspectRatio: false,
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
            x: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor } },
            y: {
              position: "right", min: yMin, ...(yMax !== undefined ? { max: yMax } : {}),
              ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 6, callback: formatYTick },
              grid: { color: gridColor },
            },
            y2: { display: false },
          },
        },
      });
    };

    const poll = setInterval(() => { if ((window as any).Chart) { clearInterval(poll); if (!destroyed) build(); } }, 80);
    if ((window as any).Chart) { clearInterval(poll); build(); }
    else if (!document.getElementById("chartjs-cdn")) {
      const s = document.createElement("script");
      s.id = "chartjs-cdn";
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = () => { if (!destroyed) build(); };
      document.head.appendChild(s);
    }

    return () => { destroyed = true; clearInterval(poll); chartRef.current?.destroy(); chartRef.current = null; };
  }, [chartData]);

  return <div style={{ position: "relative", width: "100%", height: 220 }}><canvas ref={canvasRef} /></div>;
}

/* ════════════════════════════════════════
   메인 컴포넌트
   ════════════════════════════════════════ */
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
  const [chartTitle, setChartTitle] = useState("");

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
      setChartTitle(cd.length > 0 ? `"${name}" 시세 추이 (${cd.length}일)` : "");
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
      setChartTitle("");
    } finally { setLoading(false); }
  }, [query, fetchHistory]);

  useEffect(() => {
    if (!query.trim() && searched) {
      setSearched(false); setResults([]); setChartMode("overview"); setChartTitle(""); setChartData([]);
    }
  }, [query]);

  const handleItemClick = useCallback(async (name: string) => {
    setQuery(name);
    setSearched(true);
    setLoading(true);
    setChartLoading(true);
    setError("");
    addRecent(name);
    try {
      const recentRows = await fetchHistory(name);
      const filtered = (filterByItemName(recentRows, name) as AuctionSoldItem[]);
      filtered.sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""));
      setResults(filtered);
      if (filtered.length === 0 && recentRows.length === 0) setError("거래 내역이 없습니다.");
    } catch {
      setError("서버 연결에 실패했습니다.");
      setResults([]);
    } finally { setLoading(false); }
  }, [fetchHistory]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 검색바 */}
      <Card>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          최근 거래 완료된 아이템의 실제 거래 가격을 확인합니다.
        </p>
        <AutocompleteSearch
          query={query} setQuery={setQuery} onSearch={search} loading={loading}
          placeholder="아이템 이름 (예: 골고라이언, 리노, 패키지...)"
          buttonLabel="시세 검색"
        />
      </Card>

      {/* ═══ 검색 시: 단일 아이템 차트 ═══ */}
      {chartMode === "search" && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{chartTitle}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>실체결 기준 · 일별 평균가 + 거래량</div>
            </div>
            <button
              onClick={() => { setChartMode("overview"); setChartTitle(""); setChartData([]); setSearched(false); setResults([]); setQuery(""); }}
              style={{ fontSize: 10, padding: "4px 10px", borderRadius: 20, border: "0.5px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-muted)", cursor: "pointer" }}>
              ← 전체 보기
            </button>
          </div>
          {chartLoading
            ? <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 12, color: "var(--text-muted)" }}>차트 로딩 중...</div></div>
            : <SearchChart chartData={chartData} />
          }
          {chartData.length > 0 && (() => {
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
      )}

      {/* ═══ 기본 뷰: 인사이트 대시보드 ═══ */}
      {chartMode === "overview" && !searched && insightItems.length > 0 && (
        <Card>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>인기 아이템 시세 현황</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              실체결 기준 · 7일간 거래 데이터 · 행 클릭 시 상세 차트
            </div>
          </div>
          <OverviewDashboard items={insightItems} onItemClick={handleItemClick} />
        </Card>
      )}

      {/* 검색 헬퍼 */}
      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}

      {/* 검색 결과 */}
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