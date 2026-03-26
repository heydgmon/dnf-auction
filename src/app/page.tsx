"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  AuctionItem, AuctionSearchResponse, AuctionDetailResponse,
  AuctionSoldItem, AuctionSoldResponse, PopularItem,
  AlertRule, AlertRegisterResponse, AlertListResponse,
  SetItemResult, SetItemSearchResponse,
  ItemSearchResult, ItemSearchResponse,
} from "@/lib/types";
import { getRarityColor, getRarityBg, formatGold, formatFullGold, validateEmail, formatDate } from "@/lib/utils";

type Page = "home" | "auction" | "auction-sold" | "avatar-market" | "items" | "setitems";

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: "auction", label: "경매장" },
  { id: "auction-sold", label: "시세" },
  { id: "avatar-market", label: "아바타 마켓" },
  { id: "items", label: "아이템 DB" },
  { id: "setitems", label: "세트 아이템" },
];

function itemImageUrl(itemId: string): string {
  return `https://img-api.neople.co.kr/df/items/${itemId}`;
}

export default function Home() {
  const [page, setPage] = useState<Page>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => setPage("home")} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-black"
              style={{ background: "linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dim))", color: "#fff" }}>경</div>
            <div className="text-left">
              <div className="text-base font-bold" style={{ color: "var(--text-primary)" }}>던파 경매장</div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>시세 알림 & 아이템 검색</div>
            </div>
          </button>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setPage(item.id)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{ color: page === item.id ? "var(--accent-blue)" : "var(--text-secondary)", background: page === item.id ? "rgba(32,96,208,0.06)" : "transparent" }}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="md:hidden relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>메뉴 ▾</button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-50 animate-slide-down min-w-[140px]"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                {NAV_ITEMS.map((item) => (
                  <button key={item.id} onClick={() => { setPage(item.id); setMenuOpen(false); }}
                    className="block w-full text-left px-4 py-2 text-xs transition-colors"
                    style={{ color: page === item.id ? "var(--accent-blue)" : "var(--text-secondary)" }}>{item.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {page === "home" && <HomePage onNavigate={setPage} />}
        {page === "auction" && <AuctionSearchPanel />}
        {page === "auction-sold" && <AuctionSoldPanel />}
        {page === "avatar-market" && <AvatarMarketPanel />}
        {page === "items" && <ItemSearchPanel />}
        {page === "setitems" && <SetItemPanel />}
      </main>
      <footer className="py-4 text-center text-[10px]" style={{ color: "var(--text-muted)" }}>Data provided by Neople Open API · Not affiliated with Neople or Nexon</footer>
    </div>
  );
}

/* ═══ HOME ═══ */
function HomePage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertItem, setAlertItem] = useState("");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCondition, setAlertCondition] = useState<"below"|"above">("below");
  const [alertMsg, setAlertMsg] = useState("");
  const [alertError, setAlertError] = useState("");
  const [alertLoading, setAlertLoading] = useState(false);
  const [myEmail, setMyEmail] = useState("");
  const [myAlerts, setMyAlerts] = useState<AlertRule[]>([]);
  const [myAlertsLoading, setMyAlertsLoading] = useState(false);

  useEffect(() => { fetch("/api/popular-items").then(r=>r.json()).then(d=>setPopular(d.items||[])).catch(()=>{}); }, []);

  const registerAlert = useCallback(async () => {
    setAlertMsg(""); setAlertError("");
    if (!alertEmail||!alertItem||!alertPrice) { setAlertError("모든 항목을 입력해주세요."); return; }
    if (!validateEmail(alertEmail)) { setAlertError("올바른 이메일 주소를 입력해주세요."); return; }
    setAlertLoading(true);
    try {
      const res = await fetch("/api/alert-register", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email:alertEmail, itemName:alertItem.trim(), targetPrice:Number(alertPrice), condition:alertCondition }) });
      const data: AlertRegisterResponse = await res.json();
      if (data.success) { setAlertMsg(data.message); setAlertItem(""); setAlertPrice(""); } else setAlertError(data.message);
    } catch { setAlertError("서버 연결에 실패했습니다."); } finally { setAlertLoading(false); }
  }, [alertEmail, alertItem, alertPrice, alertCondition]);

  const lookupMyAlerts = useCallback(async () => {
    if (!myEmail||!validateEmail(myEmail)) return;
    setMyAlertsLoading(true);
    try { const res = await fetch(`/api/alert?email=${encodeURIComponent(myEmail)}`); const data:AlertListResponse = await res.json(); setMyAlerts(data.rules||[]); }
    catch { setMyAlerts([]); } finally { setMyAlertsLoading(false); }
  }, [myEmail]);

  const deleteMyAlert = useCallback(async (id:string) => {
    await fetch("/api/alert",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,email:myEmail})}); lookupMyAlerts();
  }, [myEmail, lookupMyAlerts]);

  return (
    <div className="animate-fade-in space-y-6">
      <section className="rounded-xl p-6" style={{ background:"var(--bg-card)",border:"1px solid var(--border-color)",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        <h2 className="text-lg font-bold mb-1" style={{color:"var(--text-primary)"}}>시세 알림 등록</h2>
        <p className="text-xs mb-4" style={{color:"var(--text-muted)"}}>목표 가격에 도달하면 이메일로 알려드립니다 · 로그인 불필요 · 1회 발송 후 자동 종료</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input type="email" value={alertEmail} onChange={e=>setAlertEmail(e.target.value)} placeholder="이메일 주소" className="input-base" />
          <input type="text" value={alertItem} onChange={e=>setAlertItem(e.target.value)} placeholder="아이템 이름 (예: 무한의정수)" className="input-base" />
        </div>
        <div className="flex gap-3 mb-3">
          <select value={alertCondition} onChange={e=>setAlertCondition(e.target.value as "below"|"above")} className="input-base text-sm" style={{width:"auto"}}>
            <option value="below">이하로 떨어지면</option><option value="above">이상으로 오르면</option>
          </select>
          <input type="number" value={alertPrice} onChange={e=>setAlertPrice(e.target.value)} placeholder="목표 가격 (골드)" className="flex-1 input-base" />
          <button onClick={registerAlert} disabled={alertLoading} className="px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{background:"linear-gradient(135deg,var(--accent-teal),var(--accent-green))",color:"#fff"}}>{alertLoading?"등록 중...":"알림 등록"}</button>
        </div>
        {alertMsg && <p className="text-xs px-3 py-2 rounded-lg" style={{background:"rgba(24,128,74,0.06)",color:"var(--accent-green)"}}>{alertMsg}</p>}
        {alertError && <p className="text-xs px-3 py-2 rounded-lg" style={{background:"rgba(192,48,64,0.06)",color:"var(--accent-red)"}}>{alertError}</p>}
        <p className="text-[10px] mt-3" style={{color:"var(--text-muted)"}}>이메일당 최대 3개 · 중복 등록 불가 · 시간당 5회 제한</p>
      </section>
      <section className="rounded-xl p-6" style={{background:"var(--bg-card)",border:"1px solid var(--border-color)",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <h3 className="text-sm font-bold mb-3" style={{color:"var(--text-primary)"}}>내 알림 확인</h3>
        <div className="flex gap-2 mb-3">
          <input type="email" value={myEmail} onChange={e=>setMyEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&lookupMyAlerts()} placeholder="등록한 이메일 입력" className="flex-1 input-base" />
          <button onClick={lookupMyAlerts} disabled={myAlertsLoading} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{background:"var(--bg-primary)",border:"1px solid var(--border-color)",color:"var(--text-secondary)"}}>조회</button>
        </div>
        {myAlerts.length>0&&(<div className="space-y-1.5">{myAlerts.map(a=>(<div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{background:"var(--bg-primary)",border:"1px solid var(--border-color)"}}>
          <div><span className="font-medium" style={{color:"var(--text-primary)"}}>{a.itemName}</span><span style={{color:"var(--text-muted)"}}> · {a.condition==="below"?"≤":"≥"} {formatGold(a.targetPrice)}</span>
          {a.fulfilled&&<span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{background:"rgba(24,128,74,0.08)",color:"var(--accent-green)"}}>발송완료</span>}</div>
          {!a.fulfilled&&<button onClick={()=>deleteMyAlert(a.id)} className="text-[10px] px-2 py-1 rounded" style={{color:"var(--accent-red)"}}>삭제</button>}
        </div>))}</div>)}
        {myAlertsLoading&&<div className="skeleton h-10 w-full"/>}
      </section>
      <section>
        <h3 className="text-sm font-bold mb-3" style={{color:"var(--text-primary)"}}>인기 검색 아이템</h3>
        {popular.length===0?(<p className="text-xs py-8 text-center" style={{color:"var(--text-muted)"}}>아직 검색 데이터가 없습니다. 경매장에서 아이템을 검색해보세요.</p>
        ):(<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{popular.slice(0,12).map((item,i)=>(
          <div key={item.itemName} className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors"
            style={{background:"var(--bg-card)",border:"1px solid var(--border-color)"}}
            onClick={()=>{setAlertItem(item.itemName);window.scrollTo({top:0,behavior:"smooth"});}}>
            <span className="text-xs font-bold w-5 text-right" style={{color:"var(--text-muted)"}}>{i+1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{color:item.itemRarity?getRarityColor(item.itemRarity):"var(--text-primary)"}}>{item.itemName}</div>
              {item.lastPrice&&<div className="text-[10px]" style={{color:"var(--accent-gold)"}}>{formatGold(item.lastPrice)}</div>}
            </div>
            <span className="text-[10px]" style={{color:"var(--text-muted)"}}>{item.searchCount}회</span>
          </div>))}</div>)}
      </section>
      <section>
        <h3 className="text-sm font-bold mb-3" style={{color:"var(--text-primary)"}}>빠른 이동</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {NAV_ITEMS.map(item=>(<button key={item.id} onClick={()=>onNavigate(item.id)} className="px-4 py-3 rounded-lg text-xs font-medium text-left transition-colors"
            style={{background:"var(--bg-card)",border:"1px solid var(--border-color)",color:"var(--text-secondary)"}}>{item.label}</button>))}
        </div>
      </section>
    </div>
  );
}

