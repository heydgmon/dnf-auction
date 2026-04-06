"use client";

import { useState, useEffect } from "react";
import { getRarityColor, formatGold } from "@/lib/utils";
import { ItemImg, SkeletonList, Empty } from "@/components/shared";

interface TrendingItem { itemName: string; auctionCount: number; lowestPrice: number; itemRarity: string; itemId: string; itemType: string; }

export default function HomeClient() {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trending").then(r => r.json()).then(d => setItems(d.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32", "#4A90D9"];

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section>
        <div className="section-title" style={{ marginBottom: 12 }}>경매장 인기 아이템 TOP 20</div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>현재 경매장에 등록된 매물이 많은 순서입니다.</p>
        {loading && <SkeletonList count={8} />}
        {!loading && items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 12 }}>
              {items.slice(0, 4).map((item, i) => (
                <div key={item.itemName} className="card" style={{ padding: 0, overflow: "hidden", border: `2px solid ${medalColors[i]}30`, position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: 36, height: 36, background: medalColors[i], borderRadius: "0 0 12px 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: i === 0 ? "#92400E" : "#fff" }}>{i + 1}</div>
                  <div style={{ padding: "20px 16px 16px", textAlign: "center" }}>
                    <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={48} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: getRarityColor(item.itemRarity), marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{item.itemType}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>등록 매물</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-primary)" }}>{item.auctionCount}건+</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.slice(4, 20).map((item, i) => (
                <div key={item.itemName} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
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
              ))}
            </div>
          </div>
        )}
        {!loading && items.length === 0 && <Empty msg="데이터를 불러오는 중입니다." />}
      </section>
    </div>
  );
}