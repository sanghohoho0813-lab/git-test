import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSub } from "../hooks/useSub";
import { supabase } from "../lib/supabase";

const FF = "'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

const PLANS = [
  {
    id: "monthly",
    label: "월간 구독",
    price: "₩29,000",
    period: "/월",
    desc: "언제든 해지 가능",
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_MONTHLY || "price_monthly_placeholder",
    highlight: false,
  },
  {
    id: "annual",
    label: "연간 구독",
    price: "₩290,000",
    period: "/년",
    desc: "2개월 무료 (17% 절약)",
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_ANNUAL || "price_annual_placeholder",
    highlight: true,
  },
];

export default function BillingPage({ onBack }) {
  const { org, profile, signOut } = useAuth();
  const { sub, trialDaysLeft } = useSub(org?.id);
  const [loading, setLoading] = useState(null);

  async function handleCheckout(plan) {
    setLoading(plan.id);
    try {
      // Supabase Edge Function을 통해 Stripe Checkout 세션 생성
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          priceId: plan.stripePriceId,
          orgId: org.id,
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

  const isExpired = sub && sub.status !== "active" && sub.status !== "trialing";

  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "#F8FAFC", padding: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 15, padding: "8px 0", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
            ← 앱으로 돌아가기
          </button>
        )}
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32, marginTop: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: "#1E293B" }}>고용지원금 매니저 Pro</h1>
          <p style={{ margin: 0, color: "#64748B", fontSize: 14 }}>
            {profile?.display_name && `안녕하세요, ${profile.display_name}님 · `}{org?.name}
          </p>
        </div>

        {/* Trial / Status Banner */}
        {sub?.status === "trialing" && trialDaysLeft !== null && (
          <div style={{ padding: "14px 20px", background: trialDaysLeft <= 3 ? "#FEF2F2" : "#FFFBEB", border: `1px solid ${trialDaysLeft <= 3 ? "#FECACA" : "#FDE68A"}`, borderRadius: 12, marginBottom: 24, textAlign: "center", fontSize: 14, color: trialDaysLeft <= 3 ? "#DC2626" : "#92400E", fontWeight: 600 }}>
            {trialDaysLeft <= 0
              ? "⚠️ 무료 체험이 종료되었습니다. 구독을 시작해주세요."
              : `⏳ 무료 체험 ${trialDaysLeft}일 남음 — 체험 종료 전에 구독을 시작하면 중단 없이 사용 가능합니다.`}
          </div>
        )}

        {sub?.status === "active" && (
          <div style={{ padding: "14px 20px", background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 12, marginBottom: 24, textAlign: "center", fontSize: 14, color: "#059669", fontWeight: 600 }}>
            ✅ 구독 활성 중 · 다음 결제일: {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("ko-KR") : "-"}
            <button onClick={handlePortal} style={{ marginLeft: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid #6EE7B7", background: "#fff", color: "#059669", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
              {loading === "portal" ? "..." : "결제 관리"}
            </button>
          </div>
        )}

        {isExpired && (
          <div style={{ padding: "14px 20px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 12, marginBottom: 24, textAlign: "center", fontSize: 14, color: "#DC2626", fontWeight: 600 }}>
            ❌ 구독이 만료되었습니다. 아래에서 플랜을 선택해 재개하세요.
          </div>
        )}

        {/* Plan Cards */}
        {sub?.status !== "active" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {PLANS.map((plan) => (
                <div key={plan.id} style={{ background: "#fff", borderRadius: 14, border: plan.highlight ? "2px solid #2563EB" : "1.5px solid #E2E8F0", padding: 24, textAlign: "center", position: "relative", boxShadow: plan.highlight ? "0 8px 24px rgba(37,99,235,0.15)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
                  {plan.highlight && (
                    <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#2563EB", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20 }}>
                      추천
                    </div>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>{plan.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#2563EB" }}>{plan.price}</div>
                  <div style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>{plan.period}</div>
                  <div style={{ fontSize: 12, color: "#10B981", fontWeight: 600, marginBottom: 20 }}>{plan.desc}</div>
                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={!!loading}
                    style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", background: plan.highlight ? "linear-gradient(135deg,#1D4ED8,#2563EB)" : "#F1F5F9", color: plan.highlight ? "#fff" : "#475569" }}>
                    {loading === plan.id ? "연결 중..." : "구독 시작"}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 10 }}>✅ 모든 플랜 포함 사항</div>
              {["업체·직원 무제한 관리", "2026년 고용지원금 15종", "팀원 초대 (멀티유저)", "파일 첨부 클라우드 저장", "채용 진단 + 급여 계산기", "D-Day 알림 + 보고서 생성"].map((f) => (
                <div key={f} style={{ fontSize: 13, color: "#475569", padding: "4px 0" }}>· {f}</div>
              ))}
            </div>
          </>
        )}

        <div style={{ textAlign: "center" }}>
          <button onClick={signOut} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 13, cursor: "pointer" }}>
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