/* ═══ 경매장 검색 ═══ */
function AuctionSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const qs = [`itemName=${encodeURIComponent(query.trim())}`,`wordType=full`,`limit=30`,`sort[auctionNo]=desc`].join("&");
      const res = await fetch(`/api/auction?${qs}`);
      const data: AuctionSearchResponse = await res.json();
      if (!res.ok||data.error) { setError(data.error?.message||`오류 (${res.status})`); setResults([]); }
      else setResults(data.rows||[]);
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{color:"var(--text-muted)"}}>현재 경매장에 등록된 아이템을 검색합니다. 이름 일부만 입력해도 검색됩니다.</p>
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}
            placeholder="아이템 이름 입력 (예: 토큰, 무한의정수, 강화권...)" className="flex-1 input-base" />
          <SearchButton onClick={search} loading={loading} disabled={!query.trim()} />
        </div>
      </Card>
      <ErrorMsg msg={error} />
      {loading&&<SkeletonList count={5} h={18}/>}
      {!loading&&results.length>0&&(<div>
        <p className="text-xs mb-2" style={{color:"var(--text-muted)"}}>{results.length}건 · 최근 등록순</p>
        <div className="space-y-1.5">{results.map((item,i)=><AuctionRow key={`${item.auctionNo}-${i}`} item={item}/>)}</div>
      </div>)}
      {!loading&&searched&&results.length===0&&!error&&<Empty msg="검색 결과가 없습니다. 다른 키워드로 검색해보세요."/>}
    </div>
  );
}

