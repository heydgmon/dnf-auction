"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  AuctionItem, AuctionSearchResponse,
  AuctionSoldItem, AuctionSoldResponse, PopularItem,
  AlertRule, AlertRegisterResponse, AlertListResponse,
  SetItemResult, SetItemSearchResponse,
  ItemSearchResult, ItemSearchResponse,
} from "@/lib/types";
import { getRarityColor, getRarityBg, formatGold, formatFullGold, validateEmail, formatDate } from "@/lib/utils";

export function itemImageUrl(id: string) { return `https://img-api.neople.co.kr/df/items/${id}`; }

export function extractRows(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.items)) return json.items;
  if (typeof json === "object") {
    for (const k of Object.keys(json)) { if (Array.isArray(json[k])) return json[k]; }
  }
  return [];
}

export const MAX_ALERT_PRICE = 999_999_999_999;
export function formatPriceInput(value: string): string { const digits = value.replace(/[^0-9]/g, ""); if (!digits) return ""; const num = Number(digits); if (num > MAX_ALERT_PRICE) return MAX_ALERT_PRICE.toLocaleString(); return num.toLocaleString(); }
export function parsePriceInput(formatted: string): string { return formatted.replace(/[^0-9]/g, ""); }

export function filterByItemName<T extends { itemName?: string }>(rows: T[], query: string): T[] {
  const q = query.trim(); if (!q) return rows;
  const qLower = q.toLowerCase(); const qWords = qLower.split(/\s+/).filter(Boolean);
  const exact = rows.filter(r => r.itemName === q); if (exact.length > 0) return exact;
  const contains = rows.filter(r => r.itemName && r.itemName.toLowerCase().includes(qLower)); if (contains.length > 0) return contains;
  return rows.filter(r => { if (!r.itemName) return false; const name = r.itemName.toLowerCase(); return qWords.every(w => name.includes(w)); });
}

let recentSearches: string[] = [];
export function addRecent(name: string) { recentSearches = [name, ...recentSearches.filter(n => n !== name)].slice(0, 10); }
export function getRecent() { return recentSearches; }

