import type { Metadata } from "next";
import AuctionClient from "./AuctionClient";

export const metadata: Metadata = {
  title: "경매장 검색 — 던프 | 던파 경매장 아이템 최저가 검색",
  description: "던전앤파이터 경매장에 등록된 아이템을 검색하고 개당 가격 낮은 순으로 확인하세요. 강화 수치, 증폭, 업그레이드 정보까지 한눈에 비교할 수 있습니다.",
};

export default function AuctionPage() {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>경매장 아이템 검색</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          현재 던전앤파이터 경매장에 등록된 아이템을 검색합니다. 개당 가격이 낮은 순으로 정렬되어 최저가 매물을 빠르게 찾을 수 있습니다. 강화/증폭/제련 수치, 업그레이드 단계 등 상세 정보도 함께 확인할 수 있습니다.
        </p>
      </section>
      <AuctionClient />
    </>
  );
}