function AuctionRow({ item }: { item: AuctionItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg p-3 transition-all cursor-pointer"
      style={{background:open?"var(--bg-card-hover)":getRarityBg(item.itemRarity),border:`1px solid ${open?"var(--border-accent)":"var(--border-color)"}`}}
      onClick={()=>setOpen(!open)}>
      <div className="flex items-center gap-3">
        <ItemImage itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{color:getRarityColor(item.itemRarity)}}>
            {item.reinforce>0&&<span style={{color:"var(--accent-gold)"}}>+{item.reinforce} </span>}
            {item.itemName}
            {item.refine>0&&<span className="ml-1 text-[10px] px-1.5 py-0.5 rounded" style={{background:"rgba(32,96,208,0.08)",color:"var(--accent-blue)"}}>제련 {item.refine}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{color:"var(--text-muted)"}}>
            <span>Lv.{item.itemAvailableLevel}</span>
            <span style={{color:getRarityColor(item.itemRarity)}}>{item.itemRarity}</span>
            <span>{item.itemType}</span>
            {item.count>1&&<span>x{item.count}</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold" style={{color:"var(--accent-gold)"}}>{formatGold(item.unitPrice)}</div>
          <div className="text-[10px]" style={{color:"var(--text-muted)"}}>개당</div>
        </div>
      </div>
      {open&&(<div className="mt-3 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs" style={{borderTop:"1px solid var(--border-color)"}}>
        <InfoCell label="총 가격" value={formatFullGold(item.currentPrice)} />
        <InfoCell label="평균 시세" value={formatFullGold(item.averagePrice)} />
        <InfoCell label="등록일" value={formatDate(item.regDate)} />
        <InfoCell label="만료일" value={formatDate(item.expireDate)} />
        {item.amplificationName&&<InfoCell label="증폭" value={item.amplificationName}/>}
      </div>)}
    </div>
  );
}

