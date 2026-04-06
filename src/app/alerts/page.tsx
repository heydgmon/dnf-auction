import type { Metadata } from "next";
import AlertClient from "./AlertClient";

export const metadata: Metadata = {
  title: "시세 알림 — 던프 | 던파 경매장 가격 알림 등록",
  description: "던전앤파이터 경매장 아이템의 목표 가격을 설정하면 이메일로 알려드립니다. 로그인 없이 이메일만으로 알림을 등록할 수 있으며, 1회 발송 후 자동 종료됩니다.",
};

export default function AlertsPage() {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>시세 알림</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          원하는 아이템의 목표 가격을 설정하면, 해당 가격에 도달했을 때 이메일로 알려드립니다. 로그인 없이 이메일만으로 등록할 수 있으며, 1회 발송 후 자동으로 종료됩니다. 이메일당 최대 3개의 알림을 등록할 수 있고, 동일 조건 중복 등록은 방지됩니다.
        </p>
      </section>
      <AlertClient />
    </>
  );
}