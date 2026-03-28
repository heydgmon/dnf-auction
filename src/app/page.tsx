"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  AuctionItem, AuctionSearchResponse,
  AuctionSoldItem, AuctionSoldResponse, PopularItem,
  AlertRule, AlertRegisterResponse, AlertListResponse,
  SetItemResult, SetItemSearchResponse,
  ItemSearchResult, ItemSearchResponse,
} from "@/lib/types";
import { getRarityColor, getRarityBg, formatGold, formatFullGold, validateEmail, formatDate } from "@/lib/utils";

type Page = "alerts" | "auction" | "auction-sold" |  "items" | "setitems";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "alerts", label: "알림" },
  { id: "auction", label: "경매장" },
  { id: "auction-sold", label: "시세" },
  { id: "items", label: "아이템 DB" },
  { id: "setitems", label: "세트 아이템" },
];

function itemImageUrl(id: string) { return `https://img-api.neople.co.kr/df/items/${id}`; }

function extractRows(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.items)) return json.items;
  if (typeof json === "object") {
    for (const k of Object.keys(json)) { if (Array.isArray(json[k])) return json[k]; }
  }
  return [];
}

/* ─── 최근 검색 (클라이언트 메모리, 세션 단위) ─── */
let recentSearches: string[] = [];
function addRecent(name: string) {
  recentSearches = [name, ...recentSearches.filter(n => n !== name)].slice(0, 10);
}
function getRecent() { return recentSearches; }

/* ═══════════════════════════════════════
   ROOT
   ═══════════════════════════════════════ */
