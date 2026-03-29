import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 — 던프",
  description: "던프 이용약관",
};

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>이용약관</h1>
      <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 32 }}>Terms of Service · 최종 수정: 2026년 3월 28일</p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>제1조 (목적)</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 약관은 던프(이하 "서비스")의 이용과 관련하여 서비스 운영자와 이용자 간의 권리, 의무 및 기타 필요한 사항을 규정함을 목적으로 합니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>제2조 (서비스의 내용)</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 서비스는 던전앤파이터 경매장 아이템 검색, 시세 조회, 가격 알림 기능을 제공합니다.
          모든 게임 데이터는 Neople Open API를 통해 제공되며, 데이터의 정확성은 API 제공자의 정책에 따릅니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>제3조 (서비스 이용)</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 서비스는 별도의 회원가입 없이 누구나 무료로 이용할 수 있습니다.
          시세 알림 기능 이용 시 이메일 주소 입력이 필요하며, 이메일당 최대 3개의 알림을 등록할 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>제4조 (면책사항)</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 서비스는 Neople Open API에서 제공하는 데이터를 기반으로 하며, 게임 내 실제 경매장 가격과 차이가 발생할 수 있습니다.
          등록 매물이 많은 아이템의 경우 API 조회 한계로 인해 일부 매물만 표시될 수 있으며, 이로 인한 가격 차이에 대해 서비스 운영자는 책임을 지지 않습니다.
        </p>
        <p style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
          본 서비스에서 제공하는 정보는 참고 목적으로만 사용되어야 하며, 게임 내 거래에 대한 최종 판단은 이용자 본인에게 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>제5조 (서비스의 변경 및 중단)</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          서비스 운영자는 운영상 필요한 경우 서비스의 내용을 변경하거나 중단할 수 있습니다.
          Neople Open API의 정책 변경, 서비스 종료 등 외부 요인으로 인해 서비스가 제한되거나 중단될 수 있으며, 이에 대해 사전 고지가 불가능한 경우가 있을 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>제6조 (금지행위)</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          이용자는 본 서비스를 이용하여 다음 행위를 해서는 안 됩니다:
          자동화된 도구를 이용한 과도한 API 호출, 서비스의 정상적인 운영을 방해하는 행위,
          타인의 이메일 주소를 도용하여 알림을 등록하는 행위, 기타 관련 법령에 위반되는 행위.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>제7조 (지적재산권)</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          던전앤파이터 및 관련 상표, 게임 데이터는 Neople Inc.와 Nexon Korea Corporation의 자산입니다.
          본 서비스는 Neople 또는 Nexon과 제휴하거나 보증받은 서비스가 아닙니다.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>제8조 (약관의 변경)</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 약관은 서비스 운영 상황에 따라 변경될 수 있으며, 변경 시 본 페이지를 통해 공지합니다.
          변경된 약관에 동의하지 않는 경우 서비스 이용을 중단할 수 있습니다.
        </p>
      </section>
    </main>
  );
}