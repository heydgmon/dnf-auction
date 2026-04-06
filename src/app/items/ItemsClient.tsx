"use client";

import { useState, useCallback, useEffect } from "react";
import { PopularItem } from "@/lib/types";
import { getRarityColor } from "@/lib/utils";
import {
  Card, ItemImg, ErrorMsg, SkeletonList, Empty,
  AutocompleteSearch, SearchHelpers, addRecent, extractRows,
} from "@/components/shared";

export default function ItemsClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [detail, setDetail] = useState<any>(null);

  // ── 천해천 신규 아이템 상태 ──
  const [newItems, setNewItems] = useState<any[]>([]);
  const [newItemsLoading, setNewItemsLoading] = useState(true);
  const [newItemDetail, setNewItemDetail] = useState<any>(null);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  // ── 천해천 신규 아이템 로드: "서약" Lv115 + "결정" Lv115 ──
  useEffect(() => {
    const fetchNewItems = async () => {
      setNewItemsLoading(true);
      try {
        const [res1, res2] = await Promise.all([
          fetch(`/api/items?itemName=${encodeURIComponent("서약")}&wordType=full&limit=30`),
          fetch(`/api/items?itemName=${encodeURIComponent("결정")}&wordType=full&limit=30`),
        ]);
        const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
        const rows1 = extractRows(data1).filter((item: any) => item.itemAvailableLevel === 115 && item.itemName?.includes("서약"));
        const rows2 = extractRows(data2).filter((item: any) => item.itemAvailableLevel === 115 && item.itemName?.includes("결정"));
        const seen = new Set<string>();
        const combined: any[] = [];
        for (const item of [...rows1, ...rows2]) {
          if (!seen.has(item.itemId)) { seen.add(item.itemId); combined.push(item); }
        }
        setNewItems(combined);
      } catch { setNewItems([]); }
      finally { setNewItemsLoading(false); }
    };
    fetchNewItems();
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true); setDetail(null);
    addRecent(query.trim());
    try {
      const res = await fetch(`/api/items?itemName=${encodeURIComponent(query.trim())}&wordType=full&limit=30`);
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || "오류"); setResults([]); }
      else { setResults(extractRows(data)); }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); }
    finally { setLoading(false); }
  }, [query]);

  const loadDetail = useCallback(async (id: string) => {
    if (detail?.itemId === id) { setDetail(null); return; }
    try { const r = await fetch(`/api/item-detail?itemId=${id}`); setDetail(await r.json()); } catch {}
  }, [detail]);

  const loadNewItemDetail = useCallback(async (id: string) => {
    if (newItemDetail?.itemId === id) { setNewItemDetail(null); return; }
    try { const r = await fetch(`/api/item-detail?itemId=${id}`); setNewItemDetail(await r.json()); } catch {}
  }, [newItemDetail]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>던파 전체 아이템의 상세 스펙을 조회합니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading} placeholder="아이템 이름 (예: 닳아버린 순례의 증표, 광휘의 소울...)" buttonLabel="아이템 검색" />
      </Card>

      {/* ═══ 천해천 신규 아이템 섹션 ═══ */}
      {!searched && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "20px 18px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,119,6,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, position: "relative" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🌊</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>천해천 신규 아이템</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>Lv.115 서약 · 결정 아이템</div>
            </div>
            <div style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", fontSize: 10, fontWeight: 700, color: "#C084FC", letterSpacing: "0.02em" }}>NEW</div>
          </div>
          {newItemsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}</div>
          ) : newItems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {newItems.map((item: any) => (
                <div key={item.itemId}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "var(--bg-primary)", border: "1px solid var(--border-color)", cursor: "pointer", transition: "all 0.15s" }}
                    onClick={() => loadNewItemDetail(item.itemId)}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.25)"; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}>
                    <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                      <div style={{ fontSize: 10, color: "#64748B", marginTop: 2, display: "flex", gap: 8 }}><span>Lv.{item.itemAvailableLevel}</span><span style={{ color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span><span>{item.itemType}</span></div>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: `${getRarityColor(item.itemRarity)}18`, color: getRarityColor(item.itemRarity) }}>{item.itemName.includes("서약") ? "서약" : "결정"}</span>
                  </div>
                  {newItemDetail?.itemId === item.itemId && (
                    <div className="animate-slide-up" style={{ marginTop: 4, padding: "14px 16px", borderRadius: 10, background: "var(--color-primary-light)", border: "1px solid rgba(37,99,235,0.2)" }}>
                      <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{newItemDetail.itemName}</span>
                        {newItemDetail.itemExplain && (<div style={{ color: "var(--text-secondary)", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: newItemDetail.itemExplain.replace(/\n/g, "<br/>") }} />)}
                        {newItemDetail.itemFlavorText && (<div style={{ fontStyle: "italic", color: "var(--text-muted)" }}>{newItemDetail.itemFlavorText}</div>)}
                        {newItemDetail.setItemName && (<div style={{ fontSize: 10, color: "var(--color-primary)" }}>세트: {newItemDetail.setItemName}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (<div style={{ padding: "24px 0", textAlign: "center" }}><p style={{ fontSize: 12, color: "#475569" }}>해당 아이템을 찾을 수 없습니다.</p></div>)}
          {newItems.length > 0 && (<p style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", margin: "12px 0 0" }}>아이템을 클릭하면 상세 정보를 확인할 수 있습니다 · 총 {newItems.length}건</p>)}
        </div>
      )}

      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{results.length}건</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((item: any) => (
              <div key={item.itemId}>
                <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, fontSize: 12, cursor: "pointer" }} onClick={() => loadDetail(item.itemId)}>
                  <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Lv.{item.itemAvailableLevel} · {item.itemType}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: `${getRarityColor(item.itemRarity)}10`, color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span>
                </div>
                {detail?.itemId === item.itemId && (
                  <div className="card animate-slide-up" style={{ marginTop: 4, padding: "14px 16px", borderColor: "var(--color-primary)", background: "var(--color-surface)" }}>
                    <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{detail.itemName}</span>
                      {detail.itemExplain && <div style={{ color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: detail.itemExplain.replace(/\n/g, "<br/>") }} />}
                      {detail.itemFlavorText && <div style={{ fontStyle: "italic", color: "var(--text-muted)" }}>{detail.itemFlavorText}</div>}
                      {detail.setItemName && <div style={{ fontSize: 10, color: "var(--color-primary)" }}>세트: {detail.setItemName}</div>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && searched && !results.length && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}