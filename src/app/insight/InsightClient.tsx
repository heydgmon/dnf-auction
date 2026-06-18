"use client";

import { useState, useEffect } from "react";
import { getRarityColor, formatGold } from "@/lib/utils";
import { Card, ItemImg, SkeletonList, Empty } from "@/components/shared";

interface InsightItem { itemName: string; itemId: string; itemRarity: string; trades: { date: string; unitPrice: number; count: number }[]; avgPrice: number; minPrice: number; maxPrice: number; totalVolume: number; totalValue: number; priceChange: number; }

// ── 클라이언트 캐시: 탭 전환 시 즉시 표시 ──
let clientCache: { data: InsightItem[]; fetchedAt: number } | null = null;
const CLIENT_CACHE_TTL = 3 * 60 * 1000;

const INSIGHT_GUIDE_SECTIONS = [
  {
    num: "1",
    title: "거래 규모란 무엇인가",
    subtitle: "비싼 아이템이 아니라, 돈이 많이 도는 아이템",
    tips: [
      {
        text: "거래 규모는 단순히 가격이 높은 순서가 아니라, 단가에 거래량을 곱한 총 거래액을 기준으로 합니다.",
        sub: "즉 한 개에 수억 골드라도 거의 거래되지 않는 아이템보다, 개당 가격은 낮아도 수백 건씩 팔리는 아이템이 위로 올라옵니다.",
      },
      {
        text: "거래 규모가 큰 아이템일수록 그 시세가 시장의 실제 합의에 가깝습니다.",
        sub: "소수만 거래하는 아이템은 한두 건에 가격이 휘둘리지만, 거래가 활발한 아이템은 가격이 안정적이라 사고팔 때 손해 볼 위험이 적습니다. 지금 아라드에서 골드가 가장 활발하게 도는 곳이 어디인지 보고 싶다면 이 탭을 먼저 확인하세요.",
      },
    ],
  },
  {
    num: "2",
    title: "가격 변동률, 거래량과 함께 보세요",
    subtitle: "변동률만 보면 노이즈에 속습니다",
    tips: [
      {
        text: "가격 변동률은 어제 평균 체결가 대비 오늘 평균이 얼마나 움직였는지를 나타냅니다.",
        sub: "빨간색 상승, 파란색 하락으로 표시되며, 변동 폭이 큰 순서로 정렬할 수 있습니다.",
      },
      {
        text: "변동률은 거래량과 반드시 함께 봐야 합니다.",
        sub: "5건 팔린 아이템의 +50%와 500건 팔린 아이템의 +5%는 신뢰도가 전혀 다릅니다. 거래량이 거의 없는데 변동률만 크다면, 소수의 거래가 만들어낸 일시적인 노이즈일 가능성이 높습니다. 반대로 거래량이 많은 상태에서 변동률이 움직였다면, 실제 수요나 공급에 변화가 생긴 의미 있는 신호로 볼 수 있습니다.",
      },
    ],
  },
  {
    num: "3",
    title: "시세 추이 차트 읽는 법",
    subtitle: "선과 거래량을 같이 봐야 합니다",
    intro: "아이템을 클릭하면 일별 평균가 추이와 거래 내역을 상세 차트로 확인할 수 있습니다. 차트를 읽는 기준은 다음과 같습니다.",
    tips: [
      {
        text: "평균가 선이 꾸준히 우상향하고 거래량도 함께 높다면, 실거래가 뒷받침되는 진짜 상승입니다.",
        sub: "보유 중이라면 매도 타이밍을 잡기 좋은 구간입니다.",
      },
      {
        text: "평균가만 출렁이고 거래량이 거의 없다면, 소수 거래에 의한 변동입니다.",
        sub: "이 경우에는 신뢰도를 낮춰서 봐야 합니다.",
      },
      {
        text: "거래량이 갑자기 폭증한다면, 패치나 이벤트로 수요가 터진 신호입니다.",
        sub: "시세가 급변하기 직전일 수 있으니 주의해서 봐야 합니다.",
      },
    ],
  },
  {
    num: "4",
    title: "그래서 이 데이터로 뭘 하면 되나",
    subtitle: "인사이트를 실전에 쓰는 법",
    tips: [
      {
        text: "매도 타이밍 잡기",
        sub: "보유한 아이템의 변동률이 상승세이고 거래량도 받쳐준다면, 더 기다리기보다 지금 파는 것이 안전합니다. 던파 시세는 패치 한 번에 꺾이는 경우가 많기 때문입니다.",
      },
      {
        text: "매수 타이밍 잡기",
        sub: "거래량은 유지되는데 가격만 하락하고 있다면, 일시적인 급매 구간일 수 있습니다. 바닥을 확인한 뒤 들어가면 차익을 노릴 수 있습니다.",
      },
      {
        text: "시장 흐름 읽기",
        sub: "강화권·증폭권의 거래 규모가 커지기 시작하면 증폭 시즌이 다가오고 있다는 신호입니다. 카드류의 변동이 심해지면 시즌 교체가 임박했을 가능성이 높습니다.",
      },
    ],
  },
  {
    num: "5",
    title: "자주 묻는 질문 (FAQ)",
    tips: [
      {
        text: "Q. 거래 규모순과 변동률순은 어떻게 다른가요?",
        sub: "거래 규모순은 단가에 거래량을 곱한 총 거래액 기준으로, 지금 골드가 가장 많이 도는 아이템을 보여줍니다. 변동률순은 어제 대비 가격이 가장 크게 움직인 아이템을 보여줍니다. 어디에 돈이 몰리는지 보려면 거래 규모순, 무엇이 갑자기 움직였는지 보려면 변동률순을 확인하세요.",
      },
      {
        text: "Q. 변동률이 0%로 표시되는 아이템은 무엇인가요?",
        sub: "어제 거래 데이터가 없거나 가격 변화가 없는 경우입니다. 시세 히스토리가 충분히 쌓이지 않은 신규 아이템이나, 거래가 드문 아이템에서 나타날 수 있습니다.",
      },
      {
        text: "Q. 데이터는 얼마나 자주 갱신되나요?",
        sub: "일별 평균 체결가는 매일 누적되어 7일간의 추이로 제공되며, 당일 거래 데이터는 실시간으로 반영됩니다. 다만 일정 주기로 캐싱하기 때문에 게임 내 시세와 약간의 시차가 있을 수 있습니다.",
      },
      {
        text: "Q. 여기 없는 아이템의 시세도 볼 수 있나요?",
        sub: "이 탭은 거래가 활발한 주요 아이템을 자동으로 추려서 보여줍니다. 목록에 없는 특정 아이템의 시세를 확인하려면 시세 검색 탭에서 직접 검색하시면 됩니다.",
      },
    ],
  },
];