export default function Home() {
  const [page, setPage] = useState<Page>("alerts");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setPage("alerts")} style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "none", cursor: "pointer" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>D</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>던파 경매장</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>시세 알림 & 아이템 검색</div>
            </div>
          </button>
          <nav className="hidden md:flex" style={{ gap: 4 }}>
            {NAV_ITEMS.map(t => (
              <button key={t.id} onClick={() => setPage(t.id)} className={`nav-tab ${page === t.id ? "active" : ""}`}>{t.label}</button>
            ))}
          </nav>
          <div className="md:hidden relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer" }}>메뉴 ▾</button>
            {menuOpen && (
              <div className="animate-slide-down" style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", minWidth: 160, zIndex: 50, padding: "4px 0" }}>
                {NAV_ITEMS.map(t => (
                  <button key={t.id} onClick={() => { setPage(t.id); setMenuOpen(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 12, border: "none", cursor: "pointer",
                      color: page === t.id ? "var(--color-primary)" : "var(--text-secondary)",
                      background: page === t.id ? "var(--color-primary-light)" : "transparent" }}>{t.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: 960, margin: "0 auto", width: "100%", padding: "24px 16px" }}>
        {page === "alerts" && <AlertPanel />}
        {page === "auction" && <AuctionSearchPanel />}
        {page === "auction-sold" && <AuctionSoldPanel />}
        {page === "items" && <ItemSearchPanel />}
        {page === "setitems" && <SetItemPanel />}
      </main>

      <footer style={{ padding: "16px 0", textAlign: "center", fontSize: 10, color: "var(--text-muted)" }}>
        Data provided by Neople Open API · Not affiliated with Neople or Nexon
      </footer>
    </div>
  );
}

/* ═══ 공통 컴포넌트 ═══ */
function Card({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="card" style={{ marginBottom: 16, ...s }}>{children}</div>;
}

function Btn({ onClick, loading, disabled, label = "검색", variant = "primary" }: { onClick: () => void; loading: boolean; disabled: boolean; label?: string; variant?: "primary" | "secondary" }) {
  const bg = variant === "primary" ? "var(--color-primary)" : "var(--bg-primary)";
  const color = variant === "primary" ? "#fff" : "var(--text-secondary)";
  const border = variant === "primary" ? "none" : "1px solid var(--border-color)";
  return <button onClick={onClick} disabled={loading || disabled} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: bg, color, border, cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s" }}>{loading ? "검색 중..." : label}</button>;
}

function ItemImg({ itemId, itemName, rarity, size = 32 }: { itemId: string; itemName: string; rarity?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const rc = rarity ? getRarityColor(rarity) : "var(--text-muted)";
  if (!itemId || err) return <div style={{ width: size, height: size, borderRadius: 8, background: `${rc}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: rc, flexShrink: 0 }}>{itemName?.slice(0, 2) || "??"}</div>;
  return <img src={itemImageUrl(itemId)} alt={itemName} width={size} height={size} style={{ borderRadius: 8, flexShrink: 0, objectFit: "contain", background: `${rc}08`, border: `1px solid ${rc}20` }} loading="lazy" onError={() => setErr(true)} />;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div><div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{value}</div></div>;
}
function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: "#FEF2F2", border: "1px solid #FECACA", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 8 }}><span>⚠️</span>{msg}</div>;
}
function SkeletonList({ count }: { count: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[...Array(count)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}</div>;
}
function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: "56px 0", textAlign: "center" }}><p style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg}</p></div>;
}

/* ═══ 인기 검색 아이템 (서버 전체 유저 count 기준) ═══ */
function PopularCards({ items, onSelect }: { items: PopularItem[]; onSelect: (n: string) => void }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
      {items.slice(0, 6).map((item, i) => (
        <div key={item.itemName} className="hot-card" onClick={() => onSelect(item.itemName)}>
          <div className={`rank-badge ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "topn"}`}>{i + 1}</div>
          <div style={{ paddingLeft: 20, paddingTop: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: item.itemRarity ? getRarityColor(item.itemRarity) : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{item.itemName}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {item.lastPrice ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-accent-dim)" }}>{formatGold(item.lastPrice)}</span> : <span />}
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.searchCount}회</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ 최근 검색 (클라이언트 세션) ═══ */
function RecentTags({ onSelect }: { onSelect: (n: string) => void }) {
  const items = getRecent();
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map(name => (
        <button key={name} className="recent-tag" onClick={() => onSelect(name)}>{name}</button>
      ))}
    </div>
  );
}

/* ═══ 자동완성 — /api/auction + wordType=full ═══ */
function AutocompleteSearch({ query, setQuery, onSearch, loading, placeholder, buttonLabel = "검색" }: {
  query: string; setQuery: (v: string) => void; onSearch: () => void; loading: boolean; placeholder: string; buttonLabel?: string;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skip = useRef(false);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    const t = query.trim();
    if (t.length < 1) { setSuggestions([]); setShowDrop(false); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        // limit=400 (API 최대) → 검색어 포함 아이템을 최대한 많이 수집
        const res = await fetch(`/api/auction?itemName=${encodeURIComponent(t)}&wordType=full&limit=400`, { signal: ctrl.signal });
        if (!res.ok) { setSuggestions([]); setShowDrop(false); return; }
        const rows = extractRows(await res.json());

        // 검색어가 아이템 이름에 포함된 것만 필터 (엉뚱한 아이템 제거)
        const q = t.toLowerCase();
        const matched = rows.filter((r: any) => r.itemName && r.itemName.toLowerCase().includes(q));

        // 아이템 이름 기준 중복 제거 (강화 수치 무관하게 이름만)
        // → 자동완성은 "어떤 아이템이 있는지" 보여주는 역할
        // → 강화/제련 수치는 검색 결과에서 확인
        const nameMap = new Map<string, any>();
        for (const r of matched) {
          const n = r.itemName || "";
          if (n && !nameMap.has(n)) {
            nameMap.set(n, r);
          } else if (n && nameMap.has(n)) {
            // 같은 이름이면 최저가로 업데이트
            const existing = nameMap.get(n)!;
            if ((r.unitPrice || Infinity) < (existing.unitPrice || Infinity)) {
              nameMap.set(n, r);
            }
          }
        }

        const uniq = [...nameMap.values()];
        uniq.sort((a: any, b: any) => (a.unitPrice || 0) - (b.unitPrice || 0));
        setSuggestions(uniq.slice(0, 15));
        setShowDrop(uniq.length > 0);
      } catch (e: any) { if (e.name !== "AbortError") { setSuggestions([]); setShowDrop(false); } }
    }, 400);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  const pick = (n: string) => { skip.current = true; setQuery(n); setShowDrop(false); };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { setShowDrop(false); onSearch(); } }}
          onFocus={() => { if (suggestions.length > 0) setShowDrop(true); }}
          placeholder={placeholder} className="input-base" style={{ flex: 1 }} />
        {buttonLabel && <Btn onClick={() => { setShowDrop(false); onSearch(); }} loading={loading} disabled={!query.trim()} label={buttonLabel} />}
      </div>
      {showDrop && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map((item: any, i: number) => {
            const name = item.itemName || ""; const id = item.itemId || ""; const rarity = item.itemRarity || "";
            return (
              <div key={`${id || name}-${i}`} className="autocomplete-item" onMouseDown={e => { e.preventDefault(); pick(name); }}>
                {id && <ItemImg itemId={id} itemName={name} rarity={rarity} size={28} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: rarity ? getRarityColor(rarity) : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.itemAvailableLevel !== undefined && `Lv.${item.itemAvailableLevel}`}{item.itemType && ` · ${item.itemType}`}{rarity && ` · ${rarity}`}</div>
                </div>
                {item.unitPrice !== undefined && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>최저 {formatGold(item.unitPrice)}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ 각 탭 하단 공통: 인기 + 최근 ═══ */
function SearchHelpers({ popular, onSelect }: { popular: PopularItem[]; onSelect: (n: string) => void }) {
  const [, forceUpdate] = useState(0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
      {getRecent().length > 0 && (
        <section>
          <div className="section-title">🕐 최근 검색</div>
          <RecentTags onSelect={n => { onSelect(n); forceUpdate(v => v + 1); }} />
        </section>
      )}
      {popular.length > 0 && (
        <section>
          <div className="section-title">🔥 인기 검색 아이템</div>
          <PopularCards items={popular} onSelect={onSelect} />
        </section>
      )}
    </div>
  );
}

/* ═══ 알림 ═══ */
function AlertPanel() {
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [alertEmail, setAlertEmail] = useState(""); const [alertItem, setAlertItem] = useState("");
  const [alertPrice, setAlertPrice] = useState(""); const [alertCondition, setAlertCondition] = useState<"below"|"above">("below");
  const [alertMsg, setAlertMsg] = useState(""); const [alertError, setAlertError] = useState(""); const [alertLoading, setAlertLoading] = useState(false);
  const [myEmail, setMyEmail] = useState(""); const [myAlerts, setMyAlerts] = useState<AlertRule[]>([]); const [myAlertsLoading, setMyAlertsLoading] = useState(false);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const register = useCallback(async () => {
    setAlertMsg(""); setAlertError("");
    if (!alertEmail || !alertItem || !alertPrice) { setAlertError("모든 항목을 입력해주세요."); return; }
    if (!validateEmail(alertEmail)) { setAlertError("올바른 이메일 주소를 입력해주세요."); return; }
    setAlertLoading(true);
    try {
      const res = await fetch("/api/alert-register", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: alertEmail, itemName: alertItem.trim(), targetPrice: Number(alertPrice), condition: alertCondition }) });
      const data: AlertRegisterResponse = await res.json();
      if (data.success) { setAlertMsg(data.message); setAlertItem(""); setAlertPrice(""); } else setAlertError(data.message);
    } catch { setAlertError("서버 연결에 실패했습니다."); } finally { setAlertLoading(false); }
  }, [alertEmail, alertItem, alertPrice, alertCondition]);

  const lookup = useCallback(async () => {
    if (!myEmail || !validateEmail(myEmail)) return; setMyAlertsLoading(true);
    try { const r = await fetch(`/api/alert?email=${encodeURIComponent(myEmail)}`); const d: AlertListResponse = await r.json(); setMyAlerts(d.rules || []); }
    catch { setMyAlerts([]); } finally { setMyAlertsLoading(false); }
  }, [myEmail]);

  const del = useCallback(async (id: string) => {
    await fetch("/api/alert", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, email: myEmail }) }); lookup();
  }, [myEmail, lookup]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>🔔 시세 알림 등록</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>목표 가격에 도달하면 이메일로 알려드립니다 · 1회 발송 후 자동 종료</p>
        <div style={{ marginBottom: 12 }}>
          <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="이메일 주소" className="input-base" style={{ marginBottom: 12 }} />
          <AutocompleteSearch query={alertItem} setQuery={setAlertItem} onSearch={() => {}} loading={false} placeholder="아이템 이름 (예: 강화권, 큐브, 토큰...)" buttonLabel="" />
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <select value={alertCondition} onChange={e => setAlertCondition(e.target.value as any)} className="input-base" style={{ width: "auto" }}>
            <option value="below">이하로 떨어지면</option><option value="above">이상으로 오르면</option>
          </select>
          <input type="number" value={alertPrice} onChange={e => setAlertPrice(e.target.value)} placeholder="목표 가격 (골드)" className="input-base" style={{ flex: 1 }} />
          <Btn onClick={register} loading={alertLoading} disabled={false} label="알림 등록" />
        </div>
        {alertMsg && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#F0FDF4", color: "var(--color-success)", border: "1px solid #BBF7D0" }}>{alertMsg}</div>}
        {alertError && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#FEF2F2", color: "var(--color-danger)", border: "1px solid #FECACA" }}>{alertError}</div>}
      </Card>

      <Card>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>내 알림 조회</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input type="email" value={myEmail} onChange={e => setMyEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} placeholder="등록한 이메일" className="input-base" style={{ flex: 1 }} />
          <Btn onClick={lookup} loading={myAlertsLoading} disabled={!myEmail} label="조회" variant="secondary" />
        </div>
        {myAlerts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myAlerts.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", fontSize: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.itemName}</span>
                  <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>{formatGold(a.targetPrice)} {a.condition === "below" ? "이하" : "이상"}</span>
                </div>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600, background: a.fulfilled ? "#F0FDF4" : "var(--color-primary-light)", color: a.fulfilled ? "var(--color-success)" : "var(--color-primary)" }}>{a.fulfilled ? "완료" : "대기중"}</span>
                {!a.fulfilled && <button onClick={() => del(a.id)} style={{ fontSize: 10, color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>삭제</button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {popular.length > 0 && (
        <section>
          <div className="section-title">🔥 인기 검색 아이템</div>
          <PopularCards items={popular} onSelect={n => { setAlertItem(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </section>
      )}
    </div>
  );
}

/* ═══ 경매장 ═══ */
function AuctionSearchPanel() {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return; setLoading(true); setError(""); setSearched(true);
    addRecent(query.trim());
    try {
      const res = await fetch(`/api/auction?itemName=${encodeURIComponent(query.trim())}&wordType=full&limit=400`);
      const data: AuctionSearchResponse = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || `오류`); setResults([]); }
      else {
        const q = query.trim();
        const allRows = [...(data.rows || [])];
        // 1순위: 아이템 이름이 검색어와 정확히 일치
        const exact = allRows.filter(r => r.itemName === q);
        if (exact.length > 0) {
          exact.sort((a, b) => a.unitPrice - b.unitPrice);
          setResults(exact);
        } else {
          // 2순위: 아이템 이름에 검색어가 포함된 것만 (API가 단어 단위로 매칭하므로 관련 없는 결과 제거)
          const contains = allRows.filter(r => r.itemName && r.itemName.includes(q));
          const filtered = contains.length > 0 ? contains : allRows;
          filtered.sort((a, b) => a.unitPrice - b.unitPrice);
          setResults(filtered);
        }
      }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>현재 경매장 등록 아이템을 검색합니다. 개당 가격 낮은 순으로 정렬됩니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading} placeholder="아이템 이름 (예: 토큰, 큐브, 강화권...)" />
      </Card>
      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{results.length}건 · 개당 가격 낮은 순</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{results.map((item, i) => <AuctionRow key={`${item.auctionNo}-${i}`} item={item} />)}</div>
        </div>
      )}
      {!loading && searched && !results.length && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}

function AuctionRow({ item }: { item: AuctionItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ padding: "12px 16px", cursor: "pointer", borderColor: open ? "var(--color-primary)" : undefined, transition: "border-color 0.15s" }} onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.reinforce > 0 && <span style={{ color: "var(--color-accent-dim)" }}>+{item.reinforce} </span>}{item.itemName}
            {item.refine > 0 && <span style={{ marginLeft: 4, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--color-primary-light)", color: "var(--color-primary)" }}>제련 {item.refine}</span>}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 8 }}>
            <span>Lv.{item.itemAvailableLevel}</span><span style={{ color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span><span>{item.itemType}</span>{item.count > 1 && <span>x{item.count}</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-accent-dim)" }}>{formatGold(item.unitPrice)}</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>개당</div>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-color)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          <InfoCell label="총 가격" value={formatFullGold(item.currentPrice)} />
          <InfoCell label="평균 시세" value={formatFullGold(item.averagePrice)} />
          <InfoCell label="등록일" value={formatDate(item.regDate)} />
          <InfoCell label="만료일" value={formatDate(item.expireDate)} />
          {item.amplificationName && <InfoCell label="증폭" value={item.amplificationName} />}
        </div>
      )}
    </div>
  );
}

/* ═══ 시세 ═══ */
function AuctionSoldPanel() {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<AuctionSoldItem[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return; setLoading(true); setError(""); setSearched(true); addRecent(query.trim());
    try {
      const res = await fetch(`/api/auction-sold?itemName=${encodeURIComponent(query.trim())}&wordType=full&limit=400`);
      const data: AuctionSoldResponse = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || "오류"); setResults([]); }
      else {
        const q = query.trim();
        const allRows = [...(data.rows || [])];
        const exact = allRows.filter(r => r.itemName === q);
        if (exact.length > 0) {
          exact.sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""));
          setResults(exact);
        } else {
          const contains = allRows.filter(r => r.itemName && r.itemName.includes(q));
          const filtered = contains.length > 0 ? contains : allRows;
          filtered.sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""));
          setResults(filtered);
        }
      }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card><p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>최근 거래 완료된 아이템의 실제 거래 가격을 확인합니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading} placeholder="아이템 이름 (예: 토큰, 강화권...)" buttonLabel="시세 검색" /></Card>
      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>최근 거래 {results.length}건</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((item, i) => (
              <div key={i} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
                <div style={{ flex: 1, minWidth: 0, fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.reinforce > 0 && <span style={{ color: "var(--color-accent-dim)" }}>+{item.reinforce} </span>}{item.itemName}</div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.count > 1 ? `x${item.count}` : ""}</span>
                <span style={{ fontWeight: 600, color: "var(--color-accent-dim)", width: 64, textAlign: "right" }}>{formatGold(item.unitPrice)}</span>
                <span className="hidden sm:block" style={{ fontSize: 10, color: "var(--text-muted)", width: 100, textAlign: "right" }}>{formatDate(item.soldDate)}</span>
              </div>))}
          </div>
        </div>)}
      {!loading && searched && !results.length && !error && <Empty msg="거래 내역이 없습니다." />}
    </div>
  );
}

/* ═══ 아바타 마켓 ═══ */
function AvatarMarketPanel() {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return; setLoading(true); setError(""); setSearched(true); addRecent(query.trim());
    try {
      // Neople API /df/avatar-market/sale: title 파라미터가 동작하지 않으므로
      // limit=100으로 전체 목록을 가져온 뒤 프론트에서 필터링
      const res = await fetch(`/api/avatar-market?limit=100`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error?.message || `오류 (${res.status})`);
        setResults([]);
      } else {
        const allRows = extractRows(data);
        const q = query.trim().toLowerCase();
        // 제목 또는 해시태그에 검색어가 포함된 상품 필터링
        const filtered = allRows.filter((item: any) => {
          const titleMatch = item.title && item.title.toLowerCase().includes(q);
          const hashMatch = item.hashtag && item.hashtag.some((h: string) => h.toLowerCase().includes(q));
          return titleMatch || hashMatch;
        });
        setResults(filtered);
      }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>아바타 마켓에 등록된 상품을 검색합니다. 현재 판매 중인 아바타 상품의 제목으로 검색하세요.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") search(); }}
            placeholder="아바타 상품 제목 검색 (예: 무기 아바타, 레어, 칭호...)" className="input-base" style={{ flex: 1 }} />
          <Btn onClick={search} loading={loading} disabled={!query.trim()} label="마켓 검색" />
        </div>
      </Card>
      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{results.length}건</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((item: any, i: number) => (
              <div key={i} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{item.sellerName}{item.count > 1 ? ` · x${item.count}` : ""} · {formatDate(item.regDate)}</div>
                </div>
                {item.hashtag && item.hashtag.length > 0 && (
                  <div className="hidden sm:flex" style={{ gap: 4, flexShrink: 0 }}>
                    {item.hashtag.slice(0, 2).map((tag: string) => (
                      <span key={tag} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--color-primary-light)", color: "var(--color-primary)" }}>#{tag}</span>
                    ))}
                  </div>
                )}
                <span style={{ fontWeight: 600, color: "var(--color-accent-dim)", flexShrink: 0 }}>{formatGold(item.price)}</span>
              </div>))}
          </div>
        </div>)}
      {!loading && searched && !results.length && !error && <Empty msg="검색 결과가 없습니다. 현재 판매 등록된 아바타 상품의 제목으로 검색해보세요." />}
    </div>
  );
}

/* ═══ 아이템 DB ═══ */
function ItemSearchPanel() {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]); const [detail, setDetail] = useState<any>(null);
  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return; setLoading(true); setError(""); setSearched(true); setDetail(null); addRecent(query.trim());
    try {
      const res = await fetch(`/api/items?itemName=${encodeURIComponent(query.trim())}&wordType=full&limit=30`);
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || "오류"); setResults([]); }
      else { setResults(extractRows(data)); }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  const loadDetail = useCallback(async (id: string) => {
    if (detail?.itemId === id) { setDetail(null); return; }
    try { const r = await fetch(`/api/item-detail?itemId=${id}`); setDetail(await r.json()); } catch {}
  }, [detail]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>// 변경 후
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>던파 전체 아이템의 상세 정보를 검색합니다. 아이템 설명, 레벨, 등급, 세트 구성 등을 확인할 수 있습니다. 경매장에 등록되지 않은 아이템도 조회 가능합니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading} placeholder="아이템 이름 (예: 무한의정수)" buttonLabel="아이템 검색" /></Card>
      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{results.length}건</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((item: any) => (
              <div key={item.itemId}>
                <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, fontSize: 12, cursor: "pointer" }} onClick={() => loadDetail(item.itemId)}>
                  <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.itemName}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Lv.{item.itemAvailableLevel} · {item.itemType}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 500, background: `${getRarityColor(item.itemRarity)}10`, color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span>
                </div>
                {detail?.itemId === item.itemId && (
                  <div className="card animate-slide-up" style={{ marginTop: 4, padding: "14px 16px", borderColor: "var(--color-primary)", background: "var(--color-surface)" }}>
                    <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{detail.itemName}</span>
                      {detail.itemExplain && <div style={{ color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: detail.itemExplain.replace(/\n/g, "<br/>") }} />}
                      {detail.itemFlavorText && <div style={{ fontStyle: "italic", color: "var(--text-muted)" }}>{detail.itemFlavorText}</div>}
                      {detail.setItemName && <div style={{ fontSize: 10, color: "var(--color-primary)" }}>세트: {detail.setItemName}</div>}
                    </div>
                  </div>)}
              </div>))}
          </div>
        </div>)}
      {!loading && searched && !results.length && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}

/* ═══ 세트 아이템 ═══ */
function SetItemPanel() {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<SetItemResult[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return; setLoading(true); setError(""); setSearched(true); addRecent(query.trim());
    try {
      const res = await fetch(`/api/setitems?setItemName=${encodeURIComponent(query.trim())}&wordType=full&limit=30`);
      const data: SetItemSearchResponse = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || "오류"); setResults([]); }
      else setResults(data.rows || []);
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card><p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>세트 아이템을 이름으로 검색합니다. 세트 효과를 구성하는 장비 조합을 확인하고, 어떤 아이템들이 하나의 세트에 속하는지 찾아볼 수 있습니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading} placeholder="세트 아이템 이름" buttonLabel="세트 검색" /></Card>
      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{results.length}건</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
            {results.map(item => (
              <div key={item.setItemId} className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--color-primary-light)", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>SET</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.setItemName}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>ID: {item.setItemId}</div>
                </div>
              </div>))}
          </div>
        </div>)}
      {!loading && searched && !results.length && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}