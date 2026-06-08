import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSub } from "../hooks/useSub";
import { supabase } from "../lib/supabase";

const FF = "'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

// ─────────────────────────────────────────────────────────────
// PLAN_CONFIG — 모든 플랜 정의를 한 곳에서 관리
// 추후 실제 결제 연동 시 각 플랜의 monthly/annual.planId 에
// Stripe Price ID(또는 PortOne 등) 만 채우면 됩니다.
// status: "yes"(포함) | "limited"(부분/제한) | "no"(미지원)
// ─────────────────────────────────────────────────────────────
const PLAN_CONFIG = [
  {
    id: "individual",
    icon: "🏢",
    label: "개인 업체",
    target: "자기 회사 1곳만 관리하는 사업자",
    color: "#2563EB",
    colorBg: "#EFF6FF",
    badge: null,
    highlight: false,
    limits: { companies: "업체 1개", employees: "직원·대상자 20명", team: "1인 사용" },
    monthly: { planId: "", price: 9900 },
    annual: { planId: "", price: 99000 },
    features: [
      { text: "기본 대시보드", status: "yes" },
      { text: "2026 지원금 15종 안내", status: "yes" },
      { text: "급여 계산기", status: "yes" },
      { text: "수령액 시뮬레이터", status: "yes" },
      { text: "D-Day 알림", status: "yes" },
      { text: "기본 파일 첨부", status: "yes" },
      { text: "고객 보고서", status: "limited", note: "제한" },
      { text: "수수료 정산", status: "limited", note: "제한" },
      { text: "팀원 초대", status: "no" },
      { text: "고급 엑셀 마이그레이션", status: "no" },
    ],
  },
  {
    id: "starter",
    icon: "🚀",
    label: "컨설턴트 스타터",
    target: "1인 컨설턴트, 초기 사용자",
    color: "#0891B2",
    colorBg: "#ECFEFF",
    badge: null,
    highlight: false,
    limits: { companies: "고객사 10개", employees: "직원·대상자 100명", team: "1인 사용" },
    monthly: { planId: "", price: 49000 },
    annual: { planId: "", price: 490000 },
    features: [
      { text: "개인 업체 기능 전체 포함", status: "yes" },
      { text: "진행 보드", status: "yes" },
      { text: "서류 체크리스트", status: "yes" },
      { text: "기본 고객 보고서", status: "yes" },
      { text: "업무일지", status: "yes" },
      { text: "기본 알림센터", status: "yes" },
      { text: "기본 엑셀 등록", status: "yes" },
      { text: "수수료 정산", status: "limited", note: "일부" },
      { text: "팀원 초대", status: "no" },
      { text: "고급 엑셀 마이그레이션", status: "no" },
    ],
  },
  {
    id: "pro",
    icon: "⭐",
    label: "컨설턴트 프로",
    target: "여러 고객사를 관리하는 컨설턴트",
    color: "#7C3AED",
    colorBg: "#F5F3FF",
    badge: "가장 많이 선택",
    highlight: true,
    limits: { companies: "고객사 50개+", employees: "직원·대상자 500명", team: "1인 사용" },
    monthly: { planId: "", price: 99000 },
    annual: { planId: "", price: 990000 },
    features: [
      { text: "스타터 기능 전체 포함", status: "yes" },
      { text: "고급 고객 보고서", status: "yes" },
      { text: "수수료 정산", status: "yes" },
      { text: "미수금 관리", status: "yes" },
      { text: "서류 요청 문구 자동 생성", status: "yes" },
      { text: "고급 알림센터", status: "yes" },
      { text: "엑셀 마이그레이션", status: "yes" },
      { text: "활동 로그", status: "yes" },
      { text: "월별 수령/청구 리포트", status: "yes" },
      { text: "우선 지원", status: "yes" },
    ],
  },
  {
    id: "team",
    icon: "🏛️",
    label: "사무소 / 팀",
    target: "노무사 사무실, 컨설팅팀 등 여러 담당자 조직",
    color: "#0F766E",
    colorBg: "#F0FDFA",
    badge: "팀 협업",
    highlight: false,
    limits: { companies: "고객사 무제한", employees: "직원·대상자 무제한", team: "팀원 3~5명" },
    monthly: { planId: "", price: 149000 },
    annual: { planId: "", price: 1490000 },
    features: [
      { text: "프로 기능 전체 포함", status: "yes" },
      { text: "팀원 3~5명 + 역할/권한 관리", status: "yes" },
      { text: "담당자 배정", status: "yes" },
      { text: "팀별 활동 로그", status: "yes" },
      { text: "고급 엑셀 마이그레이션", status: "yes" },
      { text: "고객사별 보고서 일괄 생성", status: "yes" },
      { text: "화이트라벨 보고서", status: "yes" },
      { text: "우선 기능 요청", status: "yes" },
      { text: "초기 세팅 지원", status: "yes" },
    ],
  },
];

