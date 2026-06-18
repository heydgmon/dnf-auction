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

const RANKING_GUIDE_SECTIONS = [
  {
    num: "1",
    title: "이 랭킹을 어떻게 읽어야 하나",
    subtitle: "등록 매물이 많다 ≠ 비싸다, ≠ 좋다",
    tips: [
      {
        text: "이 페이지의 순위는 현재 경매장에 매물이 몇 개 등록되어 있는지를 기준으로 합니다.",
        sub: "그래서 상위권은 거의 항상 무색 큐브 조각, 큐브, 토큰 같은 소비재가 차지합니다. 개당 몇십 골드짜리 아이템들입니다. 이 아이템들이 비싸서 올라온 것이 아니라, 던전을 돌면 누구나 사용하는 물건이라 끊임없이 거래되기 때문입니다.",
      },
      {
        text: "이 랭킹은 비싼 아이템 순위가 아니라, 지금 아라드에서 골드가 가장 활발하게 도는 물건 순위입니다.",
        sub: "매물이 많다는 것은 곧 사는 사람도 많고 파는 사람도 많다는 뜻이며, 그만큼 시세가 안정적이라 손해를 볼 위험이 적다는 의미이기도 합니다.",
      },
    ],
  },
  {
    num: "2",
    title: "상위권 단골 아이템, 왜 항상 거기 있나",
    subtitle: "소비재가 상위권을 독식하는 이유",
    intro: "거래량 상위권에 매번 보이는 아이템들은 성격이 정해져 있습니다. 던파 경제를 이해하려면 이 분류를 알아두면 도움이 됩니다.",
    tips: [
      {
        text: "던전 소비재 (큐브 조각·정수·소울 결정류)",
        sub: "던전을 입장하거나 클리어할 때마다 소모되기 때문에 수요가 마를 일이 없습니다. 시세는 거의 고정되어 있고, 패치로 던전 입장 방식이 바뀔 때만 출렁입니다. 시세를 따로 확인할 일은 드물지만 거래량은 항상 1위권을 유지합니다.",
      },
      {
        text: "교환·재화 아이템 (토큰류)",
        sub: "이벤트나 콘텐츠 화폐입니다. 이벤트 기간에는 매물이 폭증하고 끝나면 거래가 뚝 끊깁니다. 이벤트 주기를 잘 타면 단기 차익을 노릴 수 있는 영역입니다.",
      },
      {
        text: "강화/증폭권",
        sub: "평소에는 잠잠하다가 증폭 시즌(보통 1월, 방학 이벤트)에 들어가면 거래량과 가격이 함께 오릅니다. 시즌 직전이 천장, 시즌이 끝나면 바닥이라 타이밍 싸움이 가장 치열한 카테고리입니다.",
      },
      {
        text: "종결템·패키지",
        sub: "단가는 가장 비싸지만 거래량은 적습니다. 한 건 한 건이 큰돈이라 상위권에 가끔 등장하는 정도입니다. 이런 아이템은 매물 수보다 실거래 시세와 종결템 시세를 확인해야 정확합니다.",
      },
    ],
  },
  {
    num: "3",
    title: "그래서 이 데이터로 뭘 하면 되나",
    subtitle: "경매장에서 손해 보지 않는 2가지",
    tips: [
      {
        text: "호가가 아니라 실거래가를 보세요.",
        sub: "비싸게 올려둔 매물은 팔리지 않은 채 계속 떠 있어서, 최저가만 보면 시세를 과대평가하기 쉽습니다. 진짜 시세는 최근에 실제로 얼마에 팔렸는지입니다. 팔 물건의 가격을 잡을 때는 시세 검색에서 체결가를 먼저 확인하세요.",
      },
      {
        text: "타이밍을 읽으세요.",
        sub: "시즌 아이템(카드·칭호·오라)은 출시 직후가 가장 비싸고, 다음 시즌 예고가 뜨는 순간부터 가격이 빠집니다. 특히 마법부여 카드는 시즌마다 종결이 리셋되어, 수억 골드 하던 카드가 다음 시즌에는 100만 골드 밑으로 떨어지기도 합니다. 살 때는 시즌 초, 팔 때는 다음 시즌 예고 전이 정석입니다.",
      },
    ],
  },
  {
    num: "4",
    title: "자주 묻는 질문 (FAQ)",
    tips: [
      {
        text: "Q. 순위가 자주 바뀌는데 정확한 건가요?",
        sub: "경매장 등록 현황은 실시간으로 계속 변합니다. 누군가 매물을 한꺼번에 올리거나 대량으로 사가면 순위가 출렁이는 것이 정상입니다. 던프라이스는 일정 주기로 데이터를 캐싱하여 보여주기 때문에, 게임 내 화면과 몇 분 정도 차이가 발생할 수 있습니다.",
      },
      {
        text: "Q. 비싼 아이템이 왜 1위가 아닌가요?",
        sub: "이 랭킹은 가격이 아니라 현재 등록된 매물 수를 기준으로 합니다. 수억 골드짜리 종결템은 한두 개만 올라오기 때문에 순위가 낮고, 몇십 골드짜리 소비재가 수십 개씩 등록되어 상위권을 차지합니다. 비싼 아이템의 시세는 종결템 시세 탭에서 확인하실 수 있습니다.",
      },
      {
        text: "Q. 검색해도 매물이 일부만 나옵니다.",
        sub: "던파 Open API는 한 번에 조회할 수 있는 매물 수에 한계가 있어 최대 800건까지만 수집합니다. 토큰이나 큐브처럼 매물이 수천 개씩 등록되는 아이템은 그중 일부만 표시됩니다. 시세를 파악하기에는 충분하지만, 전체 매물을 확인하려면 게임 내 경매장을 이용해야 합니다.",
      },
      {
        text: "Q. 표시된 가격에 바로 살 수 있나요?",
        sub: "경매장 시세는 실시간으로 변동되며, 데이터 갱신 시점과 실제 구매 시점 사이에 매물이 팔리거나 새로 올라올 수 있습니다. 던프라이스의 가격은 참고용 기준가로 활용하시고, 실제 구매는 게임 내에서 최종 확인하시기를 권장합니다.",
      },
    ],
  },
];

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
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.itemType} · {item.itemRarity} · 등록 {item.auctionCount}건+</div>
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
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>현재 경매장에 등록된 매물이 많은 순서입니다. 클릭하면 시세를 확인할 수 있습니다.</p>
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
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>등록 매물</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-primary)" }}>{item.auctionCount}건+</div>
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
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>{item.auctionCount}건+</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>등록 매물</div>
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

      {/* ═══ 경매장 인사이트 텍스트 섹션 ═══ */}
      <section style={{
        padding: "28px 24px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: 16,
      }}>
        {/* 상단 타이틀 */}
        <div style={{
          fontSize: 15,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 20,
          letterSpacing: "-0.02em",
          borderLeft: "3px solid var(--color-primary)",
          paddingLeft: 12,
        }}>
          경매장에서 손해보는 이유, 대부분 같습니다
        </div>

        {/* 인용구 3개 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {[
            "분명히 싸게 산 것 같은데 팔리질 않는다.",
            "올리자마자 다른 사람이 더 싸게 올렸다.",
            "며칠 전에 팔았어야 했는데 지금은 반값이 됐다.",
          ].map((quote, i) => (
            <div key={i} style={{
              padding: "10px 14px",
              background: "var(--bg-primary)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--text-secondary)",
              fontStyle: "italic",
              borderLeft: "2px solid var(--color-accent)",
            }}>
              "{quote}"
            </div>
          ))}
        </div>

        {/* 본문 단락 1 */}
        <p style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.8,
          marginBottom: 12,
        }}>
          경매장에서 손해를 보는 패턴은 생각보다 단순합니다.{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            시세를 모르거나, 타이밍을 놓쳤거나, 수요를 잘못 읽었거나.
          </span>{" "}
          이 세 가지 중 하나입니다.
        </p>

        <p style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.8,
          marginBottom: 24,
        }}>
          던프라이스는 이 세 가지 중 적어도 하나는 해결해 드릴 수 있습니다. 지금 뭐가 많이 올라오고 있는지, 어떤 카테고리에 거래가 몰리는지, 그 흐름을 보는 것만으로도 경매장을 대하는 감각이 달라집니다.
        </p>

        {/* 구분선 + 소제목 */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
          <div style={{
            fontSize: 13,
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
          }}>
            결국 던파 경매장도 읽는 사람이 이깁니다
          </div>
          <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
        </div>

        {/* 본문 단락 2 */}
        <p style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.8,
          marginBottom: 16,
        }}>
          주식도, 부동산도, 결국 정보를 먼저 읽은 사람이 유리하듯 던파 경매장도 흐름을 읽는 사람이 골드를 법니다. 거창한 분석이 필요한 게 아닙니다.{" "}
          <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
            오늘 뭐가 많이 올라왔는지, 지금 시세가 어떻게 형성돼 있는지,
          </span>{" "}
          그 정도만 알아도 충분합니다.
        </p>

        {/* 마무리 강조 박스 */}
        <div style={{
          padding: "12px 16px",
          background: "var(--color-primary-light)",
          border: "1px solid var(--color-primary)",
          borderRadius: 10,
          fontSize: 13,
          color: "var(--color-primary)",
          fontWeight: 600,
          lineHeight: 1.7,
        }}>
          던프라이스는 그걸 매일, 실시간으로 보여드립니다.
        </div>
      </section>

      {/* ═══ 랭킹 해설 섹션 ═══ */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {RANKING_GUIDE_SECTIONS.map((section) => (
          <div
            key={section.num}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div style={{
              background: "var(--bg-primary)",
              padding: "14px 20px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.5 }}>
                섹션 {section.num} — {section.title}
              </span>
              {section.subtitle && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)", lineHeight: 1.5 }}>
                  {section.subtitle}
                </span>
              )}
            </div>

            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {section.intro && (
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
                  {section.intro}
                </p>
              )}
              {section.tips.map((tip, ti) => (
                <div key={ti} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "var(--color-primary)",
                    flexShrink: 0, marginTop: 6,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.6 }}>{tip.text}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.7 }}>{tip.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
