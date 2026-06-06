import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSub } from "../hooks/useSub";
import { supabase } from "../lib/supabase";

const FF = "'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

const PLAN_DEFS = {
  individual: {
    id: "individual",
    icon: "🏢",
    label: "개인 업체",
    subtitle: "직접 고용지원금을 관리하는 사업주·담당자",
    colorBase: "#2563EB",
    colorLight: "#DBEAFE",
    colorBg: "#EFF6FF",
    badge: "소규모 사업장 최적",
    monthly: {
      id: "individual_monthly",
      price: 9900,
      label: "월간",
      desc: "언제든 해지 가능",
      priceId: import.meta.env.VITE_STRIPE_PRICE_IND_MONTHLY || "price_ind_monthly",
    },
    annual: {
      id: "individual_annual",
      price: 99000,
      label: "연간",
      desc: "2개월 무료 · 약 17% 절약",
      priceId: import.meta.env.VITE_STRIPE_PRICE_IND_ANNUAL || "price_ind_annual",
    },
    features: [
      { ok: true,  text: "업체 1개 관리" },
      { ok: true,  text: "직원 · 회차 무제한" },
      { ok: true,  text: "2026년 지원금 15종 안내" },
      { ok: true,  text: "D-Day 알림 + 신청 일정 캘린더" },
      { ok: true,  text: "급여 계산기 (4대보험 · 실수령액)" },
      { ok: true,  text: "채용 적합 진단" },
      { ok: true,  text: "파일 첨부 (클라우드 저장)" },
      { ok: true,  text: "업무 일지 + 현황 보고서" },
      { ok: false, text: "복수 업체 관리", note: "전문가 플랜" },
      { ok: false, text: "수수료 정산서 자동 생성", note: "전문가 플랜" },
      { ok: false, text: "팀원 초대 · 역할 관리", note: "전문가 플랜" },
    ],
  },
  agency: {
    id: "agency",
    icon: "⚖️",
    label: "전문가",
    subtitle: "여러 고객사를 담당하는 노무사 · 컨설팅 사무소",
    colorBase: "#7C3AED",
    colorLight: "#DDD6FE",
    colorBg: "#F5F3FF",
    badge: "노무사 · HR 컨설턴트 추천",
    monthly: {
      id: "agency_monthly",
      price: 49000,
      label: "월간",
      desc: "언제든 해지 가능",
      priceId: import.meta.env.VITE_STRIPE_PRICE_AGY_MONTHLY || "price_agy_monthly",
    },
    annual: {
      id: "agency_annual",
      price: 490000,
      label: "연간",
      desc: "2개월 무료 · 약 17% 절약",
      priceId: import.meta.env.VITE_STRIPE_PRICE_AGY_ANNUAL || "price_agy_annual",
    },
    features: [
      { ok: true, text: "업체 · 직원 · 회차 무제한" },
      { ok: true, text: "2026년 지원금 15종 안내" },
      { ok: true, text: "D-Day 알림 + 신청 일정 캘린더" },
      { ok: true, text: "급여 계산기 (4대보험 · 실수령액)" },
      { ok: true, text: "채용 적합 진단" },
      { ok: true, text: "파일 첨부 (클라우드 저장)" },
      { ok: true, text: "업무 일지 + 현황 보고서" },
      { ok: true, text: "수수료 정산서 자동 생성" },
      { ok: true, text: "팀원 초대 · 역할 관리 (owner/admin/member)" },
      { ok: true, text: "실시간 팀 동기화 (Realtime)" },
      { ok: true, text: "칸반 보드 + 진행 현황 대시보드" },
    ],
  },
};

const COMPARE_ROWS = [
  ["업체 관리",        "1개",    "무제한"],
  ["직원 · 회차",      "무제한", "무제한"],
  ["지원금 15종",      true,     true],
  ["D-Day 알림",       true,     true],
  ["급여 계산기",      true,     true],
  ["파일 첨부",        true,     true],
  ["현황 보고서",      true,     true],
  ["수수료 정산서",    false,    true],
  ["팀원 초대",        false,    true],
  ["실시간 동기화",    false,    true],
];

function CellVal({ v }) {
  if (v === true)  return <span style={{ color: "#059669", fontSize: 16 }}>✅</span>;
  if (v === false) return <span style={{ color: "#CBD5E1", fontSize: 15 }}>—</span>;
  return <span style={{ fontWeight: 600, color: "#475569" }}>{v}</span>;
}

