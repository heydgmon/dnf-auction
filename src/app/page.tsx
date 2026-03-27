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

type Page = "alerts" | "auction" | "auction-sold" | "avatar-market" | "items" | "setitems";

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: "alerts", label: "알림", icon: "🔔" },
  { id: "auction", label: "경매장", icon: "🏷️" },
  { id: "auction-sold", label: "시세", icon: "📈" },
  { id: "avatar-market", label: "아바타 마켓", icon: "👤" },
  { id: "items", label: "아이템 DB", icon: "📦" },
  { id: "setitems", label: "세트 아이템", icon: "🧩" },
];

function itemImageUrl(itemId: string): string {
  return `https://img-api.neople.co.kr/df/items/${itemId}`;
}

/* 어떤 응답 구조든 배열 추출 */
function extractRows(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.items)) return json.items;
  if (typeof json === "object") {
    for (const key of Object.keys(json)) {
      if (Array.isArray(json[key])) return json[key];
    }
  }
  return [];
}

export default function Home() {
  const [page, setPage] = useState<Page>("alerts");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setPage("alerts")} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black"
              style={{ background: "var(--color-primary)", color: "#fff" }}>D</div>
            <div className="text-left">
              <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>던파 경매장</div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>시세 알림 & 아이템 검색</div>
            </div>
          </button>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setPage(item.id)}
                className={`nav-tab ${page === item.id ? "active" : ""}`}>{item.label}</button>
            ))}
          </nav>
          <div className="md:hidden relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>메뉴 ▾</button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 rounded-xl shadow-lg z-50 animate-slide-down min-w-[160px]"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                {NAV_ITEMS.map((item) => (
                  <button key={item.id} onClick={() => { setPage(item.id); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-xs transition-colors"
                    style={{ color: page === item.id ? "var(--color-primary)" : "var(--text-secondary)",
                      background: page === item.id ? "var(--color-primary-light)" : "transparent" }}>
                    <span>{item.icon}</span> {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {page === "alerts" && <AlertPanel />}
        {page === "auction" && <AuctionSearchPanel />}
        {page === "auction-sold" && <AuctionSoldPanel />}
        {page === "avatar-market" && <AvatarMarketPanel />}
        {page === "items" && <ItemSearchPanel />}
        {page === "setitems" && <SetItemPanel />}
      </main>
      <footer className="py-4 text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
        Data provided by Neople Open API · Not affiliated with Neople or Nexon
      </footer>
    </div>
  );
}

/* ═══ 공통 컴포넌트 ═══ */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card mb-4 ${className}`}>{children}</div>;
}
function SearchButton({ onClick, loading, disabled, label = "검색" }: { onClick: () => void; loading: boolean; disabled: boolean; label?: string }) {
  return <button onClick={onClick} disabled={loading || disabled} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0"
    style={{ background: "var(--color-primary)", color: "#fff" }}>{loading ? "검색 중..." : label}</button>;
}
function ItemImage({ itemId, itemName, rarity, size = 32 }: { itemId: string; itemName: string; rarity?: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!itemId || err) return (
    <div className="rounded-lg flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
      style={{ width: size, height: size, background: rarity ? `${getRarityColor(rarity)}12` : "var(--bg-primary)", color: rarity ? getRarityColor(rarity) : "var(--text-muted)" }}>
      {itemName?.slice(0, 2) || "??"}</div>
  );
  return <img src={itemImageUrl(itemId)} alt={itemName} width={size} height={size} className="rounded-lg flex-shrink-0 object-contain"
    style={{ background: rarity ? `${getRarityColor(rarity)}08` : "var(--bg-primary)", border: `1px solid ${rarity ? getRarityColor(rarity) + "25" : "var(--border-color)"}` }}
    loading="lazy" onError={() => setErr(true)} />;
}
function InfoCell({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</div><div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{value}</div></div>;
}
function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="card mb-4 text-sm flex items-center gap-2" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "var(--color-danger)" }}><span>⚠️</span> {msg}</div>;
}
function SkeletonList({ count, h }: { count: number; h: number }) {
  return <div className="space-y-2">{[...Array(count)].map((_, i) => <div key={i} className="skeleton w-full" style={{ height: `${h * 4}px` }} />)}</div>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>{msg}</p></div>;
}
function HotItemCards({ items, onSelect }: { items: PopularItem[]; onSelect: (name: string) => void }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
      {items.slice(0, 6).map((item, i) => (
        <div key={item.itemName} className="hot-card" onClick={() => onSelect(item.itemName)}>
          <div className={`rank-badge ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "topn"}`}>{i + 1}</div>
          <div className="pl-5 pt-1">
            <div className="text-xs font-semibold truncate mb-1" style={{ color: item.itemRarity ? getRarityColor(item.itemRarity) : "var(--text-primary)" }}>{item.itemName}</div>
            <div className="flex items-center justify-between">
              {item.lastPrice ? <span className="text-[11px] font-bold" style={{ color: "var(--color-accent-dim)" }}>{formatGold(item.lastPrice)}</span> : <span />}
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.searchCount}회</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   자동완성 검색

   핵심: /api/auction + wordType=full 사용

   Neople API 특성:
   - /df/items + wordType=match → {"rows":[]} 빈 결과
   - /df/auction + wordType=match → {"rows":[]} 빈 결과
   - /df/auction + wordType=full → 결과 있음 ✅

   경매장에 실제 등록된 아이템 기준으로 자동완성 제공.
   아이템 이미지, 이름, 가격 등이 함께 표시됨.
   ═══════════════════════════════════════════════ */
function AutocompleteSearch({
  query, setQuery, onSearch, loading, placeholder, buttonLabel = "검색",
}: {
  query: string; setQuery: (v: string) => void; onSearch: () => void; loading: boolean;
  placeholder: string; buttonLabel?: string;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const skipNextEffect = useRef(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // query 변경 시 디바운스 자동완성
  useEffect(() => {
    if (skipNextEffect.current) { skipNextEffect.current = false; return; }

    const trimmed = query.trim();
    if (trimmed.length < 1) { setSuggestions([]); setShowDropdown(false); return; }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        // /api/auction + wordType=full → 실제 결과 반환됨
        const url = `/api/auction?itemName=${encodeURIComponent(trimmed)}&wordType=full&limit=10`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) { setSuggestions([]); setShowDropdown(false); return; }
        const json = await res.json();
        const rows = extractRows(json);

        // 중복 아이템 이름 제거 (같은 아이템이 여러 매물로 등록되어 있으므로)
        const seen = new Set<string>();
        const unique: any[] = [];
        for (const row of rows) {
          const name = row.itemName || "";
          if (name && !seen.has(name)) {
            seen.add(name);
            unique.push(row);
          }
        }

        setSuggestions(unique);
        setShowDropdown(unique.length > 0);
      } catch (e: any) {
        if (e.name !== "AbortError") { setSuggestions([]); setShowDropdown(false); }
      }
    }, 400);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const selectItem = (name: string) => {
    skipNextEffect.current = true;
    setQuery(name);
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-2">
        <input type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { setShowDropdown(false); onSearch(); } }}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder={placeholder} className="flex-1 input-base" />
        <SearchButton onClick={() => { setShowDropdown(false); onSearch(); }} loading={loading} disabled={!query.trim()} label={buttonLabel} />
      </div>
      {showDropdown && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map((item: any, i: number) => {
            const name = item.itemName || item.setItemName || item.title || "";
            const id = item.itemId || "";
            const rarity = item.itemRarity || "";
            return (
              <div key={`${id || i}-${i}`} className="autocomplete-item"
                onMouseDown={(e) => { e.preventDefault(); selectItem(name); }}>
                {id && <ItemImage itemId={id} itemName={name} rarity={rarity} size={28} />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate font-medium" style={{ color: rarity ? getRarityColor(rarity) : "var(--text-primary)" }}>
                    {name}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {item.itemAvailableLevel !== undefined && `Lv.${item.itemAvailableLevel}`}
                    {item.itemType && ` · ${item.itemType}`}
                    {rarity && ` · ${rarity}`}
                  </div>
                </div>
                {item.unitPrice !== undefined && (
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--color-accent-dim)" }}>
                    {formatGold(item.unitPrice)}
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

/* ═══ 알림 ═══ */
function AlertPanel() {
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertItem, setAlertItem] = useState("");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCondition, setAlertCondition] = useState<"below" | "above">("below");
  const [alertMsg, setAlertMsg] = useState("");
  const [alertError, setAlertError] = useState("");
  const [alertLoading, setAlertLoading] = useState(false);
  const [myEmail, setMyEmail] = useState("");
  const [myAlerts, setMyAlerts] = useState<AlertRule[]>([]);
  const [myAlertsLoading, setMyAlertsLoading] = useState(false);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const registerAlert = useCallback(async () => {
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

  const lookupMyAlerts = useCallback(async () => {
    if (!myEmail || !validateEmail(myEmail)) return;
    setMyAlertsLoading(true);
    try { const res = await fetch(`/api/alert?email=${encodeURIComponent(myEmail)}`); const data: AlertListResponse = await res.json(); setMyAlerts(data.rules || []); }
    catch { setMyAlerts([]); } finally { setMyAlertsLoading(false); }
  }, [myEmail]);

  const deleteMyAlert = useCallback(async (id: string) => {
    await fetch("/api/alert", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, email: myEmail }) });
    lookupMyAlerts();
  }, [myEmail, lookupMyAlerts]);

  return (
    <div className="animate-fade-in space-y-5">
      <Card>
        <h2 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>🔔 시세 알림 등록</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>목표 가격에 도달하면 이메일로 알려드립니다 · 로그인 불필요 · 1회 발송 후 자동 종료</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="이메일 주소" className="input-base" />
          <input type="text" value={alertItem} onChange={e => setAlertItem(e.target.value)} placeholder="아이템 이름 (예: 무한의정수)" className="input-base" />
        </div>
        <div className="flex gap-3 mb-3">
          <select value={alertCondition} onChange={e => setAlertCondition(e.target.value as "below" | "above")} className="input-base text-sm" style={{ width: "auto" }}>
            <option value="below">이하로 떨어지면</option><option value="above">이상으로 오르면</option>
          </select>
          <input type="number" value={alertPrice} onChange={e => setAlertPrice(e.target.value)} placeholder="목표 가격 (골드)" className="flex-1 input-base" />
          <button onClick={registerAlert} disabled={alertLoading} className="px-5 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0"
            style={{ background: "var(--color-primary)", color: "#fff" }}>{alertLoading ? "등록 중..." : "알림 등록"}</button>
        </div>
        {alertMsg && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#F0FDF4", color: "var(--color-success)", border: "1px solid #BBF7D0" }}>{alertMsg}</div>}
        {alertError && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "var(--color-danger)", border: "1px solid #FECACA" }}>{alertError}</div>}
      </Card>
      <Card>
        <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>내 알림 조회</h3>
        <div className="flex gap-2 mb-3">
          <input type="email" value={myEmail} onChange={e => setMyEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && lookupMyAlerts()}
            placeholder="등록한 이메일 주소" className="flex-1 input-base" />
          <button onClick={lookupMyAlerts} disabled={myAlertsLoading || !myEmail} className="px-4 py-2.5 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
            {myAlertsLoading ? "조회 중..." : "조회"}</button>
        </div>
        {myAlerts.length > 0 && (
          <div className="space-y-2">
            {myAlerts.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <div className="flex-1 min-w-0">
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{a.itemName}</span>
                  <span className="ml-2" style={{ color: "var(--text-muted)" }}>{formatGold(a.targetPrice)} {a.condition === "below" ? "이하" : "이상"}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: a.fulfilled ? "#F0FDF4" : "var(--color-primary-light)", color: a.fulfilled ? "var(--color-success)" : "var(--color-primary)" }}>
                  {a.fulfilled ? "완료" : "대기중"}</span>
                {!a.fulfilled && <button onClick={() => deleteMyAlert(a.id)} className="text-[10px] px-2 py-1 rounded" style={{ color: "var(--color-danger)" }}>삭제</button>}
              </div>
            ))}
          </div>
        )}
        {myAlerts.length === 0 && myEmail && !myAlertsLoading && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>등록된 알림이 없습니다.</p>}
      </Card>
      {popular.length > 0 && (
        <section>
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>🔥 인기 검색 아이템</h3>
          <HotItemCards items={popular} onSelect={(name) => { setAlertItem(name); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </section>
      )}
    </div>
  );
}

/* ═══ 경매장 ═══ */
function AuctionSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const url = `/api/auction?itemName=${encodeURIComponent(query.trim())}&wordType=full&limit=50`;
      const res = await fetch(url);
      const data: AuctionSearchResponse = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || `오류 (${res.status})`); setResults([]); }
      else {
        const rows = [...(data.rows || [])];
        rows.sort((a, b) => a.unitPrice - b.unitPrice);
        setResults(rows);
      }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>현재 경매장에 등록된 아이템을 검색합니다. 개당 가격이 싼 순으로 정렬됩니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading}
          placeholder="아이템 이름 입력 (예: 토큰, 무한의정수, 강화권...)" />
      </Card>
      {!searched && popular.length > 0 && (
        <section className="mb-4"><h3 className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>🔥 인기 검색 아이템</h3>
          <HotItemCards items={popular} onSelect={(name) => setQuery(name)} /></section>)}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} h={18} />}
      {!loading && results.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{results.length}건 · 개당 가격 낮은 순</p>
          <div className="space-y-2">{results.map((item, i) => <AuctionRow key={`${item.auctionNo}-${i}`} item={item} />)}</div>
        </div>
      )}
      {!loading && searched && results.length === 0 && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}

function AuctionRow({ item }: { item: AuctionItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card cursor-pointer transition-all"
      style={{ padding: "12px 16px", borderColor: open ? "var(--color-primary)" : "var(--border-color)", boxShadow: open ? "0 2px 12px rgba(37,99,235,0.06)" : "none" }}
      onClick={() => setOpen(!open)}>
      <div className="flex items-center gap-3">
        <ItemImage itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: getRarityColor(item.itemRarity) }}>
            {item.reinforce > 0 && <span style={{ color: "var(--color-accent-dim)" }}>+{item.reinforce} </span>}
            {item.itemName}
            {item.refine > 0 && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>제련 {item.refine}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span>Lv.{item.itemAvailableLevel}</span>
            <span style={{ color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span>
            <span>{item.itemType}</span>
            {item.count > 1 && <span>x{item.count}</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold" style={{ color: "var(--color-accent-dim)" }}>{formatGold(item.unitPrice)}</div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>개당</div>
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs" style={{ borderTop: "1px solid var(--border-color)" }}>
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuctionSoldItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const url = `/api/auction-sold?itemName=${encodeURIComponent(query.trim())}&wordType=full&limit=50`;
      const res = await fetch(url);
      const data: AuctionSoldResponse = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || "오류"); setResults([]); }
      else { setResults([...(data.rows || [])].sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""))); }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>최근 거래 완료된 아이템의 실제 거래 가격을 확인합니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading}
          placeholder="아이템 이름 입력 (예: 토큰, 강화권...)" buttonLabel="시세 검색" />
      </Card>
      {!searched && popular.length > 0 && (
        <section className="mb-4"><h3 className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>🔥 인기 검색 아이템</h3>
          <HotItemCards items={popular} onSelect={(name) => setQuery(name)} /></section>)}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} h={14} />}
      {!loading && results.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>최근 거래 {results.length}건 · 최신순</p>
          <div className="space-y-1.5">
            {results.map((item, i) => (
              <div key={i} className="card flex items-center gap-3 text-xs" style={{ padding: "10px 14px" }}>
                <ItemImage itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
                <div className="flex-1 min-w-0 truncate font-medium" style={{ color: getRarityColor(item.itemRarity) }}>
                  {item.reinforce > 0 && <span style={{ color: "var(--color-accent-dim)" }}>+{item.reinforce} </span>}{item.itemName}</div>
                <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: `${getRarityColor(item.itemRarity)}10`, color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span>
                <span className="w-8 text-center" style={{ color: "var(--text-muted)" }}>{item.count}</span>
                <span className="w-16 text-right font-semibold" style={{ color: "var(--color-accent-dim)" }}>{formatGold(item.unitPrice)}</span>
                <span className="w-28 text-right hidden sm:block" style={{ color: "var(--text-muted)" }}>{formatDate(item.soldDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && searched && results.length === 0 && !error && <Empty msg="거래 내역이 없습니다." />}
    </div>
  );
}

/* ═══ 아바타 마켓 ═══ */
function AvatarMarketPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const url = `/api/avatar-market?title=${encodeURIComponent(query.trim())}&limit=30`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || "오류"); setResults([]); }
      else { setResults(extractRows(data)); }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>아바타 마켓에 등록된 상품을 검색합니다.</p>
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") search(); }}
            placeholder="아바타 상품명 입력 (예: 칭호, 크리쳐, 오라...)" className="flex-1 input-base" />
          <SearchButton onClick={search} loading={loading} disabled={!query.trim()} label="마켓 검색" />
        </div>
      </Card>
      {!searched && popular.length > 0 && (
        <section className="mb-4"><h3 className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>🔥 인기 검색 아이템</h3>
          <HotItemCards items={popular} onSelect={(name) => setQuery(name)} /></section>)}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} h={14} />}
      {!loading && results.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{results.length}건</p>
          <div className="space-y-1.5">
            {results.map((item: any, i: number) => (
              <div key={i} className="card flex items-center gap-3 text-xs" style={{ padding: "10px 14px" }}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.title}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {item.sellerName}{item.count > 1 ? ` · x${item.count}` : ""} · {formatDate(item.regDate)}</div>
                </div>
                {item.hashtag && item.hashtag.length > 0 && (
                  <div className="hidden sm:flex gap-1 flex-shrink-0">
                    {item.hashtag.slice(0, 2).map((tag: string) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>#{tag}</span>
                    ))}
                  </div>
                )}
                <span className="font-semibold flex-shrink-0" style={{ color: "var(--color-accent-dim)" }}>{formatGold(item.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && searched && results.length === 0 && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}

/* ═══ 아이템 DB ═══ */
function ItemSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true); setDetail(null);
    try {
      const url = `/api/items?itemName=${encodeURIComponent(query.trim())}&wordType=full&limit=30`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || "오류"); setResults([]); }
      else { setResults(extractRows(data)); }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  const loadDetail = useCallback(async (itemId: string) => {
    if (detail?.itemId === itemId) { setDetail(null); return; }
    try { const res = await fetch(`/api/item-detail?itemId=${itemId}`); setDetail(await res.json()); } catch { }
  }, [detail]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>아이템 이름으로 상세 정보를 검색합니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading}
          placeholder="아이템 이름 입력 (예: 무한의정수)" buttonLabel="아이템 검색" />
      </Card>
      {!searched && popular.length > 0 && (
        <section className="mb-4"><h3 className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>🔥 인기 검색 아이템</h3>
          <HotItemCards items={popular} onSelect={(name) => setQuery(name)} /></section>)}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} h={14} />}
      {!loading && results.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{results.length}건</p>
          <div className="space-y-1.5">
            {results.map((item: any) => (
              <div key={item.itemId}>
                <div className="card flex items-center gap-3 text-xs cursor-pointer" style={{ padding: "10px 14px" }} onClick={() => loadDetail(item.itemId)}>
                  <ItemImage itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: getRarityColor(item.itemRarity) }}>{item.itemName}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Lv.{item.itemAvailableLevel} · {item.itemType}</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: `${getRarityColor(item.itemRarity)}10`, color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span>
                </div>
                {detail?.itemId === item.itemId && (
                  <div className="card animate-slide-up mt-1" style={{ padding: "14px 16px", borderColor: "var(--color-primary)", background: "var(--color-surface)" }}>
                    <div className="text-xs space-y-2">
                      <div><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{detail.itemName}</span></div>
                      {detail.itemExplain && <div style={{ color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: detail.itemExplain.replace(/\n/g, "<br/>") }} />}
                      {detail.itemFlavorText && <div className="italic" style={{ color: "var(--text-muted)" }}>{detail.itemFlavorText}</div>}
                      {detail.setItemName && <div className="text-[10px]" style={{ color: "var(--color-primary)" }}>세트: {detail.setItemName}</div>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && searched && results.length === 0 && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}

/* ═══ 세트 아이템 ═══ */
function SetItemPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SetItemResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const url = `/api/setitems?setItemName=${encodeURIComponent(query.trim())}&wordType=full&limit=30`;
      const res = await fetch(url);
      const data: SetItemSearchResponse = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || "오류"); setResults([]); }
      else setResults(data.rows || []);
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>세트 아이템을 이름으로 검색합니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading}
          placeholder="세트 아이템 이름 입력" buttonLabel="세트 검색" />
      </Card>
      {!searched && popular.length > 0 && (
        <section className="mb-4"><h3 className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>🔥 인기 검색 아이템</h3>
          <HotItemCards items={popular} onSelect={(name) => setQuery(name)} /></section>)}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} h={12} />}
      {!loading && results.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{results.length}건</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {results.map((item) => (
              <div key={item.setItemId} className="card flex items-center gap-3 text-xs" style={{ padding: "12px 16px" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}>SET</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.setItemName}</div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>ID: {item.setItemId}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && searched && results.length === 0 && !error && <Empty msg="검색 결과가 없습니다." />}
    </div>
  );
}