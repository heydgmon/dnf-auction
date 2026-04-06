import type { Metadata } from "next";
import InsightClient from "./InsightClient";

export const metadata: Metadata = {
  title: "경매장 인사이트 — 던프 | 던파 시세 분석 · 거래량 · 가격 변동",
  description: "던전앤파이터 경매장 주요 아이템의 거래 규모, 시세 추이, 가격 변동률을 한눈에 확인하세요. 강화권, 증폭권, 카드, 패키지 등 인기 아이템의 실체결 데이터를 분석합니다.",
};

export default function InsightPage() {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>경매장 인사이트</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          주요 아이템의 거래 규모, 시세 추이, 가격 변동률을 한눈에 확인합니다. 강화권·증폭권·카드·패키지 등 거래가 활발한 아이템의 시장 동향을 파악할 수 있습니다.
        </p>
      </section>
      <InsightClient />
    </>
  );
}