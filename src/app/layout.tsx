import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "던파 경매장 — 시세 알림 & 아이템 검색",
  description: "던전앤파이터 경매장 아이템 검색, 시세 조회, 가격 알림 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