/* ═══ 시세 검색 ═══ */
function AuctionSoldPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuctionSoldItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const params = new URLSearchParams({itemName:query.trim(),wordType:"full",limit:"50"});
      const res = await fetch(`/api/auction-sold?${params}`);
      const data: AuctionSoldResponse = await res.json();
      if (!res.ok||data.error) { setError(data.error?.message||"오류"); setResults([]); }
      else { const sorted = (data.rows||[]).sort((a,b)=>(b.soldDate||"").localeCompare(a.soldDate||"")); setResults(sorted); }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{color:"var(--text-muted)"}}>최근 거래 완료된 아이템의 실제 거래 가격을 확인합니다. 이름 일부만 입력해도 검색됩니다.</p>
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}
            placeholder="아이템 이름 입력 (예: 토큰, 강화권...)" className="flex-1 input-base" />
          <button onClick={search} disabled={loading||!query.trim()} className="px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{background:"linear-gradient(135deg,var(--accent-green),#1a6644)",color:"#fff"}}>{loading?"검색 중...":"시세 검색"}</button>
        </div>
      </Card>
      <ErrorMsg msg={error} />
      {loading&&<SkeletonList count={5} h={14}/>}
      {!loading&&results.length>0&&(<div>
        <p className="text-xs mb-2" style={{color:"var(--text-muted)"}}>최근 거래 {results.length}건 · 최신순</p>
        <div className="rounded-lg overflow-hidden" style={{border:"1px solid var(--border-color)"}}>
          {results.map((item,i)=>(
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-xs" style={{background:i%2===0?"var(--bg-secondary)":"var(--bg-primary)"}}>
              <ItemImage itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={28} />
              <div className="flex-1 min-w-0 truncate font-medium" style={{color:getRarityColor(item.itemRarity)}}>
                {item.reinforce>0&&<span style={{color:"var(--accent-gold)"}}>+{item.reinforce} </span>}{item.itemName}
              </div>
              <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded" style={{background:`${getRarityColor(item.itemRarity)}10`,color:getRarityColor(item.itemRarity)}}>{item.itemRarity}</span>
              <span className="w-8 text-center" style={{color:"var(--text-muted)"}}>{item.count}</span>
              <span className="w-16 text-right font-semibold" style={{color:"var(--accent-gold)"}}>{formatGold(item.unitPrice)}</span>
              <span className="w-28 text-right hidden sm:block" style={{color:"var(--text-muted)"}}>{formatDate(item.soldDate)}</span>
            </div>))}
        </div>
      </div>)}
      {!loading&&searched&&results.length===0&&!error&&<Empty msg="거래 내역이 없습니다."/>}
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

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const params = new URLSearchParams({title:query.trim(),limit:"30"});
      const res = await fetch(`/api/avatar-market?${params}`);
      const data = await res.json();
      if (!res.ok||data.error) { setError(data.error?.message||"오류"); setResults([]); }
      else setResults(data.rows||[]);
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{color:"var(--text-muted)"}}>아바타 마켓에 등록된 아바타/크리처 등을 검색합니다. 상품명 일부만 입력해도 검색됩니다.</p>
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}
            placeholder="아바타/상품 이름 입력..." className="flex-1 input-base" />
          <SearchButton onClick={search} loading={loading} disabled={!query.trim()} label="검색" />
        </div>
      </Card>
      <ErrorMsg msg={error} />
      {loading&&<SkeletonList count={5} h={14}/>}
      {!loading&&results.length>0&&(<div className="space-y-1.5">{results.map((item:any,i:number)=>(
        <div key={i} className="rounded-lg p-3" style={{background:"var(--bg-card)",border:"1px solid var(--border-color)"}}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{color:"var(--text-primary)"}}>{item.title}</div>
              <div className="text-[10px] mt-0.5" style={{color:"var(--text-muted)"}}>판매자: {item.sellerName} · 만료: {formatDate(item.expireDate)}</div>
              {item.hashtag?.length>0&&(<div className="flex gap-1 mt-1 flex-wrap">{item.hashtag.map((h:string)=>(
                <span key={h} className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"rgba(32,96,208,0.06)",color:"var(--accent-blue)"}}>#{h}</span>))}</div>)}
            </div>
            <div className="text-sm font-bold ml-3 flex-shrink-0" style={{color:"var(--accent-gold)"}}>{formatGold(item.price)}</div>
          </div>
        </div>))}</div>)}
      {!loading&&searched&&results.length===0&&!error&&<Empty msg="검색 결과가 없습니다."/>}
    </div>
  );
}

