import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { Footer } from "@/components/Nav";

export const metadata: Metadata = {
  title: "던프 | 던파 경매장 시세 검색 — 아이템 최저가 한눈에",
  description: "던전앤파이터 경매장 아이템 검색, 시세 조회, 가격 알림 서비스",
  other: {
    "google-adsense-account": "ca-pub-4885821038488108",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4885821038488108"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen">
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "24px 24px" }}>
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}