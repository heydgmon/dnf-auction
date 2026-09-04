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

const BIS_DETAIL_GUIDE_SECTIONS = [
  {
    num: "1",
    title: "종결템 구매 타이밍",
    subtitle: "언제 사고 언제 팔아야 하나",
    tips: [
      {
        text: "종결템은 타이밍에 따라 수억 골드가 왔다 갔다 합니다.",
        sub: "시즌 아이템의 가격 흐름은 비교적 일정한 편입니다. 새 종결템은 출시 직후가 가장 비싸고, 다음 시즌 예고가 뜨는 순간부터 가격이 빠지기 시작합니다.",
      },
      {
        text: "살 때는 시즌 초반, 팔 때는 다음 시즌 예고 전이 기본 원칙입니다.",
        sub: "특히 마법부여 카드는 시즌이 바뀌면 종결이 통째로 바뀌므로, 시즌 끝물에 비싸게 사는 것은 피하는 것이 좋습니다.",
      },
    ],
  },
  {
    num: "2",
    title: "평균가는 이렇게 산출됩니다",
    subtitle: "이상치를 제거한 평균",
    tips: [
      {
        text: "극단적으로 높거나 낮은 거래는 평균을 왜곡합니다.",
        sub: "시세를 띄우려는 의도적인 등록이나, 자릿수를 잘못 입력한 오등록이 대표적입니다. 던프라이스는 이런 거래가 평균에 섞이지 않도록, 중앙값을 기준으로 위아래 이상치를 제거한 뒤 평균을 산출합니다. 따라서 이 페이지에 표시되는 평균가는 실제 체감 시세에 더 가깝습니다.",
      },
    ],
  },
  {
    num: "3",
    title: "자주 묻는 질문 (FAQ)",
    tips: [
      {
        text: "Q. 같은 아이템인데 검색하면 가격이 다르게 나옵니다.",
        sub: "크리쳐의 알처럼 레벨 표기가 붙는 아이템은 같은 이름이라도 레벨에 따라 전혀 다른 시세를 가집니다. 정확한 시세를 보려면 레벨 표기까지 포함한 전체 명칭으로 검색해야 합니다.",
      },
      {
        text: "Q. 평균 체결가가 경매장 최저가보다 높은데 어떻게 된 건가요?",
        sub: "최근에 비싸게 팔린 거래는 많은데 지금 막 급매 매물이 올라온 경우입니다. 평균 체결가는 과거 거래 기준, 최저가는 현재 호가 기준이라 이런 역전이 나타날 수 있습니다. 이때는 매물이 빠르게 소진될 가능성이 있으므로 구매 기회로 볼 수 있습니다.",
      },
      {
        text: "Q. 거래량이 적은 종결템은 시세를 믿어도 되나요?",
        sub: "종결템은 단가가 높아 거래 빈도 자체가 낮습니다. 거래 건수가 적은 아이템은 한두 건의 거래에 평균이 크게 흔들릴 수 있으므로, 평균가는 참고하되 현재 경매장 최저가를 함께 확인하는 것이 좋습니다.",
      },
      {
        text: "Q. 표시된 종결템이 실제 종결이 맞나요?",
        sub: "시즌이 지나면 새로운 종결템이 출시되며 기존 아이템은 종결 자리에서 밀려납니다. 이 페이지는 매번 갱신된 데이터를 보여줍니다.",
      },
    ],
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
  "플로럴 스태그 알":
    "공격력 증폭 40% / 버프력 증폭 10% / 모든 속성 강화 40 / 전직별 지정 스킬 +1 / 힘, 지능, 체력, 정신력 150",
  "운명을 담는 재단사 플래티넘[45Lv] 알":
    "공격력 증폭 40% / 버프력 증폭 10% / 45레벨 액티브 스킬 공격력 10% 증가 / 모든 속성 강화 40 / 전직별 지정 스킬 +1 / 힘, 지능, 체력, 정신력 150",
  "운명을 담는 재단사 알":
    "공격력 증폭 40% / 버프력 증폭 10% / 모든 속성 강화 40 / 전직별 지정 스킬 +1 / 힘, 지능, 체력, 정신력 150",

  // 오라
  "열대야의 추억":
    "진각성 패시브 스킬 +1 / 공격력 증폭 +9% / 버프력 증폭 +6% /  모든 속성 강화 +70 / 물리 마법 독립 공격력 +50 / 힘 지능 체력 정신력 +100",
  "고결한 영혼의 잔상 오라 상자":
    "공격력 증폭 +6% / 버프력 증폭 +4% /  모든 속성 강화 +40 / 물리 마법 독립 공격력 +50 / 힘 지능 체력 정신력 +100",
  "초월한 폭풍의 기세 오라 상자":
    "공격력 증폭 +6% / 버프력 증폭 +4% /  모든 속성 강화 +40 / 물리 마법 독립 공격력 +50 / 힘 지능 체력 정신력 +100",

  // 마법부여
  "조율의 감시자 오르테르 카드":
    "피해 증가 +4% / 모든 속성 강화 +15 / 크리 +3%",
  "마법 같은 행운 엘리브 카드":
    "최종 데미지 +3% / 물리 마법 독립 공격력 +110 / 힘 지능 90",
  "진실을 꿰뚫어 보는 자 카드":
    "힘 지능 체력 정신력 +120 모든 속성 강화 +35",
};

function BisGuide() {
  return (
    <Card style={{ marginTop: 8 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>
        <span></span> 종결템 시세는 어떻게 봐야 하나
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

function BisDetailGuide() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {BIS_DETAIL_GUIDE_SECTIONS.map((section) => (
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
      <BisDetailGuide />
    </div>
  );
}
