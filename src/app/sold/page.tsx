import type { Metadata } from "next";
import SoldClient from "./SoldClient";

export const metadata: Metadata = {
  title: "시세 검색 — 던프 | 던파 경매장 시세 조회 · 거래 내역",
  description: "던전앤파이터 경매장에서 최근 거래 완료된 아이템의 실제 거래 가격을 확인하세요. 일별 시세 차트와 거래량 추이로 적정 매매 가격을 판단할 수 있습니다.",
};

export default function SoldPage() {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>경매장 시세 검색</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          최근 거래 완료된 아이템의 실제 거래 가격을 확인합니다. 일별 평균가 차트와 거래량 추이를 통해 아이템의 시세 흐름을 파악하고, 적정 매매 가격을 판단할 수 있습니다.
        </p>
      </section>
      <SoldClient />
    </>
  );
}