// 연간 할인율(표시용) — 연 = 월×10 이므로 약 17% 할인
const ANNUAL_SAVE_PCT = 17;

// 비교표 — 4개 플랜 기준 (값: true/false/문자열)
const COMPARE_ROWS = [
  ["관리 업체 수",          "1개",     "10개",    "50개+",   "무제한"],
  ["직원 · 대상자",         "20명",    "100명",   "500명",   "무제한"],
  ["기본 대시보드",          true,      true,      true,      true],
  ["지원금 15종 안내",       true,      true,      true,      true],
  ["급여 계산기 · 시뮬레이터", true,      true,      true,      true],
  ["D-Day 알림 · 파일 첨부",  true,      true,      true,      true],
  ["진행 보드 · 서류 체크리스트", false,  true,      true,      true],
  ["업무일지",               false,     true,      true,      true],
  ["고객 보고서",            "제한",    "기본",    "고급",    "일괄"],
  ["수수료 정산",            false,     "일부",    true,      true],
  ["미수금 관리",            false,     false,     true,      true],
  ["서류 요청 문구 자동생성",  false,     false,     true,      true],
  ["활동 로그",              false,     false,     true,      "팀별"],
  ["월별 수령/청구 리포트",    false,     false,     true,      true],
  ["엑셀 마이그레이션",       false,     "기본",    true,      "고급"],
  ["팀원 초대 · 권한 관리",   false,     false,     false,     "3~5명"],
  ["화이트라벨 보고서",       false,     false,     false,     true],
  ["초기 세팅 지원",          false,     false,     false,     true],
];

function CellVal({ v }) {
  if (v === true)  return <span style={{ color: "#059669", fontSize: 16 }}>✅</span>;
  if (v === false) return <span style={{ color: "#CBD5E1", fontSize: 15 }}>—</span>;
  return <span style={{ fontWeight: 700, color: "#475569", fontSize: 13 }}>{v}</span>;
}

function FeatIcon({ status }) {
  if (status === "yes")     return <span style={{ flexShrink: 0, fontSize: 14, color: "#059669" }}>✓</span>;
  if (status === "limited") return <span style={{ flexShrink: 0, fontSize: 14, color: "#D97706" }}>◐</span>;
  return <span style={{ flexShrink: 0, fontSize: 14, color: "#CBD5E1" }}>✕</span>;
}

