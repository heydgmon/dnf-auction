import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침 — 던파 경매장",
  description: "던파 경매장 개인정보 처리방침",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>개인정보 처리방침</h1>
      <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 32 }}>Privacy Policy · 최종 수정: 2026년 3월 28일</p>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>1. 수집하는 개인정보</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 서비스는 시세 알림 기능 이용 시 사용자가 직접 입력한 이메일 주소를 수집합니다.
          그 외 회원가입, 로그인 등의 절차는 없으며 별도의 개인정보를 수집하지 않습니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>2. 개인정보의 이용 목적</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          수집된 이메일 주소는 사용자가 설정한 아이템의 목표 가격 도달 시 알림 이메일을 발송하는 용도로만 사용됩니다.
          마케팅, 광고, 제3자 제공 등의 목적으로는 사용되지 않습니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>3. 개인정보의 보유 및 파기</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          시세 알림이 발송 완료되거나 사용자가 알림을 삭제하면 해당 이메일 정보는 더 이상 사용되지 않습니다.
          주기적으로 완료된 알림 데이터를 정리하며, 사용자는 언제든 알림 조회 기능을 통해 자신의 알림을 삭제할 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>4. 쿠키 및 자동 수집 정보</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 서비스는 자체적으로 쿠키를 사용하지 않습니다. 다만, 서비스 내에 게재되는 Google 애드센스 광고는
          사용자의 관심사에 기반한 광고를 제공하기 위해 쿠키를 사용할 수 있습니다.
          Google의 광고 쿠키 사용에 대한 자세한 내용은{" "}
          <a href="https://policies.google.com/technologies/ads?hl=ko" target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", textDecoration: "underline" }}>
            Google 광고 정책
          </a>
          을 참고해주세요.
        </p>
        <p style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
          사용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며,{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", textDecoration: "underline" }}>
            Google 광고 설정
          </a>
          에서 맞춤 광고를 비활성화할 수 있습니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>5. 제3자 제공</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 서비스는 수집한 개인정보를 제3자에게 제공하지 않습니다.
          다만, 알림 이메일 발송을 위해 이메일 발송 서비스(Resend)를 이용하며, 이 과정에서 이메일 주소가 해당 서비스에 전달됩니다.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>6. 이용자의 권리</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          사용자는 언제든지 자신의 알림 정보를 조회하고 삭제할 수 있습니다.
          개인정보와 관련된 문의사항은{" "}
          <a href="/contact" style={{ color: "#2563EB", textDecoration: "underline" }}>문의 페이지</a>를 통해 연락해주세요.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>7. 개인정보 처리방침의 변경</h2>
        <p style={{ fontSize: 14, color: "#475569" }}>
          본 방침은 서비스 변경 사항에 따라 업데이트될 수 있으며, 변경 시 본 페이지를 통해 공지합니다.
        </p>
      </section>
    </main>
  );
}