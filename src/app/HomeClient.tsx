"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getRarityColor, formatGold } from "@/lib/utils";
import { ItemImg, SkeletonList, Empty } from "@/components/shared";

interface TrendingItem {
  itemName: string;
  auctionCount: number;
  lowestPrice: number;
  itemRarity: string;
  itemId: string;
  itemType: string;
  // 거래 회전율 관련 필드 (새로 추가)
  turnoverRate?: number;  // % 단위 (예: 250 = 250%)
  soldVolume?: number;    // 최근 7일 체결량
}

interface ChartRow {
  date: string;
  avg: number;
  count: number;
  min?: number;
  max?: number;
}

let clientCache: { items: TrendingItem[]; fetchedAt: number } | null = null;
const CLIENT_CACHE_TTL = 3 * 60 * 1000;

/* ═══ SVG 스파크라인 ═══ */
function MiniChart({ data, color, height = 60 }: { data: ChartRow[]; color: string; height?: number }) {
  if (data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text-muted)" }}>
        거래 데이터 부족
      </div>
    );
  }
  const prices = data.map(d => d.avg);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 400;
  const padX = 6;
  const padTop = 6;
  const padBot = 16;
  const chartH = height - padTop - padBot;

  const pts = prices.map((v, i) => {
    const x = padX + (i / (prices.length - 1)) * (w - padX * 2);
    const y = padTop + (1 - (v - min) / range) * chartH;
    return { x, y };
  });

  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const polygon = `${padX},${padTop + chartH} ${polyline} ${pts[pts.length - 1].x.toFixed(1)},${padTop + chartH}`;
  const gid = `home-sp-${color.replace(/[^a-z0-9]/gi, "")}`;

  const firstDate = data[0].date.slice(5);
  const lastDate = data[data.length - 1].date.slice(5);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={polygon} fill={`url(#${gid})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3.5 : 1.5} fill={i === pts.length - 1 ? color : "transparent"} stroke={color} strokeWidth={i === pts.length - 1 ? 0 : 0.8} />
      ))}
      <text x={padX} y={height - 2} fontSize="9" fill="var(--text-muted)" textAnchor="start">{firstDate}</text>
      <text x={w - padX} y={height - 2} fontSize="9" fill="var(--text-muted)" textAnchor="end">{lastDate}</text>
    </svg>
  );
}

/* ═══ 회전율 포매터 ═══
   회전율 = (7일 체결량 / 현재 매물 수) × 100
   예: 250% → 매물 1개당 주당 2.5회 체결
       50%  → 매물 2개당 주당 1회 체결 (느림) */
function formatTurnover(rate?: number): string {
  if (rate === undefined || rate === null) return "—";
  if (rate >= 1000) return `${(rate / 100).toFixed(0)}x`;
  return `${rate}%`;
}

/* ═══ 아이템 상세 패널 (전체 너비) ═══ */
function ItemDetailPanel({ item, onClose }: { item: TrendingItem; onClose: () => void }) {
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [recentRows, setRecentRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/auction-sold-history?itemName=${encodeURIComponent(item.itemName)}&wordType=match&days=7`)
      .then(r => r.json())
      .then(d => {
        setChartData(d.chartRows || []);
        setRecentRows((d.recentRows || []).slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item.itemName]);

  const prices = chartData.map(d => d.avg);
  const latestPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  const firstPrice = prices.length > 0 ? prices[0] : 0;
  const change = firstPrice > 0 ? Math.round(((latestPrice - firstPrice) / firstPrice) * 10000) / 100 : 0;
  const isUp = change >= 0;
  const chartColor = isUp ? "#E24B4A" : "#378ADD";

  return (
    <div className="animate-slide-up" style={{
      background: "var(--bg-card)",
      border: "1px solid var(--color-primary)",
      borderRadius: 14,
      padding: "18px",
      boxShadow: "0 4px 20px rgba(37,99,235,0.08)",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: getRarityColor(item.itemRarity) }}>{item.itemName}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {item.itemType} · {item.itemRarity} · 회전율 {formatTurnover(item.turnoverRate)}
          </div>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="skeleton" style={{ height: 80, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
        </div>
      ) : (
        <>
          {/* 차트 + 통계 가로 배치 */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {/* 차트 */}
            <div style={{ flex: "1 1 300px", minWidth: 0, background: "var(--bg-primary)", borderRadius: 10, padding: "12px 10px 6px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, paddingLeft: 4 }}>
                시세 추이 ({chartData.length}일)
              </div>
              {chartData.length >= 2 ? (
                <MiniChart data={chartData} color={chartColor} height={72} />
              ) : (
                <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--text-muted)" }}>데이터 부족</div>
              )}
            </div>

            {/* 통계 */}
            <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
              <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px", minWidth: 100 }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3 }}>최근 평균가</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{latestPrice > 0 ? formatGold(latestPrice) : "—"}</div>
              </div>
              <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px", minWidth: 100 }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3 }}>변동률</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: chartColor }}>
                  {latestPrice > 0 ? `${isUp ? "+" : ""}${change}%` : "—"}
                </div>
              </div>
              <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px", gridColumn: "span 2" }}>
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3 }}>거래 건수</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)" }}>
                  {chartData.reduce((s, d) => s + d.count, 0)}건
                </div>
              </div>
            </div>
          </div>

          {/* 최근 거래 내역 */}
          {recentRows.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>최근 거래 내역</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {recentRows.map((r: any, i: number) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px", borderRadius: 6,
                    background: i % 2 === 0 ? "var(--bg-primary)" : "transparent",
                    fontSize: 12,
                  }}>
                    <span style={{ color: "var(--text-muted)", width: 80, flexShrink: 0, fontSize: 11 }}>
                      {(r.soldDate || "").slice(5, 16)}
                    </span>
                    <span style={{ flex: 1, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.reinforce > 0 ? `+${r.reinforce} ` : ""}{r.itemName}
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--color-accent-dim)", flexShrink: 0 }}>
                      {formatGold(r.unitPrice || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 더 보기 */}
          <a
            href={`/sold?q=${encodeURIComponent(item.itemName)}`}
            style={{
              display: "block", textAlign: "center",
              padding: "10px 0", borderRadius: 8,
              background: "var(--color-primary-light)", color: "var(--color-primary)",
              fontSize: 12, fontWeight: 600, textDecoration: "none",
              border: "1px solid var(--color-primary)",
            }}
          >
            시세 상세 보기 →
          </a>
        </>
      )}
    </div>
  );
}

export default function HomeClient() {
  const [items, setItems] = useState<TrendingItem[]>(clientCache?.items || []);
  const [loading, setLoading] = useState(!clientCache);
  const [selectedItem, setSelectedItem] = useState<TrendingItem | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (clientCache && Date.now() - clientCache.fetchedAt < CLIENT_CACHE_TTL) {
      setItems(clientCache.items);
      setLoading(false);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch("/api/trending")
      .then(r => r.json())
      .then(d => {
        const fetched = d.items || [];
        setItems(fetched);
        clientCache = { items: fetched, fetchedAt: Date.now() };
      })
      .catch(() => {})
      .finally(() => { setLoading(false); fetchedRef.current = false; });
  }, []);

  const handleItemClick = useCallback((item: TrendingItem) => {
    setSelectedItem(prev => prev?.itemName === item.itemName ? null : item);
  }, []);

  // TOP4 중 선택된 아이템이 있는지
  const selectedInTop4 = selectedItem && items.slice(0, 4).some(it => it.itemName === selectedItem.itemName);
  // 5~20위 중 선택된 아이템이 있는지
  const selectedInRest = selectedItem && items.slice(4, 20).some(it => it.itemName === selectedItem.itemName);

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32", "#4A90D9"];

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section>
        <div className="section-title" style={{ marginBottom: 12 }}>경매장 인기 아이템 TOP 20</div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
          거래 회전율이 높은 순서입니다. 회전율 = 최근 7일 체결량 ÷ 현재 매물 수 × 100. 값이 높을수록 빠르게 팔리는 아이템입니다.
        </p>
        {loading && <SkeletonList count={8} />}
        {!loading && items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* ═══ TOP 4 카드 그리드 ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {items.slice(0, 4).map((item, i) => (
                <div
                  key={item.itemName}
                  className="card"
                  onClick={() => handleItemClick(item)}
                  style={{
                    padding: 0, overflow: "hidden",
                    border: selectedItem?.itemName === item.itemName
                      ? `2px solid var(--color-primary)`
                      : `2px solid ${medalColors[i]}30`,
                    position: "relative", cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, width: 36, height: 36, background: medalColors[i], borderRadius: "0 0 12px 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: i === 0 ? "#92400E" : "#fff" }}>{i + 1}</div>
                  <div style={{ padding: "20px 16px 16px", textAlign: "center" }}>
                    <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={48} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: getRarityColor(item.itemRarity), marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{item.itemType}</div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>거래 회전율</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-primary)" }}>{formatTurnover(item.turnoverRate)}</div>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-primary)", marginTop: 8, opacity: 0.7 }}>클릭하여 시세 확인</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ═══ TOP4 상세 패널: 그리드 바깥, 전체 너비 ═══ */}
            {selectedInTop4 && selectedItem && (
              <ItemDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
            )}

            {/* ═══ 5~20위 리스트 ═══ */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.slice(4, 20).map((item, i) => (
                <div key={item.itemName}>
                  <div
                    className="card"
                    onClick={() => handleItemClick(item)}
                    style={{
                      padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
                      cursor: "pointer",
                      borderColor: selectedItem?.itemName === item.itemName ? "var(--color-primary)" : undefined,
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--text-muted)", flexShrink: 0 }}>{i + 5}</div>
                    <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.itemType}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>{formatTurnover(item.turnoverRate)}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>거래 회전율</div>
                    </div>
                  </div>
                  {/* 5~20위는 해당 행 바로 아래에 표시 */}
                  {selectedItem?.itemName === item.itemName && (
                    <div style={{ marginTop: 6 }}>
                      <ItemDetailPanel item={item} onClose={() => setSelectedItem(null)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {!loading && items.length === 0 && <Empty msg="데이터를 불러오는 중입니다." />}
      </section>
    </div>
  );
}