"use client";

import { useState, useCallback, useEffect } from "react";
import {
  PopularItem, AlertRule, AlertRegisterResponse, AlertListResponse,
} from "@/lib/types";
import { getRarityColor, formatGold, validateEmail } from "@/lib/utils";
import {
  Card, Btn, ItemImg, AutocompleteSearch, PopularCards,
  formatPriceInput, parsePriceInput, MAX_ALERT_PRICE,
} from "@/components/shared";

export default function AlertClient() {
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [alertEmail, setAlertEmail] = useState(""); const [alertItem, setAlertItem] = useState("");
  const [alertPrice, setAlertPrice] = useState(""); const [alertCondition, setAlertCondition] = useState<"below"|"above">("below");
  const [alertMsg, setAlertMsg] = useState(""); const [alertError, setAlertError] = useState(""); const [alertLoading, setAlertLoading] = useState(false);
  const [myEmail, setMyEmail] = useState(""); const [myAlerts, setMyAlerts] = useState<AlertRule[]>([]); const [myAlertsLoading, setMyAlertsLoading] = useState(false);

  // ── 추천 아이템 시세 (itemId 포함) ──
  const [recommendedPrices, setRecommendedPrices] = useState<Record<string, { lowestPrice: number; count: number; loading: boolean; itemId: string; itemRarity: string }>>({
    "PC방 토큰 교환권": { lowestPrice: 0, count: 0, loading: true, itemId: "", itemRarity: "" },
    "피로 회복의 영약": { lowestPrice: 0, count: 0, loading: true, itemId: "", itemRarity: "" },
  });

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

  // ── 추천 아이템 경매장 최저가 + itemId 조회 ──
  useEffect(() => {
    const items = ["PC방 토큰 교환권", "피로 회복의 영약"];
    items.forEach(async (itemName) => {
      try {
        const res = await fetch(`/api/auction?itemName=${encodeURIComponent(itemName)}&wordType=match&limit=10`);
        const data = await res.json();
        const rows = data.rows || [];
        if (rows.length > 0) {
          const lowestPrice = rows[0].unitPrice || 0;
          const itemId = rows[0].itemId || "";
          const itemRarity = rows[0].itemRarity || "";
          setRecommendedPrices(prev => ({ ...prev, [itemName]: { lowestPrice, count: rows.length, loading: false, itemId, itemRarity } }));
        } else {
          setRecommendedPrices(prev => ({ ...prev, [itemName]: { lowestPrice: 0, count: 0, loading: false, itemId: "", itemRarity: "" } }));
        }
      } catch {
        setRecommendedPrices(prev => ({ ...prev, [itemName]: { lowestPrice: 0, count: 0, loading: false, itemId: "", itemRarity: "" } }));
      }
    });
  }, []);

  const register = useCallback(async () => { setAlertMsg(""); setAlertError(""); if (!alertEmail || !alertItem || !alertPrice) { setAlertError("모든 항목을 입력해주세요."); return; } if (!validateEmail(alertEmail)) { setAlertError("올바른 이메일 주소를 입력해주세요."); return; } setAlertLoading(true); try { const res = await fetch("/api/alert-register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: alertEmail, itemName: alertItem.trim(), targetPrice: Number(alertPrice), condition: alertCondition }) }); const data: AlertRegisterResponse = await res.json(); if (data.success) { setAlertMsg(data.message); setAlertItem(""); setAlertPrice(""); } else setAlertError(data.message); } catch { setAlertError("서버 연결에 실패했습니다."); } finally { setAlertLoading(false); } }, [alertEmail, alertItem, alertPrice, alertCondition]);
  const lookup = useCallback(async () => { if (!myEmail || !validateEmail(myEmail)) return; setMyAlertsLoading(true); try { const r = await fetch(`/api/alert?email=${encodeURIComponent(myEmail)}`); const d: AlertListResponse = await r.json(); setMyAlerts(d.rules || []); } catch { setMyAlerts([]); } finally { setMyAlertsLoading(false); } }, [myEmail]);
  const del = useCallback(async (id: string) => { await fetch("/api/alert", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, email: myEmail }) }); lookup(); }, [myEmail, lookup]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>시세 알림 등록</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>목표 가격에 도달하면 이메일로 알려드립니다 · 1회 발송 후 자동 종료</p>
        <div style={{ marginBottom: 12 }}>
          <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="이메일 주소" className="input-base" style={{ marginBottom: 12 }} />
          <AutocompleteSearch query={alertItem} setQuery={setAlertItem} onSearch={() => {}} loading={false} placeholder="아이템 이름 (예: 골고라이언, 리노, 패키지...)" buttonLabel="" />
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <select value={alertCondition} onChange={e => setAlertCondition(e.target.value as any)} className="input-base" style={{ width: "auto" }}><option value="below">이하로 떨어지면</option><option value="above">이상으로 오르면</option></select>
          <div style={{ flex: 1, position: "relative" }}>
            <input type="text" inputMode="numeric" value={alertPrice ? formatPriceInput(alertPrice) : ""} onChange={e => { const raw = parsePriceInput(e.target.value); if (raw === "" || Number(raw) <= MAX_ALERT_PRICE) { setAlertPrice(raw); } }} placeholder="목표 가격" className="input-base" style={{ paddingRight: 36 }} />
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-muted)", pointerEvents: "none" }}>원</span>
          </div>
          <Btn onClick={register} loading={alertLoading} disabled={false} label="알림 등록" />
        </div>
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 12 }}>최대 {MAX_ALERT_PRICE.toLocaleString()}골드까지 입력할 수 있습니다</p>
        {alertMsg && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#F0FDF4", color: "var(--color-success)", border: "1px solid #BBF7D0" }}>{alertMsg}</div>}
        {alertError && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#FEF2F2", color: "var(--color-danger)", border: "1px solid #FECACA" }}>{alertError}</div>}
      </Card>
      <Card>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>내 알림 조회</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input type="email" value={myEmail} onChange={e => setMyEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} placeholder="등록한 이메일" className="input-base" style={{ flex: 1 }} /><Btn onClick={lookup} loading={myAlertsLoading} disabled={!myEmail} label="조회" variant="secondary" /></div>
        {myAlerts.length > 0 && (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{myAlerts.map(a => (<div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", fontSize: 12 }}><div style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.itemName}</span><span style={{ marginLeft: 8, color: "var(--text-muted)" }}>{formatGold(a.targetPrice)} {a.condition === "below" ? "이하" : "이상"}</span></div><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600, background: a.fulfilled ? "#F0FDF4" : "var(--color-primary-light)", color: a.fulfilled ? "var(--color-success)" : "var(--color-primary)" }}>{a.fulfilled ? "완료" : "대기중"}</span>{!a.fulfilled && <button onClick={() => del(a.id)} style={{ fontSize: 10, color: "var(--color-danger)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>삭제</button>}</div>))}</div>)}
      </Card>

      {/* ═══ 천해천 업데이트 영향 분석 ═══ */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "24px 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,119,6,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, position: "relative" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #D97706, #F59E0B)", flexShrink: 0 }} />
          <div><div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>업데이트 영향 분석</div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>천해천 패치 · 시장 영향 리포트</div></div>
          <div style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 99, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 10, fontWeight: 700, color: "#F87171", letterSpacing: "0.02em" }}>HOT</div>
        </div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, borderLeft: "3px solid #D97706" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>이번 <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>천해천 업데이트</span>로...</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, marginTop: 6 }}>특히 <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>던전 플레이에서 사용되는 아이템</span>의 소비량이 빠르게 증가하고 있습니다.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>주목 아이템</div>
          <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { name: "PC방 토큰 교환권", tag: "소비량 증가" },
            { name: "피로 회복의 영약", tag: "소비량 증가" },
          ].map((item) => {
            const priceData = recommendedPrices[item.name];
            return (
              <div key={item.name} style={{ flex: "1 1 200px", background: "var(--bg-primary)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--border-color)", transition: "all 0.2s", cursor: "pointer" }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "var(--color-primary-light)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  {priceData?.loading ? (<div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} className="skeleton" />) : (<ItemImg itemId={priceData?.itemId || ""} itemName={item.name} rarity={priceData?.itemRarity} size={40} />)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3, padding: "2px 8px", borderRadius: 99, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#EF4444", animation: "pulse 2s infinite" }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#FCA5A5" }}>{item.tag}</span>
                    </div>
                  </div>
                </div>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "#64748B", marginBottom: 4 }}>경매장 최저가</div>
                  {priceData?.loading ? (<div style={{ fontSize: 16, fontWeight: 800, color: "#475569" }}>조회 중...</div>) : priceData?.lowestPrice ? (<div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span style={{ fontSize: 18, fontWeight: 800, color: "#F59E0B", letterSpacing: "-0.02em" }}>{formatGold(priceData.lowestPrice)}</span><span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>골드</span></div>) : (<div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>매물 없음</div>)}
                  {priceData && !priceData.loading && priceData.count > 0 && (<div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>등록 매물 {priceData.count}건+</div>)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background: "rgba(37,99,235,0.08)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(37,99,235,0.15)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <p style={{ fontSize: 11, color: "#93C5FD", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>지금 가격은 이미 <span style={{ color: "#FDE68A", fontWeight: 700 }}>상승 초입 구간</span>으로, 단기적으로 추가 상승 가능성이 있는 구간입니다.</p>
        </div>
      </div>

      {popular.length > 0 && (<section><div className="section-title">🔥 인기 검색 아이템</div><PopularCards items={popular} onSelect={n => { setAlertItem(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} /></section>)}
    </div>
  );
}