function MiniChart({ trades, color, height = 48 }: { trades: { date: string; unitPrice: number }[]; color: string; height?: number }) {
  if (trades.length < 2) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-muted)" }}>거래 1건</div>;
  const prices = trades.map(t => t.unitPrice); const min = Math.min(...prices); const max = Math.max(...prices); const range = max - min || 1; const w = 200; const pad = 2;
  const points = trades.map((t, i) => { const x = pad + (i / (trades.length - 1)) * (w - pad * 2); const y = pad + (1 - (t.unitPrice - min) / range) * (height - pad * 2); return `${x},${y}`; }).join(" ");
  const gid = `g${color.replace(/[^a-zA-Z0-9]/g, "")}${height}`;
  return (<svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none"><defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><polygon points={`${pad},${height - pad} ${points} ${w - pad},${height - pad}`} fill={`url(#${gid})`} /><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}

function InsightGuide() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {INSIGHT_GUIDE_SECTIONS.map((section) => (
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
  );
}

export default function InsightClient() {
  const [data, setData] = useState<InsightItem[]>(clientCache?.data || []);
  const [loading, setLoading] = useState(!clientCache);
  const [selectedItem, setSelectedItem] = useState<InsightItem | null>(null);
  const [tab, setTab] = useState<"volume" | "change">("volume");

  useEffect(() => {
    if (clientCache && Date.now() - clientCache.fetchedAt < CLIENT_CACHE_TTL) {
      setData(clientCache.data);
      setLoading(false);
      return;
    }

    fetch("/api/market-insight")
      .then(r => r.json())
      .then(d => {
        const items = d.items || [];
        setData(items);
        clientCache = { data: items, fetchedAt: Date.now() };
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sortedByVolume = [...data].sort((a, b) => b.totalValue - a.totalValue); const sortedByChange = [...data].sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange)); const maxValue = sortedByVolume[0]?.totalValue || 1;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loading && <SkeletonList count={6} />}
      {!loading && data.length > 0 && (<>
        <Card>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}><button onClick={() => setTab("volume")} style={{ flex: 1, padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: tab === "volume" ? "var(--color-primary)" : "var(--bg-primary)", color: tab === "volume" ? "#fff" : "var(--text-muted)" }}> 거래 규모</button><button onClick={() => setTab("change")} style={{ flex: 1, padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: tab === "change" ? "var(--color-primary)" : "var(--bg-primary)", color: tab === "change" ? "#fff" : "var(--text-muted)" }}> 가격 변동률</button></div>
          {tab === "volume" && (<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>최근 거래 총액 기준 아이템 규모 비교</p>{sortedByVolume.map((item, i) => { const pct = (item.totalValue / maxValue) * 100; return (<div key={item.itemName} style={{ cursor: "pointer" }} onClick={() => setSelectedItem(selectedItem?.itemName === item.itemName ? null : item)}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}><div style={{ width: 20, fontSize: 11, fontWeight: 800, color: i < 3 ? "var(--color-primary)" : "var(--text-muted)", textAlign: "center" }}>{i + 1}</div><ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={24} /><span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</span><span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", flexShrink: 0 }}>{formatGold(item.totalValue)}</span></div><div style={{ marginLeft: 30, height: 6, borderRadius: 3, background: "var(--bg-primary)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: i === 0 ? "var(--color-primary)" : i === 1 ? "#3B82F6" : i === 2 ? "#60A5FA" : "#94A3B8", transition: "width 0.6s ease" }} /></div></div>); })}</div>)}
          {tab === "change" && (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}><p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>최근 거래 기준 가격 변동률</p>{sortedByChange.map((item) => { const isUp = item.priceChange > 0; const isFlat = item.priceChange === 0; const changeColor = isFlat ? "var(--text-muted)" : isUp ? "#DC2626" : "#2563EB"; const arrow = isFlat ? "―" : isUp ? "▲" : "▼"; return (<div key={item.itemName} className="card" style={{ padding: "10px 14px", cursor: "pointer", borderColor: selectedItem?.itemName === item.itemName ? "var(--color-primary)" : undefined }} onClick={() => setSelectedItem(selectedItem?.itemName === item.itemName ? null : item)}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div><div style={{ fontSize: 10, color: "var(--text-muted)" }}>평균 {formatGold(item.avgPrice)} · {item.totalVolume}건 거래</div></div><div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: changeColor }}>{arrow} {Math.abs(item.priceChange)}%</div><div style={{ fontSize: 10, color: "var(--text-muted)" }}>변동률</div></div></div></div>); })}</div>)}
        </Card>
        {selectedItem && (<Card style={{ borderColor: "var(--color-primary)" }}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><ItemImg itemId={selectedItem.itemId} itemName={selectedItem.itemName} rarity={selectedItem.itemRarity} size={32} /><div><div style={{ fontSize: 14, fontWeight: 700, color: getRarityColor(selectedItem.itemRarity) }}>{selectedItem.itemName}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>최근 거래 기반 시세 추이</div></div></div><div style={{ marginBottom: 16, padding: "8px 0", background: "var(--bg-primary)", borderRadius: 8 }}><MiniChart trades={selectedItem.trades} color={selectedItem.priceChange >= 0 ? "#DC2626" : "#2563EB"} height={80} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}><div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-primary)" }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>평균 가격</div><div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{formatGold(selectedItem.avgPrice)}</div></div><div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-primary)" }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>가격 변동률</div><div style={{ fontSize: 14, fontWeight: 700, color: selectedItem.priceChange >= 0 ? "#DC2626" : "#2563EB" }}>{selectedItem.priceChange >= 0 ? "+" : ""}{selectedItem.priceChange}%</div></div><div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-primary)" }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>최저 / 최고</div><div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{formatGold(selectedItem.minPrice)} ~ {formatGold(selectedItem.maxPrice)}</div></div><div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-primary)" }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>거래량 / 총액</div><div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{selectedItem.totalVolume}건 · {formatGold(selectedItem.totalValue)}</div></div></div>{selectedItem.trades.length > 0 && (<div style={{ marginTop: 12 }}><div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>일별 거래 내역</div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{[...selectedItem.trades].reverse().map((t, i) => (<div key={t.date} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: i % 2 === 0 ? "var(--bg-primary)" : "transparent", fontSize: 11 }}><span style={{ color: "var(--text-muted)", width: 80 }}>{t.date.slice(5)}</span><span style={{ flex: 1, fontWeight: 600, color: "var(--text-primary)" }}>{formatGold(t.unitPrice)}</span><span style={{ color: "var(--text-muted)" }}>{t.count}건</span></div>))}</div></div>)}</Card>)}
        <section><div className="section-title" style={{ marginBottom: 12 }}> 아이템별 시세 추이</div><p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>아이템을 클릭하면 상세 차트를 확인할 수 있습니다</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>{data.map((item) => { const isUp = item.priceChange > 0; const isFlat = item.priceChange === 0; const changeColor = isFlat ? "var(--text-muted)" : isUp ? "#DC2626" : "#2563EB"; const isSelected = selectedItem?.itemName === item.itemName; return (<div key={item.itemName} className="card" onClick={() => setSelectedItem(isSelected ? null : item)} style={{ padding: "12px 14px", cursor: "pointer", borderColor: isSelected ? "var(--color-primary)" : undefined, transition: "border-color 0.15s" }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={24} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 600, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div></div></div><MiniChart trades={item.trades} color={isUp ? "#DC2626" : "#2563EB"} height={40} /><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}><span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{formatGold(item.avgPrice)}</span><span style={{ fontSize: 11, fontWeight: 600, color: changeColor }}>{isFlat ? "―" : isUp ? "▲" : "▼"} {Math.abs(item.priceChange)}%</span></div></div>); })}</div></section>
      </>)}
      {!loading && data.length === 0 && <Empty msg="인사이트 데이터를 불러오는 중입니다." />}
      <InsightGuide />
    </div>
  );
}
