"use client";

import { useState, useEffect } from "react";
import { getRarityColor, formatGold } from "@/lib/utils";
import { Card, ItemImg, SkeletonList, Empty } from "@/components/shared";

interface BisItem { itemName: string; itemId: string; itemRarity: string; avgPrice: number; lowestPrice: number | null; tradeCount: number; totalValue: number; source: string; }
interface BisCategory { category: string; emoji: string; items: BisItem[]; }

let clientCache: { categories: BisCategory[]; fetchedAt: number } | null = null;
const CLIENT_CACHE_TTL = 3 * 60 * 1000;

/* ── 종결템 스펙 (하드코딩) ── */
const ITEM_SPECS: Record<string, string> = {
  // 칭호
  "천공의 지배자":
    "공격력 증폭 +20% / 버프력 증폭 +2% / 1~95Lv 모든 스킬 Lv +1",
  "프로스트의 전설 플래티넘[100Lv]":
    "공격력 증폭 +20% / 버프력 증폭 +2% / 1~95Lv 모든 스킬 Lv +1 / 100레벨 액티브 스킬 공격력 10% 증가",
  "군자의 사계 플래티넘[30Lv]":
    "공격력 증폭 +20% / 버프력 증폭 +2% / 1~95Lv 모든 스킬 Lv +1 / 30레벨 액티브 스킬 공격력 15% 증가",

  // 크리쳐
  "운명을 담는 재단사 플래티넘[75Lv] 알":
    "공격력 증폭 40% / 버프력 증폭 10% / 75레벨 액티브 스킬 공격력 10% 증가 / 모든 속성 강화 40 / 전직별 지정 스킬 +1 / 힘, 지능, 체력, 정신력 150",
  "운명을 담는 재단사 플래티넘[45Lv] 알":
    "공격력 증폭 40% / 버프력 증폭 10% / 45레벨 액티브 스킬 공격력 10% 증가 / 모든 속성 강화 40 / 전직별 지정 스킬 +1 / 힘, 지능, 체력, 정신력 150",
  "운명을 담는 재단사 알":
    "공격력 증폭 40% / 버프력 증폭 10% / 모든 속성 강화 40 / 전직별 지정 스킬 +1 / 힘, 지능, 체력, 정신력 150",

  // 오라
  "트로피컬 바캉스 오라 상자":
    "공격력 증폭 +6% / 버프력 증폭 +4% /  모든 속성 강화 +40 / 물리 마법 독립 공격력 +50 / 힘 지능 체력 정신력 +100",
  "고결한 영혼의 잔상 오라 상자":
    "공격력 증폭 +6% / 버프력 증폭 +4% /  모든 속성 강화 +40 / 물리 마법 독립 공격력 +50 / 힘 지능 체력 정신력 +100",
  "초월한 폭풍의 기세 오라 상자":
    "공격력 증폭 +6% / 버프력 증폭 +4% /  모든 속성 강화 +40 / 물리 마법 독립 공격력 +50 / 힘 지능 체력 정신력 +100",

  // 마법부여
  "조율의 감시자 오르테르 카드":
    "피해 증가 +4% / 모든 속성 강화 +15 / 크리 +3%",
  "거짓의 베리디쿠스 카드":
    "모든 속성 강화 +45",
  "해방된 비올렌티아 카드":
    "모든 스탯 +190",
};

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
            {cat.items.map((item, idx) => {
              const spec = ITEM_SPECS[item.itemName];
              return (
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
                      <div style={{ fontSize: 15, fontWeight: 800, color: item.lowestPrice ? "var(--color-primary)" : "var(--text-muted)" }}>{item.lowestPrice ? formatGold(item.lowestPrice) : "매물 없음"}</div>
                    </div>
                  </div>
                  {spec && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                      {spec.split(" / ").map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {!loading && categories.length === 0 && <Empty msg="종결템 데이터를 불러오는 중입니다." />}
    </div>
  );
}