export default function BillingPage({ onBack }) {
  const { org, profile, signOut } = useAuth();
  const { sub, trialDaysLeft, isTrialing } = useSub(org);
  const [loading, setLoading] = useState(null);
  const [period, setPeriod] = useState("monthly"); // 기본값: 월간 결제
  const [notice, setNotice] = useState(""); // 베타 안내 토스트

  const isActive = sub?.status === "active";
  const isExpired = sub && sub.status !== "active" && sub.status !== "trialing";

  // 베타 안내 — 실제 결제 연동 전이므로 결제로 보내지 않고 안내만 표시
  function handleBetaSubscribe(plan) {
    setNotice(`${plan.label} 플랜 — 결제 연동 준비 중입니다. 베타 기간에는 무료로 이용 가능합니다.`);
    if (typeof window !== "undefined") clearTimeout(window.__billingNoticeT);
    window.__billingNoticeT = setTimeout(() => setNotice(""), 4000);
  }

  // 기존 구독 관리(포털) 흐름 유지 — 활성 구독자만 사용
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
      <div style={{ maxWidth: 1140, margin: "0 auto" }}>

        {/* Top nav */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          {onBack
            ? <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: FF }}>← 앱으로 돌아가기</button>
            : <span />}
          <button onClick={signOut} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 13, cursor: "pointer", fontFamily: FF }}>로그아웃</button>
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>📋</div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, color: "#1E293B", letterSpacing: "-0.5px" }}>요금제 안내</h1>
          <p style={{ margin: 0, color: "#64748B", fontSize: 15 }}>
            {profile?.display_name ? `${profile.display_name}님 · ` : ""}{org?.name} · 사용 규모에 맞는 플랜을 선택하세요
          </p>
        </div>

        {/* Trial Banner */}
        {isTrialing && trialDaysLeft !== null && (
          <div style={{ padding: "14px 20px", background: trialDaysLeft <= 3 ? "#FEF2F2" : "#FFFBEB", border: `1px solid ${trialDaysLeft <= 3 ? "#FECACA" : "#FDE68A"}`, borderRadius: 12, marginBottom: 20, textAlign: "center", fontSize: 14, color: trialDaysLeft <= 3 ? "#DC2626" : "#92400E", fontWeight: 600, lineHeight: 1.6 }}>
            {trialDaysLeft <= 0
              ? "⏳ 무료 체험 기간이 지났지만, 베타 기간에는 계속 무료로 이용 가능합니다."
              : `⏳ 무료체험 ${trialDaysLeft}일 남음 · 베타 기간에는 모든 기능을 무료로 사용할 수 있습니다.`}
            <div style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8", marginTop: 4 }}>
              입력하신 데이터는 결제와 무관하게 그대로 유지됩니다.
            </div>
          </div>
        )}

        {/* Active Banner */}
        {isActive && (
          <div style={{ padding: "16px 20px", background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 14, color: "#059669", fontWeight: 600 }}>
              ✅ 구독 활성 중 · 다음 결제일: {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("ko-KR") : "-"}
            </div>
            <button onClick={handlePortal} disabled={!!loading}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #6EE7B7", background: "#fff", color: "#059669", fontSize: 13, cursor: "pointer", fontWeight: 600, fontFamily: FF }}>
              {loading === "portal" ? "..." : "결제 관리 / 플랜 변경"}
            </button>
          </div>
        )}

        {isExpired && (
          <div style={{ padding: "14px 20px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, marginBottom: 20, textAlign: "center", fontSize: 14, color: "#1D4ED8", fontWeight: 600 }}>
            ℹ️ 베타 기간에는 결제 없이 계속 이용하실 수 있습니다. 아래는 정식 출시 예정 요금제입니다.
          </div>
        )}

        {/* 베타 안내 배너 (CTA 클릭 시) */}
        {notice && (
          <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9000, background: "#1E293B", color: "#fff", padding: "13px 22px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 28px rgba(15,23,42,0.28)", maxWidth: "90vw", textAlign: "center" }}>
            ℹ️ {notice}
          </div>
        )}

        {/* 결제 주기 토글 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 12, padding: 4, gap: 4 }}>
            {[["monthly", "월간 결제"], ["annual", "연간 결제"]].map(([k, l]) => {
              const on = period === k;
              return (
                <button key={k} onClick={() => setPeriod(k)}
                  style={{ padding: "11px 26px", borderRadius: 9, border: "none", fontSize: 15, fontWeight: on ? 700 : 500, color: on ? "#1E293B" : "#64748B", background: on ? "#fff" : "transparent", cursor: "pointer", fontFamily: FF, boxShadow: on ? "0 1px 6px rgba(0,0,0,0.10)" : "none", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 8 }}>
                  {l}
                  {k === "annual" && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#D1FAE5", padding: "2px 7px", borderRadius: 8 }}>{ANNUAL_SAVE_PCT}% 할인</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* 월간 선택 상태에서도 연간 할인 문구 항상 노출 */}
          <div style={{ fontSize: 13, color: "#64748B" }}>
            💡 연간 결제 시 약 <strong style={{ color: "#059669" }}>{ANNUAL_SAVE_PCT}% 할인</strong> (2개월 무료 효과)
          </div>
        </div>

        {/* 4개 플랜 카드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 36, alignItems: "stretch" }} className="plan-grid">
          {PLAN_CONFIG.map((plan) => {
            const p = period === "annual" ? plan.annual : plan.monthly;
            const monthlyEquiv = Math.round(plan.annual.price / 12);
            const hl = plan.highlight;
            return (
              <div key={plan.id}
                style={{
                  background: "#fff",
                  borderRadius: 18,
                  border: hl ? `2.5px solid ${plan.color}` : "1.5px solid #E2E8F0",
                  padding: "26px 22px 24px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: hl ? `0 14px 44px ${plan.color}26` : "0 2px 10px rgba(15,23,42,0.05)",
                  transform: hl ? "translateY(-6px)" : "none",
                }}>
                {/* 배지 */}
                {plan.badge && (
                  <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: hl ? plan.color : "#475569", color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 16px", borderRadius: 20, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(15,23,42,0.18)" }}>
                    {hl ? "⭐ " : ""}{plan.badge}
                  </div>
                )}

                {/* 헤더 */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>{plan.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: plan.color, marginBottom: 4 }}>{plan.label}</div>
                  <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.5, minHeight: 38 }}>{plan.target}</div>
                </div>

                {/* 가격 */}
                <div style={{ marginBottom: 14, paddingBottom: 16, borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", lineHeight: 1 }}>
                      ₩{p.price.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 14, color: "#94A3B8", paddingBottom: 2 }}>/{period === "annual" ? "년" : "월"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 6, minHeight: 16 }}>
                    {period === "annual"
                      ? <>월 환산 약 <strong style={{ color: plan.color }}>₩{monthlyEquiv.toLocaleString()}</strong></>
                      : <>연간 결제 시 <strong style={{ color: "#059669" }}>{ANNUAL_SAVE_PCT}% 할인</strong></>}
                  </div>
                </div>

                {/* 핵심 제한 */}
                <div style={{ background: plan.colorBg, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                  {[plan.limits.companies, plan.limits.employees, plan.limits.team].map((t, i) => (
                    <div key={i} style={{ fontSize: 12.5, fontWeight: 700, color: plan.color, lineHeight: 1.7 }}>{t}</div>
                  ))}
                </div>

                {/* 기능 목록 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20, flex: 1 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, color: f.status === "no" ? "#94A3B8" : "#334155" }}>
                      <FeatIcon status={f.status} />
                      <span style={{ lineHeight: 1.45 }}>
                        {f.text}
                        {f.note && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 4, padding: "1px 5px", marginLeft: 4, verticalAlign: "middle", fontWeight: 600 }}>{f.note}</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA — 베타 안내 */}
                <button onClick={() => handleBetaSubscribe(plan)}
                  style={{
                    width: "100%", padding: "13px", borderRadius: 11, border: hl ? "none" : `1.5px solid ${plan.color}`,
                    fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FF, letterSpacing: "-0.3px",
                    background: hl ? `linear-gradient(135deg, ${plan.color}dd, ${plan.color})` : "#fff",
                    color: hl ? "#fff" : plan.color,
                    boxShadow: hl ? `0 6px 18px ${plan.color}44` : "none",
                  }}>
                  베타 신청 / 구독 준비 중
                </button>
              </div>
            );
          })}
        </div>

        {/* 비교표 — 4개 플랜 */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "auto", marginBottom: 28 }}>
          <div style={{ padding: "16px 20px", background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>📊 플랜 상세 비교</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#FAFBFC" }}>
                <th style={{ padding: "12px 18px", textAlign: "left", color: "#64748B", fontWeight: 600, fontSize: 13, minWidth: 160 }}>기능</th>
                {PLAN_CONFIG.map((plan) => (
                  <th key={plan.id} style={{ padding: "12px 14px", textAlign: "center", minWidth: 110, background: plan.highlight ? plan.colorBg : "transparent" }}>
                    <div style={{ color: plan.color, fontWeight: 800, fontSize: 13.5 }}>{plan.icon} {plan.label}</div>
                    <div style={{ color: "#64748B", fontSize: 12, fontWeight: 500 }}>₩{plan.monthly.price.toLocaleString()}~/월</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => {
                const [label, ...vals] = row;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    <td style={{ padding: "11px 18px", color: "#475569", fontSize: 13.5, fontWeight: 500 }}>{label}</td>
                    {vals.map((v, j) => (
                      <td key={j} style={{ padding: "11px 14px", textAlign: "center", background: PLAN_CONFIG[j].highlight ? PLAN_CONFIG[j].colorBg + "80" : "transparent" }}>
                        <CellVal v={v} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, lineHeight: 2.2 }}>
          <div>고용지원금 매니저 Pro · 사업자 세금계산서 발행 가능 (정식 출시 후)</div>
          <div>현재 베타 기간으로 모든 플랜 기능을 무료로 이용하실 수 있습니다 · 문의: support@hrsubsidy.kr</div>
        </div>
      </div>

      {/* 반응형 — 좁은 화면에서는 카드 2열 → 1열 */}
      <style>{`
        @media (max-width: 1080px) { .plan-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 560px)  { .plan-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
