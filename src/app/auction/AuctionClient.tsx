"use client";

import { useState, useCallback, useEffect } from "react";
import {
  AuctionItem, AuctionSearchResponse, PopularItem,
  AlertRule, AlertRegisterResponse, AlertListResponse,
} from "@/lib/types";
import { getRarityColor, getRarityBg, formatGold, formatFullGold, validateEmail, formatDate } from "@/lib/utils";
import {
  Card, Btn, ItemImg, InfoCell, ErrorMsg, SkeletonList, Empty,
  AutocompleteSearch, SearchHelpers, PopularCards, addRecent, extractRows,
  formatPriceInput, parsePriceInput, MAX_ALERT_PRICE,
} from "@/components/shared";

const ALERT_GUIDE_SECTIONS = [
  {
    num: "1",
    title: "알림은 '기다림'을 대신해 줍니다",
    subtitle: "경매장을 계속 들여다볼 필요가 없습니다",
    tips: [
      {
        text: "원하는 아이템을 싸게 사고 싶을 때, 보통은 경매장을 수시로 새로고침하며 급매가 뜨길 기다립니다.",
        sub: "시세 알림은 이 기다림을 대신해 줍니다. 목표 가격을 한 번 등록해 두면, 그 가격에 도달했을 때 이메일로 알려줍니다.",
      },
      {
        text: "로그인도 앱 설치도 필요 없이 이메일 주소만으로 등록할 수 있습니다.",
        sub: "조건이 충족되어 한 번 발송되면 자동으로 종료됩니다. 매번 확인하지 않아도 기회를 놓치지 않게 해 주는 기능입니다.",
      },
    ],
  },
  {
    num: "2",
    title: "목표가는 이렇게 잡으세요",
    subtitle: "현실적인 숫자라야 알림이 의미가 있습니다",
    tips: [
      {
        text: "목표 가격은 막연한 희망 가격이 아니라 실거래가를 기준으로 잡아야 합니다.",
        sub: "알림을 걸기 전에 시세 검색에서 최근 평균 체결가를 먼저 확인하세요.",
      },
      {
        text: "시세보다 지나치게 낮게 잡으면 그 가격은 영영 오지 않아 알림이 무의미해집니다.",
        sub: "너무 높게 잡으면 굳이 알림을 걸 이유가 없습니다. 평소 시세보다 한두 단계 낮은, 가끔 급매로 등장할 법한 가격대를 노리는 것이 가장 효과적입니다. 시세 흐름이 하락세인 아이템이라면, 바닥으로 예상되는 지점에 걸어두고 기다리는 전략도 좋습니다.",
      },
    ],
  },
  {
    num: "3",
    title: "이런 상황에 쓰면 좋습니다",
    subtitle: "알림 활용 시나리오",
    tips: [
      {
        text: "비싼 아이템을 급매로 줍고 싶을 때",
        sub: "종결템처럼 단가가 높은 아이템은 가끔 시세보다 크게 싼 급매가 올라옵니다. 목표가를 걸어두면 그 순간을 놓치지 않습니다.",
      },
      {
        text: "재료를 바닥에서 사고 싶을 때",
        sub: "강화권·증폭권은 증폭 시즌(보통 1월, 방학 이벤트) 전후로 가격이 크게 움직입니다. 시즌 전 저점에 알림을 걸어두면 미리 재료를 확보할 수 있습니다.",
      },
      {
        text: "시즌이 바뀌길 기다릴 때",
        sub: "마법부여 카드는 다음 시즌 예고가 뜨면 가격이 빠집니다. 사고 싶은 카드의 하락한 목표가를 미리 걸어두는 식으로 활용할 수 있습니다.",
      },
    ],
  },
  {
    num: "4",
    title: "자주 묻는 질문 (FAQ)",
    tips: [
      {
        text: "Q. 알림을 등록했는데 메일이 오지 않습니다.",
        sub: "아직 목표 가격에 도달하지 않았거나, 메일이 스팸함으로 분류됐을 수 있습니다. 스팸함을 먼저 확인해 보시고, 도메인을 수신 허용으로 등록해 두면 안정적으로 받을 수 있습니다. 알림은 조건 충족 시 1회만 발송된다는 점도 참고하세요.",
      },
      {
        text: "Q. 알림은 몇 개까지 등록할 수 있나요?",
        sub: "스팸 방지를 위해 이메일당 최대 3개까지 등록할 수 있습니다. 또한 동일한 조건의 알림은 중복으로 등록되지 않습니다.",
      },
      {
        text: "Q. 등록하려는데 자꾸 막힙니다.",
        sub: "짧은 시간에 너무 많이 요청하면 일시적으로 제한될 수 있습니다(이메일·IP별 시간당 요청 제한). 잠시 후 다시 시도해 주세요. 같은 조건을 이미 등록해 둔 경우에도 중복 등록이 막힙니다.",
      },
      {
        text: "Q. 등록한 알림을 취소할 수 있나요?",
        sub: "등록한 이메일로 알림을 조회하고 삭제할 수 있습니다. 더 이상 필요 없는 알림은 직접 삭제하거나, 조건이 충족되면 자동으로 종료되도록 두면 됩니다.",
      },
      {
        text: "Q. 로그인 없이 이메일만 쓰는데 안전한가요?",
        sub: "알림 발송 용도로만 이메일 주소를 사용하며, 비밀번호 같은 민감한 정보는 받지 않습니다. 알림이 한 번 발송되면 해당 등록은 자동으로 종료됩니다.",
      },
    ],
  },
];