/* ═══ 공통 ═══ */
export function Card({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) { return <div className="card" style={{ marginBottom: 16, ...s }}>{children}</div>; }
export function Btn({ onClick, loading, disabled, label = "검색", variant = "primary" }: { onClick: () => void; loading: boolean; disabled: boolean; label?: string; variant?: "primary" | "secondary" }) { const bg = variant === "primary" ? "var(--color-primary)" : "var(--bg-primary)"; const color = variant === "primary" ? "#fff" : "var(--text-secondary)"; const border = variant === "primary" ? "none" : "1px solid var(--border-color)"; return <button onClick={onClick} disabled={loading || disabled} style={{ padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: bg, color, border, cursor: "pointer", flexShrink: 0, transition: "opacity 0.15s" }}>{loading ? "검색 중..." : label}</button>; }
export function ItemImg({ itemId, itemName, rarity, size = 32 }: { itemId: string; itemName: string; rarity?: string; size?: number }) { const [err, setErr] = useState(false); const rc = rarity ? getRarityColor(rarity) : "var(--text-muted)"; if (!itemId || err) return <div style={{ width: size, height: size, borderRadius: 8, background: `${rc}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: rc, flexShrink: 0 }}>{itemName?.slice(0, 2) || "??"}</div>; return <img src={itemImageUrl(itemId)} alt={itemName} width={size} height={size} style={{ borderRadius: 8, flexShrink: 0, objectFit: "contain", background: `${rc}08`, border: `1px solid ${rc}20` }} loading="lazy" onError={() => setErr(true)} />; }
export function InfoCell({ label, value }: { label: string; value: string }) { return <div><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div><div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{value}</div></div>; }
export function ErrorMsg({ msg }: { msg: string }) { if (!msg) return null; return <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13, background: "#FEF2F2", border: "1px solid #FECACA", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: 8 }}><span>⚠️</span>{msg}</div>; }
export function SkeletonList({ count }: { count: number }) { return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[...Array(count)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}</div>; }
export function Empty({ msg }: { msg: string }) { return <div style={{ padding: "56px 0", textAlign: "center" }}><p style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg}</p></div>; }

export function PopularCards({ items, onSelect }: { items: PopularItem[]; onSelect: (n: string) => void }) { if (!items?.length) return null; return (<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>{items.slice(0, 6).map((item, i) => (<div key={item.itemName} className="hot-card" onClick={() => onSelect(item.itemName)}><div className={`rank-badge ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "topn"}`}>{i + 1}</div><div style={{ paddingLeft: 20, paddingTop: 2 }}><div style={{ fontSize: 12, fontWeight: 600, color: item.itemRarity ? getRarityColor(item.itemRarity) : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{item.itemName}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{item.lastPrice ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-accent-dim)" }}>{formatGold(item.lastPrice)}</span> : <span />}<span style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.searchCount}회</span></div></div></div>))}</div>); }
export function RecentTags({ onSelect }: { onSelect: (n: string) => void }) { const items = getRecent(); if (!items.length) return null; return (<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{items.map(name => (<button key={name} className="recent-tag" onClick={() => onSelect(name)}>{name}</button>))}</div>); }

export function AutocompleteSearch({ query, setQuery, onSearch, loading, placeholder, buttonLabel = "검색" }: { query: string; setQuery: (v: string) => void; onSearch: () => void; loading: boolean; placeholder: string; buttonLabel?: string; }) { const [suggestions, setSuggestions] = useState<any[]>([]); const [showDrop, setShowDrop] = useState(false); const wrapRef = useRef<HTMLDivElement>(null); const skip = useRef(false); useEffect(() => { const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowDrop(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []); useEffect(() => { if (skip.current) { skip.current = false; return; } const t = query.trim(); if (t.length < 1) { setSuggestions([]); setShowDrop(false); return; } const ctrl = new AbortController(); const timer = setTimeout(async () => { try { const res = await fetch(`/api/auction?itemName=${encodeURIComponent(t)}&wordType=full&limit=400&sort[unitPrice]=asc`, { signal: ctrl.signal }); if (!res.ok) { setSuggestions([]); setShowDrop(false); return; } const rows = extractRows(await res.json()); const matched = filterByItemName(rows, t); const nameMap = new Map<string, any>(); for (const r of matched) { const n = r.itemName || ""; if (n && !nameMap.has(n)) { nameMap.set(n, r); } else if (n && nameMap.has(n)) { const existing = nameMap.get(n)!; if ((r.unitPrice || Infinity) < (existing.unitPrice || Infinity)) { nameMap.set(n, r); } } } const uniq = [...nameMap.values()]; uniq.sort((a: any, b: any) => (a.unitPrice || 0) - (b.unitPrice || 0)); setSuggestions(uniq.slice(0, 15)); setShowDrop(uniq.length > 0); } catch (e: any) { if (e.name !== "AbortError") { setSuggestions([]); setShowDrop(false); } } }, 400); return () => { clearTimeout(timer); ctrl.abort(); }; }, [query]); const pick = (n: string) => { skip.current = true; setQuery(n); setShowDrop(false); }; return (<div ref={wrapRef} style={{ position: "relative" }}><div style={{ display: "flex", gap: 8 }}><input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setShowDrop(false); onSearch(); } }} onFocus={() => { if (suggestions.length > 0) setShowDrop(true); }} placeholder={placeholder} className="input-base" style={{ flex: 1 }} />{buttonLabel && <Btn onClick={() => { setShowDrop(false); onSearch(); }} loading={loading} disabled={!query.trim()} label={buttonLabel} />}</div>{showDrop && suggestions.length > 0 && (<div className="autocomplete-dropdown">{suggestions.map((item: any, i: number) => { const name = item.itemName || ""; const id = item.itemId || ""; const rarity = item.itemRarity || ""; return (<div key={`${id || name}-${i}`} className="autocomplete-item" onMouseDown={e => { e.preventDefault(); pick(name); }}>{id && <ItemImg itemId={id} itemName={name} rarity={rarity} size={28} />}<div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 500, color: rarity ? getRarityColor(rarity) : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div><div style={{ fontSize: 10, color: "var(--text-muted)" }}>{item.itemAvailableLevel !== undefined && `Lv.${item.itemAvailableLevel}`}{item.itemType && ` · ${item.itemType}`}{rarity && ` · ${rarity}`}</div></div>{item.unitPrice !== undefined && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>최저 {formatGold(item.unitPrice)}</span>}</div>); })}</div>)}</div>); }

export function SearchHelpers({ popular, onSelect }: { popular: PopularItem[]; onSelect: (n: string) => void }) { const [, forceUpdate] = useState(0); return (<div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>{getRecent().length > 0 && (<section><div className="section-title">🕐 최근 검색</div><RecentTags onSelect={n => { onSelect(n); forceUpdate(v => v + 1); }} /></section>)}{popular.length > 0 && (<section><div className="section-title">🔥 인기 검색 아이템</div><PopularCards items={popular} onSelect={onSelect} /></section>)}</div>); }