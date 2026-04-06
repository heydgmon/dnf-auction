import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "던프 | 던파 경매장 시세 검색 — 아이템 최저가 한눈에",
  description: "던전앤파이터 경매장 인기 아이템 TOP 20. 실시간 경매장 등록 매물 랭킹, 최저가 시세, 가격 알림까지 한눈에 확인하세요.",
};

export default function HomePage() {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          던전앤파이터 경매장 인기 아이템
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          현재 경매장에 등록된 매물이 많은 아이템 순위입니다. 실시간 Neople Open API 데이터를 기반으로 경매장 등록 현황을 확인할 수 있습니다.
        </p>
      </section>
      <HomeClient />
    </>
  );
}