function AuctionRow({ item }: { item: AuctionItem }) {
  const [open, setOpen] = useState(false);
  const upgrade = (item as any).upgrade;
  const upgradeMax = (item as any).upgradeMax;
  return (
    <div className="card" style={{ padding: "12px 16px", cursor: "pointer", borderColor: open ? "var(--color-primary)" : undefined, transition: "border-color 0.15s" }} onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ItemImg itemId={item.itemId} itemName={item.itemName} rarity={item.itemRarity} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: getRarityColor(item.itemRarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.reinforce > 0 && <span style={{ color: "var(--color-accent-dim)" }}>+{item.reinforce} </span>}
            {item.itemName}
            {item.refine > 0 && <span style={{ marginLeft: 4, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--color-primary-light)", color: "var(--color-primary)" }}>제련 {item.refine}</span>}
            {upgrade != null && upgradeMax != null && upgradeMax > 0 && <span style={{ marginLeft: 4, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--color-accent-light)", color: "var(--color-accent)" }}>{upgrade}성/{upgradeMax}성</span>}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 8 }}>
            <span>Lv.{item.itemAvailableLevel}</span>
            <span style={{ color: getRarityColor(item.itemRarity) }}>{item.itemRarity}</span>
            <span>{item.itemType}</span>
            {item.count > 1 && <span>x{item.count}</span>}
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
          {upgrade != null && <InfoCell label="업그레이드" value={`${upgrade} / ${upgradeMax}`} />}
        </div>
      )}
    </div>
  );
}

function AlertGuide() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {ALERT_GUIDE_SECTIONS.map((section) => (
        <div
          key={section.num}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{
            background: "var(--bg-primary)",
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.5 }}>
              섹션 {section.num} — {section.title}
            </span>
            {section.subtitle && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)", lineHeight: 1.5 }}>
                {section.subtitle}
              </span>
            )}
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {section.tips.map((tip, ti) => (
              <div key={ti} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--color-primary)",
                  flexShrink: 0, marginTop: 6,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.6 }}>{tip.text}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.7 }}>{tip.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ═══ 시세 알림 섹션 (AlertClient 전체 이동) ═══ */
function AlertSection() {
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

  const [recommendedPrices, setRecommendedPrices] = useState<Record<string, { lowestPrice: number; count: number; loading: boolean; itemId: string; itemRarity: string }>>({
    "PC방 토큰 교환권": { lowestPrice: 0, count: 0, loading: true, itemId: "", itemRarity: "" },
    "피로 회복의 영약": { lowestPrice: 0, count: 0, loading: true, itemId: "", itemRarity: "" },
  });

  useEffect(() => { fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {}); }, []);

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

  const register = useCallback(async () => {
    setAlertMsg(""); setAlertError("");
    if (!alertEmail || !alertItem || !alertPrice) { setAlertError("모든 항목을 입력해주세요."); return; }
    if (!validateEmail(alertEmail)) { setAlertError("올바른 이메일 주소를 입력해주세요."); return; }
    setAlertLoading(true);
    try {
      const res = await fetch("/api/alert-register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: alertEmail, itemName: alertItem.trim(), targetPrice: Number(alertPrice), condition: alertCondition }) });
      const data: AlertRegisterResponse = await res.json();
      if (data.success) { setAlertMsg(data.message); setAlertItem(""); setAlertPrice(""); } else setAlertError(data.message);
    } catch { setAlertError("서버 연결에 실패했습니다."); }
    finally { setAlertLoading(false); }
  }, [alertEmail, alertItem, alertPrice, alertCondition]);

  const lookup = useCallback(async () => {
    if (!myEmail || !validateEmail(myEmail)) return;
    setMyAlertsLoading(true);
    try { const r = await fetch(`/api/alert?email=${encodeURIComponent(myEmail)}`); const d: AlertListResponse = await r.json(); setMyAlerts(d.rules || []); }
    catch { setMyAlerts([]); }
    finally { setMyAlertsLoading(false); }
  }, [myEmail]);

  const del = useCallback(async (id: string) => {
    await fetch("/api/alert", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, email: myEmail }) });
    lookup();
  }, [myEmail, lookup]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 알림 등록 */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>시세 알림 등록</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>목표 가격에 도달하면 이메일로 알려드립니다 · 1회 발송 후 자동 종료</p>
        <div style={{ marginBottom: 12 }}>
          <input type="email" value={alertEmail} onChange={e => setAlertEmail(e.target.value)} placeholder="이메일 주소" className="input-base" style={{ marginBottom: 12 }} />
          <AutocompleteSearch query={alertItem} setQuery={setAlertItem} onSearch={() => {}} loading={false} placeholder="아이템 이름 (예: 골고라이언, 리노, 패키지...)" buttonLabel="" />
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <select value={alertCondition} onChange={e => setAlertCondition(e.target.value as any)} className="input-base" style={{ width: "auto" }}>
            <option value="below">이하로 떨어지면</option>
            <option value="above">이상으로 오르면</option>
          </select>
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

      {/* 내 알림 조회 */}
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

      <AlertGuide />

      {/* ═══ 업데이트 영향 분석 ═══ */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>업데이트 영향 분석</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>천해천 패치 · 시장 영향 리포트</div>
          </div>
          <div style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 99, background: "var(--bg-primary)", border: "1px solid var(--border-color)", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.02em" }}>HOT</div>
        </div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, borderLeft: "3px solid var(--color-primary)" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>이번 <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>천해천 업데이트</span>로...</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, marginTop: 6 }}>특히 <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>던전 플레이에서 사용되는 아이템</span>의 소비량이 빠르게 증가하고 있습니다.</p>
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
              <div key={item.name} style={{ flex: "1 1 200px", background: "var(--bg-card)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--border-color)", transition: "all 0.2s", cursor: "pointer" }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-color)"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  {priceData?.loading ? (<div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} className="skeleton" />) : (<ItemImg itemId={priceData?.itemId || ""} itemName={item.name} rarity={priceData?.itemRarity} size={40} />)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3, padding: "2px 8px", borderRadius: 99, background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>{item.tag}</span>
                    </div>
                  </div>
                </div>
                <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>경매장 최저가</div>
                  {priceData?.loading ? (<div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-secondary)" }}>조회 중...</div>) : priceData?.lowestPrice ? (<div style={{ display: "flex", alignItems: "baseline", gap: 4 }}><span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{formatGold(priceData.lowestPrice)}</span><span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>골드</span></div>) : (<div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>매물 없음</div>)}
                  {priceData && !priceData.loading && priceData.count > 0 && (<div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>등록 매물 {priceData.count}건+</div>)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background: "var(--bg-primary)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border-color)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>지금 가격은 이미 <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>상승 초입 구간</span>으로, 단기적으로 추가 상승 가능성이 있는 구간입니다.</p>
        </div>
      </Card>

      {/* 인기 검색 아이템 */}
      {popular.length > 0 && (
        <section>
          <div className="section-title">🔥 인기 검색 아이템</div>
          <PopularCards items={popular} onSelect={n => { setAlertItem(n); window.scrollTo({ top: document.getElementById("alert-section-top")?.offsetTop || 0, behavior: "smooth" }); }} />
        </section>
      )}
    </div>
  );
}

