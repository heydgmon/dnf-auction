import type { Metadata } from "next";
import ItemsClient from "./ItemsClient";

export const metadata: Metadata = {
  title: "아이템 DB — 던프 | 던파 아이템 검색 · 상세 스펙 조회",
  description: "던전앤파이터 전체 아이템의 상세 스펙을 조회합니다. 레벨, 등급, 장비 효과, 세트 정보까지 아이템 이름으로 검색하여 확인할 수 있습니다.",
};

export default function ItemsPage() {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>아이템 DB</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          던전앤파이터의 전체 아이템 상세 스펙을 조회합니다. 아이템 이름으로 검색하면 레벨, 등급(커먼~신화), 장비 효과, 세트 구성 등을 확인할 수 있습니다.
        </p>
      </section>
      <ItemsClient />
    </>
  );
}