export default function BillingPage({ onBack }) {
  const { org, profile, signOut } = useAuth();
  const { sub, trialDaysLeft } = useSub(org?.id);
  const [loading, setLoading] = useState(null);
  const [planType, setPlanType] = useState("individual");
  const [period, setPeriod] = useState("annual");

  const def = PLAN_DEFS[planType];
  const selectedPlan = period === "annual" ? def.annual : def.monthly;
  const monthlyEquiv = Math.round(def.annual.price / 12);
  const isActive = sub?.status === "active";
  const isExpired = sub && sub.status !== "active" && sub.status !== "trialing";

  async function handleCheckout() {
    setLoading("checkout");
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          priceId: selectedPlan.priceId,
          orgId: org.id,
          planType,
          successUrl: window.location.origin + "/?checkout=success",
          cancelUrl: window.location.origin + "/billing",
        },
      });
      if (error) throw error;
      window.location.href = data.url;
    } catch (err) {
      alert("결제 페이지 연결 실패: " + err.message);
    }
    setLoading(null);
  }

  async function handlePortal() {
    setLoading("portal");
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: { orgId: org.id, returnUrl: window.location.origin },
      });
      if (error) throw error;
      window.location.href = data.url;
    } catch (err) {
      alert("포털 연결 실패: " + err.message);
    }
    setLoading(null);
  }

  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "#F8FAFC", padding: "24px 16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        {/* Top nav */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          {onBack
            ? <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: FF }}>← 앱으로 돌아가기</button>
            : <span />}
          <button onClick={signOut} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 13, cursor: "pointer", fontFamily: FF }}>로그아웃</button>
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>📋</div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, color: "#1E293B", letterSpacing: "-0.5px" }}>고용지원금 매니저 Pro</h1>
          <p style={{ margin: 0, color: "#64748B", fontSize: 15 }}>
            {profile?.display_name ? `${profile.display_name}님 · ` : ""}{org?.name}
          </p>
        </div>

        {/* Trial Banner */}
        {sub?.status === "trialing" && trialDaysLeft !== null && (
          <div style={{ padding: "14px 20px", background: trialDaysLeft <= 3 ? "#FEF2F2" : "#FFFBEB", border: `1px solid ${trialDaysLeft <= 3 ? "#FECACA" : "#FDE68A"}`, borderRadius: 12, marginBottom: 24, textAlign: "center", fontSize: 14, color: trialDaysLeft <= 3 ? "#DC2626" : "#92400E", fontWeight: 600 }}>
            {trialDaysLeft <= 0
              ? "⚠️ 무료 체험이 종료되었습니다. 구독을 시작해주세요."
              : `⏳ 무료 체험 ${trialDaysLeft}일 남음 — 체험 종료 전에 구독하면 중단 없이 사용 가능합니다.`}
          </div>
        )}

        {/* Active Banner */}
        {isActive && (
          <div style={{ padding: "16px 20px", background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 12, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 14, color: "#059669", fontWeight: 600 }}>
              ✅ 구독 활성 중 · 다음 결제일: {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("ko-KR") : "-"}
              {sub.plan_type === "agency" && <span style={{ marginLeft: 8, background: "#7C3AED", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>전문가 플랜</span>}
              {sub.plan_type === "individual" && <span style={{ marginLeft: 8, background: "#2563EB", color: "#fff", fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>개인 업체 플랜</span>}
            </div>
            <button onClick={handlePortal} disabled={!!loading}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #6EE7B7", background: "#fff", color: "#059669", fontSize: 13, cursor: "pointer", fontWeight: 600, fontFamily: FF }}>
              {loading === "portal" ? "..." : "결제 관리 / 플랜 변경"}
            </button>
          </div>
        )}

        {isExpired && (
          <div style={{ padding: "14px 20px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 12, marginBottom: 24, textAlign: "center", fontSize: 14, color: "#DC2626", fontWeight: 600 }}>
            ❌ 구독이 만료되었습니다. 아래에서 플랜을 선택해 재개하세요.
          </div>
        )}

        {/* Pricing UI — hide if already active */}
        {!isActive && (
          <>
            {/* STEP 1: plan type */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", marginBottom: 12 }}>STEP 1 · 사용 유형 선택</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {Object.values(PLAN_DEFS).map((d) => {
                  const on = planType === d.id;
                  return (
                    <button key={d.id} onClick={() => setPlanType(d.id)}
                      style={{ padding: "20px 18px", borderRadius: 16, border: `2px solid ${on ? d.colorBase : "#E2E8F0"}`, background: on ? d.colorBg : "#fff", cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontFamily: FF, boxShadow: on ? `0 4px 20px ${d.colorBase}22` : "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: 26, marginBottom: 10 }}>{d.icon}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: on ? d.colorBase : "#1E293B", marginBottom: 5 }}>{d.label}</div>
                      <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 10 }}>{d.subtitle}</div>
                      {on && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: d.colorBase, background: d.colorLight, display: "inline-block", padding: "3px 10px", borderRadius: 20 }}>{d.badge}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: billing period */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", marginBottom: 12 }}>STEP 2 · 결제 주기</div>
              <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 12, padding: 4, gap: 4 }}>
                {[["monthly", "월간 결제", null], ["annual", "연간 결제", "17% 할인"]].map(([k, l, badge]) => {
                  const on = period === k;
                  return (
                    <button key={k} onClick={() => setPeriod(k)}
                      style={{ flex: 1, padding: "12px 16px", borderRadius: 9, border: "none", fontSize: 15, fontWeight: on ? 700 : 500, color: on ? def.colorBase : "#64748B", background: on ? "#fff" : "transparent", cursor: "pointer", fontFamily: FF, boxShadow: on ? "0 1px 6px rgba(0,0,0,0.10)" : "none", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {l}
                      {badge && on && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#D1FAE5", padding: "2px 7px", borderRadius: 8 }}>{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 3: checkout card */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", marginBottom: 12 }}>STEP 3 · 구독 시작</div>
              <div style={{ background: "#fff", borderRadius: 18, border: `2px solid ${def.colorBase}`, padding: "32px 28px 28px", boxShadow: `0 8px 40px ${def.colorBase}20`, position: "relative" }}>
                {/* badge */}
                <div style={{ position: "absolute", top: -14, left: 24, background: def.colorBase, color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 16px", borderRadius: 20 }}>
                  {def.icon} {def.label} · {period === "annual" ? "연간" : "월간"}
                </div>

                {/* price */}
                <div style={{ marginBottom: 20, marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 48, fontWeight: 800, color: def.colorBase, letterSpacing: "-2px", lineHeight: 1 }}>
                      ₩{selectedPlan.price.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 16, color: "#64748B", paddingBottom: 6 }}>/{period === "annual" ? "년" : "월"}</div>
                  </div>
                  {period === "annual" && (
                    <div style={{ fontSize: 14, color: "#64748B" }}>
                      → 월 환산 약 <strong style={{ color: def.colorBase }}>₩{monthlyEquiv.toLocaleString()}</strong> · 부가세(10%) 별도
                    </div>
                  )}
                  {period === "monthly" && <div style={{ fontSize: 13, color: "#64748B" }}>부가세(10%) 별도</div>}
                  <div style={{ marginTop: 4, fontSize: 13, color: "#059669", fontWeight: 600 }}>{selectedPlan.desc}</div>
                </div>

                {/* features grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", marginBottom: 28, padding: "20px", background: def.colorBg, borderRadius: 12 }}>
                  {def.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 13, color: f.ok ? "#1E293B" : "#94A3B8" }}>
                      <span style={{ flexShrink: 0, fontSize: 14 }}>{f.ok ? "✅" : "❌"}</span>
                      <span style={{ lineHeight: 1.5 }}>
                        {f.text}
                        {f.note && <span style={{ fontSize: 10, background: "#E2E8F0", color: "#64748B", borderRadius: 4, padding: "1px 5px", marginLeft: 4, verticalAlign: "middle" }}>{f.note}</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button onClick={handleCheckout} disabled={!!loading}
                  style={{ width: "100%", padding: "17px", borderRadius: 13, border: "none", fontSize: 17, fontWeight: 800, cursor: loading ? "wait" : "pointer", background: `linear-gradient(135deg, ${def.colorBase}dd, ${def.colorBase})`, color: "#fff", boxShadow: `0 6px 20px ${def.colorBase}44`, transition: "opacity 0.15s", opacity: loading ? 0.7 : 1, fontFamily: FF, letterSpacing: "-0.3px" }}>
                  {loading === "checkout" ? "결제 페이지 연결 중..." : `${def.label} ${period === "annual" ? "연간" : "월간"} 구독 시작 →`}
                </button>
                <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                  🔒 Stripe 보안 결제 · 카드 정보 저장 안 함 · 언제든 해지 가능
                </p>
              </div>
            </div>

            {/* Compare table */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", marginBottom: 32 }}>
              <div style={{ padding: "16px 20px", background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>📊 플랜 비교</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#FAFBFC" }}>
                    <th style={{ padding: "12px 18px", textAlign: "left", color: "#64748B", fontWeight: 600, fontSize: 13 }}>기능</th>
                    <th style={{ padding: "12px 18px", textAlign: "center", width: 140 }}>
                      <div style={{ color: "#2563EB", fontWeight: 800, fontSize: 14 }}>🏢 개인 업체</div>
                      <div style={{ color: "#64748B", fontSize: 12, fontWeight: 500 }}>₩9,900~/월</div>
                    </th>
                    <th style={{ padding: "12px 18px", textAlign: "center", width: 140 }}>
                      <div style={{ color: "#7C3AED", fontWeight: 800, fontSize: 14 }}>⚖️ 전문가</div>
                      <div style={{ color: "#64748B", fontSize: 12, fontWeight: 500 }}>₩49,000~/월</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map(([label, ind, agy], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                      <td style={{ padding: "11px 18px", color: "#475569", fontSize: 14 }}>{label}</td>
                      <td style={{ padding: "11px 18px", textAlign: "center" }}><CellVal v={ind} /></td>
                      <td style={{ padding: "11px 18px", textAlign: "center" }}><CellVal v={agy} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer note */}
        <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, lineHeight: 2.2 }}>
          <div>고용지원금 매니저 Pro · 사업자 세금계산서 발행 가능</div>
          <div>결제는 Stripe를 통해 안전하게 처리됩니다 · 구독 관련 문의: support@hrsubsidy.kr</div>
        </div>
      </div>
    </div>
  );
}
