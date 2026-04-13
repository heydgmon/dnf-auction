"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AuctionSoldItem, PopularItem } from "@/lib/types";
import { getRarityColor, formatGold, formatDate } from "@/lib/utils";
import {
  Card, ItemImg, ErrorMsg, SkeletonList, Empty,
  AutocompleteSearch, SearchHelpers, addRecent, filterByItemName,
} from "@/components/shared";

/* ═══ 유틸 ═══ */
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

/* ═══ SVG 스파크라인 (큰 버전, 날짜 라벨 포함) ═══ */
function Sparkline({
  trades,
  width = 280,
  height = 56,
  color,
}: {
  trades: { date: string; unitPrice: number }[];
  width?: number;
  height?: number;
  color: string;
}) {
  const prices = trades.map(t => t.unitPrice);
  if (prices.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-muted)" }}>
        거래 1건
      </div>
    );
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padX = 4;
  const padTop = 4;
  const padBot = 14;
  const chartH = height - padTop - padBot;

  const pts = prices.map((v, i) => {
    const x = padX + (i / (prices.length - 1)) * (width - padX * 2);
    const y = padTop + (1 - (v - min) / range) * chartH;
    return { x, y };
  });

  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const polygon = `${padX},${padTop + chartH} ${polyline} ${pts[pts.length - 1].x.toFixed(1)},${padTop + chartH}`;
  const gid = `sp-${color.replace(/[^a-z0-9]/gi, "")}-${width}`;

  const firstDate = trades[0].date.slice(5);
  const lastDate = trades[trades.length - 1].date.slice(5);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={polygon} fill={`url(#${gid})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3 : 1.5} fill={i === pts.length - 1 ? color : "transparent"} stroke={color} strokeWidth={i === pts.length - 1 ? 0 : 0.8} />
      ))}
      <text x={padX} y={height - 2} fontSize="8" fill="var(--text-muted)" textAnchor="start">{firstDate}</text>
      <text x={width - padX} y={height - 2} fontSize="8" fill="var(--text-muted)" textAnchor="end">{lastDate}</text>
    </svg>
  );
}

/* ═══ 미니 스파크라인 (테이블 행 내부용) ═══ */
function MiniSparkline({
  data,
  width = 80,
  height = 24,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══ 색상 팔레트 ═══ */
const COLORS = [
  "#E24B4A","#378ADD","#1D9E75","#EF9F27","#7F77DD",
  "#D85A30","#D4537E","#639922","#2196F3","#FF5722",
  "#009688","#795548","#607D8B","#E91E63","#3F51B5",
  "#00BCD4","#CDDC39","#FF9800","#8BC34A","#673AB7",
];

/* ═══ 아이템 카드 (차트+정보 항상 노출) ═══ */
function ItemCard({
  item,
  index,
  color,
  onSearch,
}: {
  item: any;
  index: number;
  color: string;
  onSearch: (name: string) => void;
}) {
  const trades = item.trades || [];
  const isUp = item.priceChange > 0;
  const isFlat = item.priceChange === 0;
  const changeColor = isFlat ? "var(--text-muted)" : isUp ? "#DC2626" : "#2563EB";
  const arrow = isFlat ? "—" : isUp ? "▲" : "▼";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}
      onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"; }}
      onMouseOut={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      <div style={{ padding: "12px 14px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: index < 3 ? color : "var(--bg-primary)",
          color: index < 3 ? "#fff" : "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, flexShrink: 0,
        }}>
          {index + 1}
        </div>
        <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: getRarityColor(item.itemRarity),
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {item.itemName}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: changeColor }}>
            {arrow} {Math.abs(item.priceChange)}%
          </div>
        </div>
      </div>

      <div style={{ padding: "6px 10px 0" }}>
        <Sparkline trades={trades} width={280} height={52} color={color} />
      </div>

      <div style={{ padding: "8px 14px 12px", display: "flex", gap: 6 }}>
        {[
          { label: "평균", value: formatGold(item.avgPrice), c: "var(--text-primary)" },
          { label: "최저", value: formatGold(item.minPrice), c: "#2563EB" },
          { label: "최고", value: formatGold(item.maxPrice), c: "#DC2626" },
          { label: "거래", value: `${item.totalVolume}건`, c: "var(--text-secondary)" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 1 }}>{s.label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: s.c }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ 리스트 뷰 행 ═══ */
function ItemRow({
  item,
  index,
  color,
}: {
  item: any;
  index: number;
  color: string;
}) {
  const trades = item.trades || [];
  const prices = trades.map((t: any) => t.unitPrice);
  const isUp = item.priceChange > 0;
  const isFlat = item.priceChange === 0;
  const changeColor = isFlat ? "var(--text-muted)" : isUp ? "#DC2626" : "#2563EB";
  const arrow = isFlat ? "—" : isUp ? "▲" : "▼";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "26px 1fr 80px 70px 58px",
      gap: 6, alignItems: "center",
      padding: "8px 10px",
      borderBottom: "1px solid var(--border-color)",
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: index < 3 ? color : "var(--bg-primary)",
        color: index < 3 ? "#fff" : "var(--text-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800,
      }}>
        {index + 1}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={24} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: getRarityColor(item.itemRarity),
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{item.itemName}</div>
          <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{item.totalVolume}건</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <MiniSparkline data={prices} width={72} height={22} color={color} />
      </div>
      <div style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
        {formatGold(item.avgPrice)}
      </div>
      <div style={{ textAlign: "right", fontSize: 11, fontWeight: 700, color: changeColor }}>
        {arrow}{Math.abs(item.priceChange)}%
      </div>
    </div>
  );
}

/* ═══ 대시보드 ═══ */
function OverviewDashboard({
  items,
  onItemClick,
}: {
  items: any[];
  onItemClick: (name: string) => void;
}) {
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [sortBy, setSortBy] = useState<"volume" | "change">("volume");

  const sorted = [...items].sort((a, b) => {
    if (sortBy === "change") return Math.abs(b.priceChange) - Math.abs(a.priceChange);
    return b.totalValue - a.totalValue;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {([
            { key: "volume", label: "거래 규모순" },
            { key: "change", label: "변동률순" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setSortBy(tab.key)}
              style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
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

        <div style={{ display: "flex", gap: 2, background: "var(--bg-primary)", borderRadius: 6, padding: 2 }}>
          {([
            { key: "card", label: "카드" },
            { key: "list", label: "리스트" },
          ] as const).map(m => (
            <button
              key={m.key}
              onClick={() => setViewMode(m.key)}
              style={{
                padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: viewMode === m.key ? "var(--bg-card)" : "transparent",
                color: viewMode === m.key ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: viewMode === m.key ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "card" && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
        }}>
          {sorted.map((item, i) => (
            <div key={item.itemName} onClick={() => onItemClick(item.itemName)} style={{ cursor: "pointer" }}>
              <ItemCard item={item} index={i} color={COLORS[i % COLORS.length]} onSearch={onItemClick} />
            </div>
          ))}
        </div>
      )}

      {viewMode === "list" && (
        <div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "26px 1fr 80px 70px 58px",
            gap: 6, padding: "0 10px 6px",
            fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
            borderBottom: "1px solid var(--border-color)",
          }}>
            <span>#</span>
            <span>아이템</span>
            <span style={{ textAlign: "center" }}>추이</span>
            <span style={{ textAlign: "right" }}>평균가</span>
            <span style={{ textAlign: "right" }}>변동</span>
          </div>
          {sorted.map((item, i) => (
            <div
              key={item.itemName}
              onClick={() => onItemClick(item.itemName)}
              style={{ cursor: "pointer" }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <ItemRow item={item} index={i} color={COLORS[i % COLORS.length]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ 검색 결과 차트 (Chart.js) ═══ */
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

/* ═══ 메인 컴포넌트 ═══ */
export default function SoldClient({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
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
  const lastSearchedQuery = useRef("");

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

  /* ── 검색 실행 함수 (공통) ── */
  const doSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setLoading(true); setChartLoading(true); setError(""); setSearched(true);
    setQuery(trimmed);
    addRecent(trimmed);
    lastSearchedQuery.current = trimmed;
    try {
      const recentRows = await fetchHistory(trimmed);
      const filtered = (filterByItemName(recentRows, trimmed) as AuctionSoldItem[]);
      filtered.sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""));
      setResults(filtered);
      if (filtered.length === 0 && recentRows.length === 0) setError("거래 내역이 없습니다.");
    } catch {
      setError("서버 연결에 실패했습니다.");
      setResults([]); setChartMode("overview"); setChartTitle("");
    } finally { setLoading(false); }
  }, [fetchHistory]);

  const search = useCallback(async () => {
    await doSearch(query);
  }, [query, doSearch]);

  /* ── 핵심 수정: initialQuery prop 변경 감지 ──
     Nav에서 다른 아이템을 클릭하면 URL이 /sold?q=새아이템 으로 바뀌고,
     Next.js가 새 searchParams를 전달하지만 컴포넌트가 리마운트되지 않음.
     따라서 initialQuery 변경을 감지하여 새 검색을 실행해야 함. */
  useEffect(() => {
    const trimmed = (initialQuery || "").trim();
    if (trimmed && trimmed !== lastSearchedQuery.current) {
      doSearch(trimmed);
    }
  }, [initialQuery, doSearch]);

  useEffect(() => {
    if (!query.trim() && searched) {
      setSearched(false); setResults([]); setChartMode("overview"); setChartTitle(""); setChartData([]);
    }
  }, [query]);

  const handleItemClick = useCallback(async (name: string) => {
    await doSearch(name);
  }, [doSearch]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          <button
            onClick={() => { setChartMode("overview"); setChartTitle(""); setChartData([]); setSearched(false); setResults([]); setQuery(""); lastSearchedQuery.current = ""; }}
            style={{
              width: "100%", padding: "10px 0", marginBottom: 14,
              borderRadius: 8, border: "1.5px solid var(--color-primary)",
              background: "var(--color-primary-light)", color: "var(--color-primary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.15s",
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-primary)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-primary-light)"; (e.currentTarget as HTMLElement).style.color = "var(--color-primary)"; }}
          >
            ← 인기 아이템 시세 현황으로 돌아가기
          </button>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{chartTitle}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>실체결 기준 · 일별 평균가 + 거래량</div>
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

      {/* ═══ 기본 뷰: 대시보드 ═══ */}
      {chartMode === "overview" && !searched && insightItems.length > 0 && (
        <Card>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>인기 아이템 시세 현황</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              실체결 기준 · 7일간 거래 데이터 · 클릭 시 상세 검색
            </div>
          </div>
          <OverviewDashboard items={insightItems} onItemClick={handleItemClick} />
        </Card>
      )}

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