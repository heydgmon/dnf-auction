import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소개 — 던파 경매장",
  description: "던파 경매장 시세 알림 & 아이템 검색 서비스 소개",
};

export default function AboutPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>소개</h1>
      <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 32 }}>About this service</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>dnfprice란?</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          dnfprice는 던전앤파이터(Dungeon & Fighter) 플레이어를 위한 경매장 시세 알림 및 아이템 검색 서비스입니다.
          Neople Open API를 활용하여 실시간 경매장 등록 아이템 검색, 최근 거래 시세 조회, 목표 가격 도달 시 이메일 알림 등의 기능을 제공합니다.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>주요 기능</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          시세 알림 — 원하는 아이템의 목표 가격을 설정하면, 해당 가격에 도달했을 때 이메일로 알려드립니다. 로그인 없이 이메일만으로 등록할 수 있으며, 1회 발송 후 자동으로 종료됩니다.
        </p>
        <p style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
          경매장 검색 — 현재 경매장에 등록된 아이템을 검색하고 개당 가격, 강화 수치, 업그레이드 단계 등 상세 정보를 확인할 수 있습니다.
        </p>
        <p style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
          시세 조회 — 최근 거래 완료된 아이템의 실제 거래 가격을 확인하여 적정 매매 가격을 판단할 수 있습니다.
        </p>
        <p style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
          아이템 DB — 던전앤파이터의 전체 아이템 상세 스펙(레벨, 등급, 효과, 세트 정보 등)을 조회할 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>데이터 출처</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 서비스의 모든 게임 데이터는 Neople Open API를 통해 제공됩니다. 본 서비스는 Neople 또는 Nexon과 제휴하거나 보증받은 서비스가 아닙니다.
          던전앤파이터 및 관련 상표는 Neople Inc.와 Nexon Korea Corporation의 자산입니다.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>운영자</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 서비스는 던전앤파이터를 즐기는 개인 개발자가 운영하고 있습니다.
          서비스 관련 문의는 <a href="/contact" style={{ color: "#2563EB", textDecoration: "underline" }}>문의 페이지</a>를 이용해주세요.
        </p>
      </section>
    </main>
  );
}