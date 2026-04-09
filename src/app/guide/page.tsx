import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "던린이 세팅 가이드 — 던프 | 점핑 캐릭터 초보 가이드",
  description: "던전앤파이터 처음 시작하는 던린이를 위한 세팅 가이드. 로얄패스, 마법부여, 강화, 증폭 우선순위를 알려드립니다.",
};

const SECTIONS = [
  {
    num: "1",
    title: "아라드 로얄 패스를 가장 먼저 사세요",
    color: "#2563EB",
    bgColor: "rgba(37,99,235,0.06)",
    borderColor: "rgba(37,99,235,0.2)",
    tips: [
      {
        text: "아라드 로얄 패스는 29,800원인데 최소 10만원 이상의 가치를 가집니다",
        sub: "100% 10증폭권 2개, 증폭보호권 1개, 순황증 등 포함",
      },
      {
        text: "패스 최종 레벨을 찍으면 종결템 선택권 1개를 줍니다",
        sub: "칭호, 크리쳐, 오라, 클론레어 무기아바타 중 선택",
        children: [
          "시즌마다 달라지므로 가장 최근에 출시된 것 기준으로 받는게 좋습니다.",
          "이건 무조건 크리쳐를 받는게 좋습니다 (재단사 알 크리쳐가 가장 최근 출시)",
        ],
      },
    ],
  },
  {
    num: "2",
    title: "마법부여 카드는 가장 나중에 바르세요",
    color: "#D97706",
    bgColor: "rgba(217,119,6,0.06)",
    borderColor: "rgba(217,119,6,0.2)",
    tips: [
      {
        text: "마법부여 카드는 시즌마다 종결템이 무조건 리셋됩니다",
        sub: "한 장에 1억원 하던것이 다음 시즌엔 상점에서 무료로 팔리거나 100만원 밑으로 떨어질 수 있습니다",
      },
      {
        text: "만약 발라야 한다면 피해증폭 카드부터 추천",
        sub: "예: 선별자 룬디어 카드",
        children: [
          "나머지는 가성비 마부 카드를 바르는게 좋습니다.",
        ],
      },
    ],
  },
  {
    num: "3",
    title: "딜러는 강화/증폭보다 이게 먼저입니다",
    color: "#DC2626",
    bgColor: "rgba(220,38,38,0.06)",
    borderColor: "rgba(220,38,38,0.2)",
    tips: [
      {
        text: "강화와 증폭은 비용 대비 효율이 가장 떨어지므로 제일 나중에 하세요",
        sub: "아래 우선순위를 먼저 챙기세요",
        children: [
          "아바타 딜 플래티넘 엠블렘",
          "짙은 심연의 편린",
          "스위칭 3레벨 칭호",
        ],
      },
    ],
  },
  {
    num: "4",
    title: "버퍼는 증폭 효율이 매우 좋습니다",
    color: "#059669",
    bgColor: "rgba(5,150,105,0.06)",
    borderColor: "rgba(5,150,105,0.2)",
    tips: [
      {
        text: "올 10증폭까지는 강력 추천, 11증폭 이상은 비추",
        sub: "11증폭 이상부터는 비용이 급격히 올라갑니다",
      },
      {
        text: "거지증폭을 활용하세요",
        sub: "물음표(?)가 붙은 아이템은 해체기에 갈지 말고 창고에 보관하세요",
        children: [
          "11증폭 이상 시도할 때 증폭보호권 없이도 가능합니다.",
        ],
      },
      {
        text: "올 8증폭이 가성비 최고",
        sub: "비용 대비 효율이 가장 좋은 구간입니다",
      },
      {
        text: "증폭 시즌에 무조건 하세요!",
        sub: "매년 1월경에 열립니다.방학 이벤트로 한번 더 열수도 있습니다. 이 시기를 절대 놓치지 마세요",
      },
    ],
  },
];

export default function GuidePage() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "0" }}>
      {/* 헤더 */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>던린이 세팅 가이드</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, padding: "12px 16px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, borderLeft: "3px solid var(--color-primary)" }}>
          처음 점핑 캐릭터로 시작했을 때, 세팅을 어떻게 해야 할지 어려움을 가지신 분들을 위한 페이지입니다. 우선순위대로 따라가시면 효율적으로 세팅할 수 있습니다.
        </p>
      </section>

      {/* 섹션 카드들 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {SECTIONS.map((section) => (
          <div
            key={section.num}
            style={{
              background: "var(--bg-card)",
              border: `1px solid ${section.borderColor}`,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {/* 섹션 헤더 */}
            <div style={{
              background: section.bgColor,
              padding: "14px 20px",
              borderBottom: `1px solid ${section.borderColor}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: section.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0,
              }}>
                {section.num}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{section.title}</span>
            </div>

            {/* 팁 목록 */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {section.tips.map((tip, ti) => (
                <div key={ti} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: section.color,
                    flexShrink: 0, marginTop: 6,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.6 }}>{tip.text}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.6 }}>{tip.sub}</div>
                    {tip.children && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                        {tip.children.map((child, ci) => (
                          <div key={ci} style={{
                            display: "flex", gap: 8, alignItems: "flex-start",
                            padding: "7px 12px",
                            background: "var(--bg-primary)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            lineHeight: 1.6,
                          }}>
                            <span style={{ color: section.color, flexShrink: 0, marginTop: 1 }}>→</span>
                            <span>{child}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 하단 안내 */}
      <div style={{
        marginTop: 20,
        padding: "14px 18px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: 12,
        fontSize: 11,
        color: "var(--text-muted)",
        lineHeight: 1.7,
        textAlign: "center",
      }}>
        위 내용은 일반적인 가이드이며, 시즌 패치에 따라 달라질 수 있습니다. 실제 세팅 전에 던파 커뮤니티에서 최신 정보를 확인하세요.
      </div>
    </main>
  );
}