/* ═══ 메인 컴포넌트 ═══ */
export default function AuctionClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [popular, setPopular] = useState<PopularItem[]>([]);

  const SERA_SHOP_PRICE = 36800;
  const GOLD_TO_WON = 0.001;

  const [pkgData, setPkgData] = useState<{
    loading: boolean; lowestPrice: number; itemId: string; itemRarity: string; count: number;
  }>({ loading: true, lowestPrice: 0, itemId: "", itemRarity: "", count: 0 });

  useEffect(() => {
    fetch("/api/popular-items").then(r => r.json()).then(d => setPopular(d.items || [])).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/auction?itemName=${encodeURIComponent("숲속의 유랑악단 패키지")}&wordType=match&limit=10`);
        const data = await res.json();
        const rows = data.rows || [];
        if (rows.length > 0) {
          setPkgData({ loading: false, lowestPrice: rows[0].unitPrice || 0, itemId: rows[0].itemId || "", itemRarity: rows[0].itemRarity || "", count: rows.length });
        } else { setPkgData(prev => ({ ...prev, loading: false })); }
      } catch { setPkgData(prev => ({ ...prev, loading: false })); }
    })();
  }, []);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSearched(true);
    addRecent(query.trim());
    try {
      const res = await fetch(`/api/auction?itemName=${encodeURIComponent(query.trim())}&wordType=match&limit=400`);
      const data: AuctionSearchResponse = await res.json();
      if (!res.ok || data.error) { setError(data.error?.message || `오류`); setResults([]); }
      else { const allRows = [...(data.rows || [])]; allRows.sort((a, b) => a.unitPrice - b.unitPrice); setResults(allRows); }
    } catch { setError("서버 연결에 실패했습니다."); setResults([]); }
    finally { setLoading(false); }
  }, [query]);

  const cashEquivalent = pkgData.lowestPrice > 0 ? Math.round(pkgData.lowestPrice * GOLD_TO_WON) : 0;
  const priceDiff = SERA_SHOP_PRICE - cashEquivalent;
  const isBuyNow = cashEquivalent < SERA_SHOP_PRICE;
  const savingsPercent = SERA_SHOP_PRICE > 0 ? Math.round((priceDiff / SERA_SHOP_PRICE) * 100) : 0;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>현재 경매장 등록 아이템을 검색합니다. 개당 가격 낮은 순으로 정렬됩니다.</p>
        <AutocompleteSearch query={query} setQuery={setQuery} onSearch={search} loading={loading} placeholder="아이템 이름 (예: 골고라이언, 리노, 패키지...)" />
      </Card>

      {/* ═══ 숲속의 유랑악단 패키지 카드 ═══ */}
      {!searched && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: "22px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>패키지 구매 가이드</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>경매장 vs 세라샵 가격 비교</div>
            </div>
            <div style={{ padding: "3px 10px", borderRadius: 99, background: "var(--bg-primary)", border: "1px solid var(--border-color)", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)" }}>GUIDE</div>
          </div>
          <div style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, borderLeft: "3px solid var(--color-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>언제 사는 게 이득인가요?</span>
          </div>
          <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: "16px", border: "1px solid var(--border-color)", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              {pkgData.loading ? (<div className="skeleton" style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0 }} />) : (<ItemImg itemId={pkgData.itemId} itemName="숲속의 유랑악단 패키지" rarity={pkgData.itemRarity} size={52} />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>숲속의 유랑악단 패키지</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {pkgData.itemRarity && (<span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)", fontWeight: 600 }}>{pkgData.itemRarity}</span>)}
                  {pkgData.count > 0 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>등록 {pkgData.count}건+</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>경매장 최저가</div>
                {pkgData.loading ? (<div className="skeleton" style={{ height: 22, borderRadius: 4 }} />) : pkgData.lowestPrice > 0 ? (<><div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{formatGold(pkgData.lowestPrice)}</div><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>골드</div></>) : (<div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>매물 없음</div>)}
              </div>
              <div style={{ flex: 1, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>현금 환산가</div>
                {pkgData.loading ? (<div className="skeleton" style={{ height: 22, borderRadius: 4 }} />) : cashEquivalent > 0 ? (<><div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{cashEquivalent.toLocaleString()}</div><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>원 (1백만G = 1,000원)</div></>) : (<div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>—</div>)}
              </div>
            </div>
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 10, color: "var(--text-muted)" }}>세라샵 판매가</div><div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{SERA_SHOP_PRICE.toLocaleString()}원</div></div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 10px", borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>공식 가격</div>
            </div>
          </div>
          {!pkgData.loading && pkgData.lowestPrice > 0 && (
            <div style={{ borderRadius: 12, padding: "14px 16px", marginBottom: 12, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{isBuyNow ? "✅" : "⛔"}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{isBuyNow ? "경매장에서 사면 이득!" : "지금 사면 손해입니다"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, fontWeight: 500 }}>{isBuyNow ? `세라샵보다 ${priceDiff.toLocaleString()}원 저렴 (${savingsPercent}% 절약)` : `세라샵보다 ${Math.abs(priceDiff).toLocaleString()}원 비쌈`}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, borderRadius: 8, padding: "10px 12px", background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>경매장 (현금 환산)</div><div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{cashEquivalent.toLocaleString()}원</div></div>
                <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)", fontSize: 16, fontWeight: 300 }}>vs</div>
                <div style={{ flex: 1, textAlign: "right" }}><div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>세라샵</div><div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{SERA_SHOP_PRICE.toLocaleString()}원</div></div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.6 }}>현금 환산 기준: <span style={{ color: "var(--text-secondary)" }}>1,000,000 골드 = 1,000원</span> · 시세는 실시간 변동됩니다.<br />패키지 내 아이템 개별 가치에 따라 실제 이득 여부는 달라질 수 있습니다.</div>
          </div>
        </div>
      )}

      {!searched && <SearchHelpers popular={popular} onSelect={n => setQuery(n)} />}
      <ErrorMsg msg={error} />
      {loading && <SkeletonList count={5} />}
      {!loading && results.length > 0 && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{results.length}건 · 개당 가격 낮은 순</p>
          {results.length >= 750 && (
            <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 8, fontSize: 11, background: "var(--color-accent-light)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}>⚠ 등록 매물이 많아 일부만 표시됩니다.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((item, i) => <AuctionRow key={`${item.auctionNo}-${i}`} item={item} />)}
          </div>
        </div>
      )}
      {!loading && searched && !results.length && !error && <Empty msg="검색 결과가 없습니다." />}

      {/* ═══ 시세 알림 섹션 ═══ */}
      <div id="alert-section-top" style={{ marginTop: 8, borderTop: "1px solid var(--border-color)", paddingTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>시세 알림</h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          원하는 아이템의 목표 가격을 설정하면, 해당 가격에 도달했을 때 이메일로 알려드립니다. 로그인 없이 이메일만으로 등록할 수 있으며, 1회 발송 후 자동으로 종료됩니다.
        </p>
        <AlertSection />
      </div>
    </div>
  );
}
