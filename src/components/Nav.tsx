"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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

function itemImageUrl(id: string) {
  return `https://img-api.neople.co.kr/df/items/${id}`;
}

function getRarityColorNav(rarity: string): string {
  const map: Record<string, string> = {
    커먼: "#6B7280", 언커먼: "#16A34A", 레어: "#2563EB",
    유니크: "#9333EA", 에픽: "#CA8A04", 크로니클: "#EA580C",
    레전더리: "#DC2626", 신화: "#DB2777",
  };
  return map[rarity] || "var(--text-primary)";
}

function NavItemImg({ itemId, itemName, rarity, size = 24 }: { itemId: string; itemName: string; rarity?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const rc = rarity ? getRarityColorNav(rarity) : "var(--text-muted)";
  if (!itemId || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6,
        background: `${rc}12`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 8, fontWeight: 700, color: rc, flexShrink: 0,
      }}>
        {itemName?.slice(0, 2) || "??"}
      </div>
    );
  }
  return (
    <img
      src={itemImageUrl(itemId)} alt={itemName}
      width={size} height={size}
      style={{ borderRadius: 6, flexShrink: 0, objectFit: "contain", background: `${rc}08`, border: `1px solid ${rc}20` }}
      loading="lazy" onError={() => setErr(true)}
    />
  );
}

/* ══ 자동완성 검색 ══ */
function NavSearch({ onNavigate }: { onNavigate: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef(false);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return; }
    const t = query.trim();
    if (t.length < 1) { setSuggestions([]); setShowDrop(false); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auction?itemName=${encodeURIComponent(t)}&wordType=full&limit=400&sort[unitPrice]=asc`,
          { signal: ctrl.signal }
        );
        if (!res.ok) { setSuggestions([]); setShowDrop(false); return; }
        const data = await res.json();
        const rows: any[] = data.rows || [];
        const tLower = t.toLowerCase();
        const nameMap = new Map<string, any>();
        for (const r of rows) {
          const n = r.itemName || "";
          if (!n || !n.toLowerCase().includes(tLower)) continue;
          if (!nameMap.has(n)) {
            nameMap.set(n, r);
          } else {
            const existing = nameMap.get(n)!;
            if ((r.unitPrice || Infinity) < (existing.unitPrice || Infinity)) nameMap.set(n, r);
          }
        }
        const uniq = [...nameMap.values()].sort((a, b) => (a.unitPrice || 0) - (b.unitPrice || 0));
        setSuggestions(uniq.slice(0, 8));
        setShowDrop(uniq.length > 0);
      } catch (e: any) {
        if (e.name !== "AbortError") { setSuggestions([]); setShowDrop(false); }
      }
    }, 400);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  const pick = (name: string) => {
    skipRef.current = true;
    setQuery("");
    setShowDrop(false);
    onNavigate(name);
  };

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    setShowDrop(false);
    setQuery("");
    onNavigate(q);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
          placeholder="시세 검색"
          style={{
            width: 120,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1.5px solid var(--border-color)",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            fontSize: 12,
            transition: "border-color 0.15s",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim()}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--color-primary)", color: "#fff", border: "none",
            cursor: query.trim() ? "pointer" : "not-allowed",
            opacity: query.trim() ? 1 : 0.4, flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          검색
        </button>
      </div>

      {showDrop && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", right: 0,
          marginTop: 4, zIndex: 100, minWidth: 280,
          background: "var(--bg-secondary)", border: "1px solid var(--border-color)",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          maxHeight: 340, overflowY: "auto",
        }}>
          {suggestions.map((item: any, i: number) => {
            const name = item.itemName || "";
            const id = item.itemId || "";
            const rarity = item.itemRarity || "";
            return (
              <div
                key={`${id || name}-${i}`}
                onMouseDown={e => { e.preventDefault(); pick(name); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", cursor: "pointer", transition: "background 0.1s",
                  borderBottom: i < suggestions.length - 1 ? "1px solid var(--border-color)" : "none",
                }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-primary-light)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <NavItemImg itemId={id} itemName={name} rarity={rarity} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: rarity ? getRarityColorNav(rarity) : "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {item.itemAvailableLevel !== undefined && `Lv.${item.itemAvailableLevel}`}
                    {item.itemType && ` · ${item.itemType}`}
                    {rarity && ` · ${rarity}`}
                  </div>
                </div>
                {item.unitPrice !== undefined && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>
                    {item.unitPrice.toLocaleString()}G
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigate = (itemName: string) => {
    router.push(`/sold?q=${encodeURIComponent(itemName)}`);
  };

  return (
    <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
      {/* 상단: 로고 + 검색 */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>D</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>던프</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>시세 알림 & 아이템 검색</div>
          </div>
        </Link>
        <NavSearch onNavigate={handleNavigate} />
      </div>

      {/* 하단: 탭 (가로 스크롤) */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 8px" }}>
        <nav style={{
          display: "flex", gap: 4, overflowX: "auto",
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}>
          {NAV_ITEMS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`nav-tab ${pathname === t.href ? "active" : ""}`}
              style={{
                textDecoration: "none",
                flexShrink: 0,
                ...(t.href === "/guide" && pathname !== t.href ? {
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent-light)",
                } : {}),
              }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
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