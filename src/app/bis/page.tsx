import type { Metadata } from "next";
import BisClient from "./BisClient";

export const metadata: Metadata = {
  title: "종결템 시세 — 던프 | 던파 칭호·크리쳐·오라·카드 시세",
  description: "던전앤파이터 종결템 시세를 확인하세요. 칭호, 크리쳐, 오라, 마법부여(카드) 카테고리별 거래 규모 Top 3 아이템의 평균 체결가와 경매장 최저가를 비교합니다.",
};

export default function BisPage() {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>종결템 시세</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          카테고리별 거래 규모 Top 3 아이템의 평균 체결가와 경매장 최저가를 비교합니다. 이상치 자동 제거 적용.
        </p>
      </section>
      <BisClient />
    </>
  );
}