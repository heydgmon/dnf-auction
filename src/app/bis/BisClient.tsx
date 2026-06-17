"use client";

import { useState, useEffect } from "react";
import { getRarityColor, formatGold } from "@/lib/utils";
import { Card, ItemImg, SkeletonList, Empty } from "@/components/shared";

interface BisItem { itemName: string; itemId: string; itemRarity: string; avgPrice: number; lowestPrice: number | null; tradeCount: number; totalValue: number; source: string; }
interface BisCategory { category: string; emoji: string; items: BisItem[]; }

let clientCache: { categories: BisCategory[]; fetchedAt: number } | null = null;
const CLIENT_CACHE_TTL = 3 * 60 * 1000;

const BIS_GUIDE_ITEMS = [
  {
    title: "칭호",
    desc: "데미지와 스킬 레벨을 동시에 올려주는 핵심 부위입니다. 시즌 한정으로 풀리는 플래티넘 등급이 보통 종결로 취급됩니다.",
  },
  {
    title: "크리쳐",
    desc: "알 형태로 거래되며, 레벨 표기(예: 75Lv/45Lv)에 따라 성능과 가격이 크게 갈립니다. 같은 이름이라도 레벨에 따라 시세 차이가 크니 정확한 명칭으로 검색하세요.",
  },
  {
    title: "오라",
    desc: "시즌마다 새 오라가 나오며, 칭호나 크리쳐보다는 가성비가 떨어지는 편입니다.",
  },
  {
    title: "마법부여(카드)",
    desc: "시즌마다 종결이 리셋되는 부위라 시세 변동이 가장 큽니다. 한 시즌에 수억 골드였던 카드가 다음 시즌엔 폭락하는 일이 흔하므로, 장기 보유보다 필요할 때 구매를 권합니다.",
  },
];

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
    "진각성 패시브 스킬 +1 / 공격력 증폭 +9% / 버프력 증폭 +6% /  모든 속성 강화 +70 / 물리 마법 독립 공격력 +50 / 힘 지능 체력 정신력 +100",
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

function BisGuide() {
  return (
    <Card style={{ marginTop: 8 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>
        <span>📌</span> 종결템 시세는 어떻게 봐야 하나
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 14 }}>
        종결템은 해당 부위에서 더 올라갈 곳이 없는 최상위 아이템을 말합니다. 던파에서 종결템은 크게 칭호, 크리쳐, 오라, 마법부여(카드) 네 갈래로 나뉘며, 이 페이지는 각 카테고리에서 거래 규모가 큰 상위 아이템의 평균 체결가와 현재 경매장 최저가를 함께 보여줍니다.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>평균 체결가</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-accent-dim)", marginBottom: 4 }}>실제로 팔린 값</div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>거래 내역을 기준으로 한 체감 시세입니다.</p>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>경매장 최저가</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-primary)", marginBottom: 4 }}>지금 사면 내야 하는 값</div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>현재 등록 매물 기준의 즉시 구매 가격입니다.</p>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 14 }}>
        두 가격이 비슷하면 시세가 안정적이라는 뜻이고, 최저가가 평균보다 크게 낮으면 급매가 나왔거나 시세가 하락 중일 수 있습니다. 반대로 최저가가 평균보다 높으면 매물이 마르고 있다는 신호입니다.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 14 }}>
        {BIS_GUIDE_ITEMS.map((item) => (
          <div key={item.title} style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-card-hover)", borderLeft: "3px solid var(--color-primary)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>{item.title}</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.65 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--color-accent-light)", border: "1px solid rgba(217, 119, 6, 0.25)" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-accent-dim)", marginBottom: 4 }}>평균가 산출 방식</div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.65 }}>
          극단적으로 높거나 낮은 거래(시세 조작성 등록, 오등록 등)는 평균을 왜곡하므로, 중앙값 기준으로 이상치를 제거한 뒤 평균을 냅니다. 따라서 여기 표시되는 평균가는 실제 체감 시세에 가깝습니다.
        </p>
      </div>
    </Card>
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
      <BisGuide />
    </div>
  );
}