/* ═══ 아이템 DB ═══ */
function ItemSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const params = new URLSearchParams({itemName:query.trim(),limit:"30",wordType:"full"});
      const res = await fetch(`/api/items?${params}`);
      const data: ItemSearchResponse = await res.json();
      if (!res.ok||data.error) { setError(data.error?.message||"오류"); setResults([]); }
      else setResults(data.rows||[]);
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{color:"var(--text-muted)"}}>
          던전앤파이터의 전체 아이템 데이터베이스에서 검색합니다.
          아이템의 등급, 레벨, 타입 등 기본 정보를 확인할 수 있습니다.
        </p>
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}
            placeholder="아이템 이름 입력 (예: 무한의정수, 강화권, 환속...)" className="flex-1 input-base" />
          <SearchButton onClick={search} loading={loading} disabled={!query.trim()} label="검색" />
        </div>
      </Card>
      <ErrorMsg msg={error} />
      {loading&&<SkeletonList count={5} h={14}/>}
      {!loading&&results.length>0&&(<div>
        <p className="text-xs mb-2" style={{color:"var(--text-muted)"}}>{results.length}건</p>
        <div className="space-y-1">{results.map((item)=>(
          <div key={item.itemId} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{background:getRarityBg(item.itemRarity),border:"1px solid var(--border-color)"}}>
            <ItemImage itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{color:getRarityColor(item.itemRarity)}}>{item.itemName}</div>
              <div className="text-[10px]" style={{color:"var(--text-muted)"}}>Lv.{item.itemAvailableLevel} · {item.itemRarity} · {item.itemType}</div>
            </div>
          </div>))}</div>
      </div>)}
      {!loading&&searched&&results.length===0&&!error&&<Empty msg="검색 결과가 없습니다."/>}
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

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    try {
      const params = new URLSearchParams({setItemName:query.trim(),limit:"30",wordType:"full"});
      const res = await fetch(`/api/setitems?${params}`);
      const data: SetItemSearchResponse = await res.json();
      if (!res.ok||data.error) { setError(data.error?.message||"오류"); setResults([]); }
      else setResults(data.rows||[]);
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); } finally { setLoading(false); }
  }, [query]);

  return (
    <div className="animate-fade-in">
      <Card>
        <p className="text-xs mb-3" style={{color:"var(--text-muted)"}}>
          세트 아이템을 검색합니다. 세트 이름 일부만 입력하면 해당 세트를 찾을 수 있습니다.
          세트 구성 아이템과 세트 효과를 확인할 수 있습니다.
        </p>
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()}
            placeholder="세트 이름 입력 (예: 로드, 파워, 마스터...)" className="flex-1 input-base" />
          <SearchButton onClick={search} loading={loading} disabled={!query.trim()} label="검색" />
        </div>
      </Card>
      <ErrorMsg msg={error} />
      {loading&&<SkeletonList count={5} h={12}/>}
      {!loading&&results.length>0&&(<div>
        <p className="text-xs mb-2" style={{color:"var(--text-muted)"}}>{results.length}건</p>
        <div className="space-y-1">{results.map((item)=>(
          <div key={item.setItemId} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{background:"var(--bg-card)",border:"1px solid var(--border-color)"}}>
            <div className="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
              style={{background:"rgba(32,96,208,0.06)",border:"1px solid rgba(32,96,208,0.15)",color:"var(--accent-blue)"}}>세트</div>
            <div className="flex-1"><div className="text-sm font-medium" style={{color:"var(--text-primary)"}}>{item.setItemName}</div></div>
          </div>))}</div>
      </div>)}
      {!loading&&searched&&results.length===0&&!error&&<Empty msg="검색 결과가 없습니다."/>}
    </div>
  );
}

