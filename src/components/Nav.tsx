"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "메인" },
  { href: "/bis", label: "종결템" },
  { href: "/insight", label: "인사이트" },
  { href: "/alerts", label: "알림" },
  { href: "/auction", label: "경매장" },
  { href: "/sold", label: "시세" },
  { href: "/items", label: "아이템 DB" },
  { href: "/setitems", label: "세트 아이템" },
  { href: "/guide", label: "던린이 가이드" },
];

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>D</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>던프</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>시세 알림 & 아이템 검색</div>
          </div>
        </Link>
        <nav className="hidden md:flex" style={{ gap: 4 }}>
          {NAV_ITEMS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`nav-tab ${pathname === t.href ? "active" : ""}`}
              style={{
                textDecoration: "none",
                ...(t.href === "/guide" && pathname !== t.href ? {
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent-light)",
                } : {}),
              }}
            >
              {t.href === "/guide" ? "🎮 " : ""}{t.label}
            </Link>
          ))}
        </nav>
        <div className="md:hidden relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer" }}>메뉴 ▾</button>
          {menuOpen && (
            <div className="animate-slide-down" style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", minWidth: 160, zIndex: 50, padding: "4px 0" }}>
              {NAV_ITEMS.map((t) => (
                <Link key={t.href} href={t.href} onClick={() => setMenuOpen(false)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 12, textDecoration: "none", color: pathname === t.href ? "var(--color-primary)" : t.href === "/guide" ? "var(--color-accent)" : "var(--text-secondary)", background: pathname === t.href ? "var(--color-primary-light)" : "transparent" }}>
                  {t.href === "/guide" ? "🎮 " : ""}{t.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={{ padding: "20px 16px", textAlign: "center", fontSize: 10, color: "var(--text-muted)" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 8 }}>
        <Link href="/about" style={{ color: "var(--text-muted)", textDecoration: "none" }}>소개</Link>
        <Link href="/privacy" style={{ color: "var(--text-muted)", textDecoration: "none" }}>개인정보 처리방침</Link>
        <Link href="/terms" style={{ color: "var(--text-muted)", textDecoration: "none" }}>이용약관</Link>
        <Link href="/contact" style={{ color: "var(--text-muted)", textDecoration: "none" }}>문의</Link>
        <a href="https://developers.neople.co.kr/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Neople Open API</a>
      </div>
      <p>Data provided by Neople Open API · Not affiliated with Neople or Nexon</p>
    </footer>
  );
}