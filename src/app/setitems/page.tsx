import type { Metadata } from "next";
import SetItemsClient from "./SetItemsClient";

export const metadata: Metadata = {
  title: "세트 아이템 — 던프 | 던파 세트 아이템 검색 · 연도별 목록",
  description: "던전앤파이터 세트 아이템을 검색하고 연도별로 확인하세요. 2012년부터 현재까지 추가된 세트 아이템 목록을 한눈에 볼 수 있습니다.",
};

export default function SetItemsPage() {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>세트 아이템</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          던전앤파이터의 세트 아이템을 검색하고 연도별로 확인할 수 있습니다. 2012년부터 현재까지 추가된 세트 아이템 목록을 제공합니다.
        </p>
      </section>
      <SetItemsClient />
    </>
  );
}