/* ═══ SHARED ═══ */
function ItemImage({itemId,itemName,rarity,size=36}:{itemId:string;itemName:string;rarity:string;size?:number}) {
  const [err,setErr] = useState(false);
  if (!itemId||err) return (
    <div className="rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
      style={{width:size,height:size,background:`${getRarityColor(rarity)}10`,border:`1px solid ${getRarityColor(rarity)}30`,color:getRarityColor(rarity)}}>
      {itemName?.slice(0,2)||"??"}
    </div>
  );
  return <img src={itemImageUrl(itemId)} alt={itemName} width={size} height={size} className="rounded-md flex-shrink-0"
    style={{border:`1px solid ${getRarityColor(rarity)}30`,background:`${getRarityColor(rarity)}08`}} onError={()=>setErr(true)} />;
}

function Card({children}:{children:React.ReactNode}) {
  return <div className="rounded-xl p-5 mb-5" style={{background:"var(--bg-card)",border:"1px solid var(--border-color)",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>{children}</div>;
}
function SearchButton({onClick,loading,disabled,label="검색"}:{onClick:()=>void;loading:boolean;disabled:boolean;label?:string}) {
  return <button onClick={onClick} disabled={loading||disabled} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
    style={{background:"linear-gradient(135deg,var(--accent-gold),var(--accent-gold-dim))",color:"#fff"}}>{loading?"검색 중...":label}</button>;
}
function InfoCell({label,value}:{label:string;value:string}) {
  return <div><div className="text-[10px] mb-0.5" style={{color:"var(--text-muted)"}}>{label}</div><div className="text-xs font-medium" style={{color:"var(--text-secondary)"}}>{value}</div></div>;
}
function ErrorMsg({msg}:{msg:string}) {
  if (!msg) return null;
  return <div className="rounded-lg px-4 py-3 mb-4 text-sm" style={{background:"rgba(192,48,64,0.05)",border:"1px solid rgba(192,48,64,0.15)",color:"var(--accent-red)"}}>{msg}</div>;
}
function SkeletonList({count,h}:{count:number;h:number}) {
  return <div className="space-y-2">{[...Array(count)].map((_,i)=><div key={i} className="skeleton w-full" style={{height:`${h*4}px`}}/>)}</div>;
}
function Empty({msg}:{msg:string}) {
  return <div className="py-14 text-center"><p className="text-sm" style={{color:"var(--text-muted)"}}>{msg}</p></div>;
}
