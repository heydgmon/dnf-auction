"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AuctionItem, AuctionSearchResponse, PopularItem,
} from "@/lib/types";
import { getRarityColor, getRarityBg, formatGold, formatFullGold, validateEmail, formatDate } from "@/lib/utils";
import {
  Card, Btn, ItemImg, InfoCell, ErrorMsg, SkeletonList, Empty,
  AutocompleteSearch, SearchHelpers, addRecent, extractRows,
} from "@/components/shared";

function AuctionRow({ item }: { item: AuctionItem }) {
  const [open, setOpen] = useState(false);
  const upgrade = (item as any).upgrade;
  const upgradeMax = (item as any).upgradeMax;
  return (
    <div className="card" style={{ padding: "12px 16px", cursor: "pointer", borderColor: open ? "var(--color-primary)" : undefined, transition: "border-color 0.15s" }} onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.reinforce > 0 && <span style={{ color: "var(--color-accent-dim)" }}>+{item.reinforce} </span>}
            {item.itemName}
            {item.refine > 0 && <span style={{ marginLeft: 4, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--color-primary-light)", color: "var(--color-primary)" }}>제련 {item.refine}</span>}
            {upgrade != null && upgradeMax != null && upgradeMax > 0 && <span style={{ marginLeft: 4, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--color-accent-light)", color: "var(--color-accent)" }}>{upgrade}성/{upgradeMax}성</span>}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 8 }}>
            <span>Lv.{item.itemAvailableLevel}</span>
            <span style={{ color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span>
            <span>{item.itemType}</span>
            {item.count > 1 && <span>x{item.count}</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-accent-dim)" }}>{formatGold(item.unitPrice)}</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>개당</div>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-color)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          <InfoCell label="총 가격" value={formatFullGold(item.currentPrice)} />
          <InfoCell label="평균 시세" value={formatFullGold(item.averagePrice)} />
          <InfoCell label="등록일" value={formatDate(item.regDate)} />
          <InfoCell label="만료일" value={formatDate(item.expireDate)} />
          {item.amplificationName && <InfoCell label="증폭" value={item.amplificationName} />}
          {upgrade != null && <InfoCell label="업그레이드" value={`${upgrade} / ${upgradeMax}`} />}
        </div>
      )}
    </div>
  );
}

export default function AuctionClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);

  // ── 운명의 아르카나 패키지 시세 ──
  const SERA_SHOP_PRICE = 39200;
  const GOLD_TO_WON = 0.001;

  const [pkgData, setPkgData] = useState<{
    loading: boolean;
    lowestPrice: number;
    itemId: string;
    itemRarity: string;
    count: number;
  }>({ loading: true, lowestPrice: 0, itemId: "", itemRarity: "", count: 0 });

  useEffect(() => {
    fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/auction?itemName=${encodeURIComponent("운명의 아르카나 패키지")}&wordType=match&limit=10`);
        const data = await res.json();
        const rows = data.rows || [];
        if (rows.length > 0) {
          setPkgData({
            loading: false,
            lowestPrice: rows[0].unitPrice || 0,
            itemId: rows[0].itemId || "",
            itemRarity: rows[0].itemRarity || "",
            count: rows.length,
          });
        } else {
          setPkgData(prev => ({ ...prev, loading: false }));
        }
      } catch {
        setPkgData(prev => ({ ...prev, loading: false }));
      }
    })();
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    addRecent(query.trim());
    try {
      const res = await fetch(`/api/auction?itemName=${encodeURIComponent(query.trim())}&wordType=match&limit=400`);
      const data: AuctionSearchResponse = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || `오류`); setResults([]); }
      else { const allRows = [...(data.rows || [])]; allRows.sort((a, b) => a.unitPrice - b.unitPrice); setResults(allRows); }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); }
    finally { setLoading(false); }
  }, [query]);

  const cashEquivalent = pkgData.lowestPrice > 0 ? Math.round(pkgData.lowestPrice * GOLD_TO_WON) : 0;
  const priceDiff = SERA_SHOP_PRICE - cashEquivalent;
  const isBuyNow = cashEquivalent < SERA_SHOP_PRICE;
  const savingsPercent = SERA_SHOP_PRICE > 0 ? Math.round((priceDiff / SERA_SHOP_PRICE) * 100) : 0;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>현재 경매장 등록 아이템을 검색합니다. 개당 가격 낮은 순으로 정렬됩니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading} placeholder="아이템 이름 (예: 골고라이언, 리노, 패키지...)" />
      </Card>

      {/* ═══ 운명의 아르카나 패키지 카드 ═══ */}
      {!searched && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "22px 20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -50, right: -50, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(147,51,234,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,119,6,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, position: "relative" }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>패키지 구매 가이드</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>경매장 vs 세라샵 가격 비교</div>
            </div>
            <div style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(147,51,234,0.15)", border: "1px solid rgba(147,51,234,0.3)", fontSize: 10, fontWeight: 700, color: "#C084FC" }}>GUIDE</div>
          </div>
          <div style={{ background: "var(--bg-primary)", borderRadius: 0, padding: "10px 14px", marginBottom: 14, borderLeft: "3px solid #A855F7", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>언제 사는 게 이득인가요?</span>
          </div>
          <div style={{ background: "var(--bg-primary)", borderRadius: 14, padding: "16px", border: "1px solid var(--border-color)", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              {pkgData.loading ? (
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0 }} />
              ) : (
                <ItemImg itemId={pkgData.itemId} itemName="운명의 아르카나 패키지" rarity={pkgData.itemRarity} size={52} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>운명의 아르카나 패키지</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {pkgData.itemRarity && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${getRarityColor(pkgData.itemRarity)}18`, color: getRarityColor(pkgData.itemRarity), fontWeight: 600 }}>{pkgData.itemRarity}</span>
                  )}
                  {pkgData.count > 0 && <span style={{ fontSize: 10, color: "#64748B" }}>등록 {pkgData.count}건+</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>경매장 최저가</div>
                {pkgData.loading ? (<div className="skeleton" style={{ height: 22, borderRadius: 4 }} />) : pkgData.lowestPrice > 0 ? (<><div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-accent)", letterSpacing: "-0.02em" }}>{formatGold(pkgData.lowestPrice)}</div><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>골드</div></>) : (<div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>매물 없음</div>)}
              </div>
              <div style={{ flex: 1, background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "12px" }}>
                <div style={{ fontSize: 10, color: "#64748B", marginBottom: 6 }}>현금 환산가</div>
                {pkgData.loading ? (<div className="skeleton" style={{ height: 22, borderRadius: 4 }} />) : cashEquivalent > 0 ? (<><div style={{ fontSize: 20, fontWeight: 800, color: "#60A5FA", letterSpacing: "-0.02em" }}>{cashEquivalent.toLocaleString()}</div><div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>원 (1백만G = 1,000원)</div></>) : (<div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>—</div>)}
              </div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 10, color: "#64748B" }}>세라샵 판매가</div><div style={{ fontSize: 16, fontWeight: 700, color: "#94A3B8", marginTop: 2 }}>{SERA_SHOP_PRICE.toLocaleString()}원</div></div>
              <div style={{ fontSize: 10, color: "#64748B", padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>공식 가격</div>
            </div>
          </div>
          {!pkgData.loading && pkgData.lowestPrice > 0 && (
            <div style={{ borderRadius: 12, padding: "14px 16px", marginBottom: 12, background: isBuyNow ? "rgba(5,150,105,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${isBuyNow ? "rgba(5,150,105,0.25)" : "rgba(239,68,68,0.25)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: isBuyNow ? "rgba(5,150,105,0.2)" : "rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{isBuyNow ? "✅" : "⛔"}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: isBuyNow ? "#34D399" : "#F87171" }}>{isBuyNow ? "경매장에서 사면 이득!" : "지금 사면 손해입니다"}</div>
                  <div style={{ fontSize: 11, color: isBuyNow ? "#6EE7B7" : "#FCA5A5", marginTop: 2, fontWeight: 500 }}>{isBuyNow ? `세라샵보다 ${priceDiff.toLocaleString()}원 저렴 (${savingsPercent}% 절약)` : `세라샵보다 ${Math.abs(priceDiff).toLocaleString()}원 비쌈`}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, borderRadius: 8, padding: "10px 12px", background: isBuyNow ? "rgba(5,150,105,0.06)" : "rgba(239,68,68,0.06)" }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "#64748B", marginBottom: 3 }}>경매장 (현금 환산)</div><div style={{ fontSize: 14, fontWeight: 700, color: isBuyNow ? "#34D399" : "#F87171" }}>{cashEquivalent.toLocaleString()}원</div></div>
                <div style={{ display: "flex", alignItems: "center", color: "#475569", fontSize: 16, fontWeight: 300 }}>vs</div>
                <div style={{ flex: 1, textAlign: "right" }}><div style={{ fontSize: 10, color: "#64748B", marginBottom: 3 }}>세라샵</div><div style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>{SERA_SHOP_PRICE.toLocaleString()}원</div></div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
            <span style={{ fontSize: 11, color: "#475569", flexShrink: 0, marginTop: 1 }}>ℹ️</span>
            <div style={{ fontSize: 10, color: "#64748B", lineHeight: 1.6 }}>현금 환산 기준: <span style={{ color: "#94A3B8" }}>1,000,000 골드 = 1,000원</span> · 시세는 실시간 변동됩니다.<br />패키지 내 아이템 개별 가치에 따라 실제 이득 여부는 달라질 수 있습니다.</div>
          </div>
        </div>
      )}

      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{results.length}건 · 개당 가격 낮은 순</p>
          {results.length >= 750 && (
            <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 8, fontSize: 11, background: "var(--color-accent-light)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}>⚠ 등록 매물이 많아 일부만 표시됩니다.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((item, i) => <AuctionRow key={`${item.auctionNo}-${i}`} item={item} />)}
          </div>
        </div>
      )}
      {!loading && searched && !results.length && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}