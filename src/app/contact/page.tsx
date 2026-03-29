"use client";

import { useState } from "react";
import type { Metadata } from "next";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // mailto 방식으로 이메일 클라이언트 열기
    const subject = encodeURIComponent(`[던프 문의] ${name}`);
    const body = encodeURIComponent(`이름: ${name}\n이메일: ${email}\n\n${message}`);
    window.location.href = `mailto:rhr2308@gmail.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>문의</h1>
      <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 32 }}>Contact Us</p>

      <p style={{ fontSize: 14, color: "#475569", marginBottom: 24 }}>
        서비스 이용 중 불편한 점이나 건의사항이 있으시면 아래 양식을 통해 문의해주세요.
        가능한 빠르게 답변 드리겠습니다.
      </p>

      {submitted ? (
        <div style={{ padding: "24px", borderRadius: 12, background: "#F0FDF4", border: "1px solid #BBF7D0", textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#059669", marginBottom: 8 }}>문의가 접수되었습니다</p>
          <p style={{ fontSize: 13, color: "#475569" }}>이메일 클라이언트에서 메일을 발송해주세요. 빠른 시일 내에 답변 드리겠습니다.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>이름</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="이름을 입력해주세요"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, background: "#fff" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>이메일</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="답변 받으실 이메일 주소"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, background: "#fff" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>문의 내용</label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)} required
              placeholder="문의 내용을 자세히 입력해주세요"
              rows={6}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 13, background: "#fff", resize: "vertical" }}
            />
          </div>
          <button
            type="submit"
            disabled={!name || !email || !message}
            style={{ padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#2563EB", color: "#fff", border: "none", cursor: "pointer", alignSelf: "flex-start", opacity: (!name || !email || !message) ? 0.4 : 1 }}
          >
            문의하기
          </button>
        </form>
      )}

      <div style={{ marginTop: 40, padding: "16px 20px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
        <p style={{ fontSize: 13, color: "#475569" }}>
          이메일로 직접 문의하실 수도 있습니다: <a href="mailto:rhr2308@gmail.com" style={{ color: "#2563EB", textDecoration: "underline" }}>rhr2308@gmail.com</a>
        </p>
      </div>
    </main>
  );
}