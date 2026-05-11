"use client";

import { useState, useEffect } from "react";
import { getRarityColor, formatGold } from "@/lib/utils";
import { Card, ItemImg, SkeletonList, Empty } from "@/components/shared";

interface BisItem { itemName: string; itemId: string; itemRarity: string; avgPrice: number; lowestPrice: number | null; tradeCount: number; totalValue: number; source: string; }
interface BisCategory { category: string; emoji: string; items: BisItem[]; }

let clientCache: { categories: BisCategory[]; fetchedAt: number } | null = null;
const CLIENT_CACHE_TTL = 3 * 60 * 1000;
const detailCache = new Map<string, any>();

function cleanHtml(raw: string): string[] {
  return (raw || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").split("\n").map(l => l.trim()).filter(Boolean);
}

/* ── 카드 아래 스펙 텍스트 ── */
function ItemSpec({ itemId }: { itemId: string }) {
  const [detail, setDetail] = useState<any>(detailCache.get(itemId) || null);
  const [loading, setLoading] = useState(!detailCache.has(itemId));

  useEffect(() => {
    if (!itemId || detailCache.has(itemId)) { setLoading(false); return; }
    fetch(`/api/item-detail?itemId=${encodeURIComponent(itemId)}`)
      .then(r => r.json())
      .then(d => { if (!d.error) { detailCache.set(itemId, d); setDetail(d); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [itemId]);

  if (loading) return <div className="skeleton" style={{ height: 32, borderRadius: 6, marginTop: 10 }} />;
  if (!detail) return null;

  const lines = cleanHtml(detail.itemExplain);
  const growOpts = (detail.growInfo?.options || []).slice(0, 6);
  const flavor = cleanHtml(detail.itemFlavorText);
  if (lines.length === 0 && growOpts.length === 0) return null;

  return (
    <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7 }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          color: /[+-]?\d+(\.\d+)?%/.test(line) ? "var(--text-primary)" : undefined,
          fontWeight: /[+-]?\d+(\.\d+)?%/.test(line) ? 500 : undefined,
        }}>{line}</div>
      ))}
      {growOpts.map((opt: any, i: number) => {
        const desc = (opt.explainDetail || opt.explain || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").trim();
        return desc ? <div key={`g${i}`}>
          {opt.level > 0 && <span style={{ color: "var(--color-accent)", fontWeight: 500 }}>Lv.{opt.level} </span>}{desc}
        </div> : null;
      })}
      {flavor.length > 0 && <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--color-accent)", opacity: 0.7 }}>{flavor.join(" ")}</div>}
    </div>
  );
}

export default function BisClient() {
  const [categories, setCategories] = useState<BisCategory[]>(clientCache?.categories || []);
  const [loading, setLoading] = useState(!clientCache);

  useEffect(() => {
    if (clientCache && Date.now() - clientCache.fetchedAt < CLIENT_CACHE_TTL) {
      setCategories(clientCache.categories); setLoading(false); return;
    }
    fetch("/api/bis").then(r => r.json()).then(d => {
      const cats = d.categories || [];
      setCategories(cats);
      clientCache = { categories: cats, fetchedAt: Date.now() };
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loading && <SkeletonList count={8} />}
      {!loading && categories.map((cat) => (
        <section key={cat.category}>
          <div className="section-title" style={{ marginBottom: 10 }}><span>{cat.emoji}</span> {cat.category}</div>
          {cat.items.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>최근 거래 내역이 없습니다</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {cat.items.map((item, idx) => (
              <div key={item.itemName} className="card" style={{ padding: "14px 16px", borderColor: idx === 0 ? "#FFD70040" : undefined }}>
                {idx === 0 && <div style={{ fontSize: 9, fontWeight: 700, color: "#B8860B", marginBottom: 6 }}> 1위</div>}
                {idx === 1 && <div style={{ fontSize: 9, fontWeight: 700, color: "#808080", marginBottom: 6 }}> 2위</div>}
                {idx === 2 && <div style={{ fontSize: 9, fontWeight: 700, color: "#CD7F32", marginBottom: 6 }}> 3위</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{item.itemRarity}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1, padding: "8px 10px", borderRadius: 6, background: "var(--bg-primary)" }}>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>{item.source === "시세" ? "평균 체결가" : "경매장 가격"}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-accent-dim)" }}>{formatGold(item.avgPrice)}</div>
                  </div>
                  <div style={{ flex: 1, padding: "8px 10px", borderRadius: 6, background: "var(--bg-primary)" }}>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>경매장 최저가</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.lowestPrice ? "var(--color-primary)" : "var(--text-muted)" }}>{item.lowestPrice ? formatGold(item.lowestPrice) : "매물 없음"}</div>
                  </div>
                </div>
                {item.itemId && <ItemSpec itemId={item.itemId} />}
              </div>
            ))}
          </div>
        </section>
      ))}
      {!loading && categories.length === 0 && <Empty msg="종결템 데이터를 불러오는 중입니다." />}
    </div>
  );
}