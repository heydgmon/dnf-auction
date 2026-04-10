"use client";

import { useState, useEffect } from "react";
import { getRarityColor, formatGold } from "@/lib/utils";
import { Card, ItemImg, SkeletonList, Empty } from "@/components/shared";

interface BisItem { itemName: string; itemId: string; itemRarity: string; avgPrice: number; lowestPrice: number | null; tradeCount: number; totalValue: number; source: string; }
interface BisCategory { category: string; emoji: string; items: BisItem[]; }

// ── 클라이언트 캐시: 탭 전환 시 즉시 표시 ──
let clientCache: { categories: BisCategory[]; fetchedAt: number } | null = null;
const CLIENT_CACHE_TTL = 3 * 60 * 1000;

export default function BisClient() {
  const [categories, setCategories] = useState<BisCategory[]>(clientCache?.categories || []);
  const [loading, setLoading] = useState(!clientCache);

  useEffect(() => {
    if (clientCache && Date.now() - clientCache.fetchedAt < CLIENT_CACHE_TTL) {
      setCategories(clientCache.categories);
      setLoading(false);
      return;
    }

    fetch("/api/bis")
      .then(r => r.json())
      .then(d => {
        const cats = d.categories || [];
        setCategories(cats);
        clientCache = { categories: cats, fetchedAt: Date.now() };
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loading && <SkeletonList count={8} />}

      {!loading && categories.map((cat) => (
        <section key={cat.category}>
          <div className="section-title" style={{ marginBottom: 10 }}>
            <span>{cat.emoji}</span> {cat.category}
          </div>
          {cat.items.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>최근 거래 내역이 없습니다</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {cat.items.map((item, idx) => (
              <div key={item.itemName} className="card" style={{ padding: "14px 16px", borderColor: idx === 0 ? "#FFD70040" : undefined }}>
                {idx === 0 && <div style={{ fontSize: 9, fontWeight: 700, color: "#B8860B", marginBottom: 6 }}>👑 1위</div>}
                {idx === 1 && <div style={{ fontSize: 9, fontWeight: 700, color: "#808080", marginBottom: 6 }}>🥈 2위</div>}
                {idx === 2 && <div style={{ fontSize: 9, fontWeight: 700, color: "#CD7F32", marginBottom: 6 }}>🥉 3위</div>}
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
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.lowestPrice ? "var(--color-primary)" : "var(--text-muted)" }}>
                      {item.lowestPrice ? formatGold(item.lowestPrice) : "매물 없음"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {!loading && categories.length === 0 && <Empty msg="종결템 데이터를 불러오는 중입니다." />}
    </div>
  );
}