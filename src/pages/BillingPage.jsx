import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSub } from "../hooks/useSub";
import { supabase } from "../lib/supabase";

const FF = "'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

// ─────────────────────────────────────────────────────────────────────────────
// PLAN_CONFIG — 플랜 정의 단일 상수
// 추후 실제 결제 연동 시 monthly.planId / annual.planId 에 결제 PriceId 만 채우면 됩니다.
// VIP 플랜은 isConsult:true 로 구분 (가격 표시 방식 다름, 상담 CTA).
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_CONFIG = [
  {
    planKey: "starter",
    icon: "🚀",
    label: "컨설턴트 스타터",
    target: "고객사 1~5개 관리하는 초기 1인 컨설턴트",
    color: "#0891B2",
    colorBg: "#ECFEFF",
    colorBorder: "#A5F3FC",
    badge: null,
    highlight: false,
    isConsult: false,
    tagline: null,
    monthlyPrice: 49000,
    annualPrice: 490000,
    monthly: { planId: "" },
    annual: { planId: "" },
    ctaText: "스타터로 시작하기",
    limits: { companies: "고객사 5개", employees: "대상자 50명", team: "1인 사용" },
    addOns: null,
    valueProps: [
      "신청기한 누락 방지 — D-Day 자동 알림",
      "대상자·회차 진행 현황 한눈에 파악",
      "서류 체크리스트로 서류 누락 방지",
      "급여 계산기 · 수령액 시뮬레이터",
    ],
    features: [
      { text: "기본 대시보드", status: "yes" },
      { text: "D-Day 알림 · 진행 보드", status: "yes" },
      { text: "서류 체크리스트", status: "yes" },
      { text: "급여 계산기 · 수령액 시뮬레이터", status: "yes" },
      { text: "기본 업무일지", status: "yes" },
      { text: "표준 엑셀 양식 가져오기", status: "yes" },
      { text: "고객 보고서", status: "limited", note: "제한" },
      { text: "수수료 정산", status: "limited", note: "제한" },
      { text: "엑셀 컬럼 매핑", status: "no" },
      { text: "팀원 초대", status: "no" },
    ],
  },
  {
    planKey: "pro",
    icon: "⭐",
    label: "컨설턴트 프로",
    target: "여러 고객사를 담당하는 전문 컨설턴트",
    color: "#7C3AED",
    colorBg: "#F5F3FF",
    colorBorder: "#7C3AED",
    badge: "가장 많이 선택",
    highlight: true,
    isConsult: false,
    tagline: "월 10만 원으로 엑셀 관리와 신청기한 누락을 줄이세요.",
    monthlyPrice: 99000,
    annualPrice: 990000,
    monthly: { planId: "" },
    annual: { planId: "" },
    ctaText: "프로로 시작하기",
    limits: { companies: "고객사 20개", employees: "대상자 250명", team: "1인 사용" },
    addOns: null,
    valueProps: [
      "수수료 정산 · 미수금 관리 자동화",
      "고객 보고서 자동 생성으로 시간 절감",
      "서류 요청 문구 자동 생성",
      "월별 수령·청구 리포트 제공",
    ],
    features: [
      { text: "스타터 기능 전체 포함", status: "yes" },
      { text: "고급 대시보드", status: "yes" },
      { text: "고객 보고서 자동화", status: "yes" },
      { text: "수수료 정산 · 미수금 관리", status: "yes" },
      { text: "서류 요청 문구 자동 생성", status: "yes" },
      { text: "고급 알림센터", status: "yes" },
      { text: "엑셀 컬럼 매핑 가져오기", status: "yes" },
      { text: "업무일지 · 활동 로그", status: "yes" },
      { text: "월별 수령·청구 리포트", status: "yes" },
      { text: "우선 지원", status: "yes" },
    ],
  },
  {
    planKey: "team",
    icon: "🏛️",
    label: "팀 / 사무소",
    target: "노무사 사무실·컨설팅팀 등 여러 담당자 조직",
    color: "#059669",
    colorBg: "#ECFDF5",
    colorBorder: "#6EE7B7",
    badge: "팀 협업",
    highlight: false,
    isConsult: false,
    tagline: null,
    monthlyPrice: 199000,
    annualPrice: 1990000,
    monthly: { planId: "" },
    annual: { planId: "" },
    ctaText: "팀 플랜 시작하기",
    limits: { companies: "고객사 60개", employees: "대상자 800명", team: "팀원 3명 포함" },
    addOns: [
      "추가 고객사 30개당 월 49,000원",
      "추가 팀원 1명당 월 29,000원",
    ],
    valueProps: [
      "담당자 배정으로 고객사별 책임 관리",
      "고객사별 보고서 일괄 생성",
      "고급 수수료 정산 · 미수금 통합",
      "팀별 활동 로그로 업무 투명화",
    ],
    features: [
      { text: "프로 기능 전체 포함", status: "yes" },
      { text: "팀원 3명 + 역할·권한 관리", status: "yes" },
      { text: "담당자 배정", status: "yes" },
      { text: "팀별 활동 로그", status: "yes" },
      { text: "고급 엑셀 마이그레이션", status: "yes" },
      { text: "여러 시트 가져오기", status: "yes" },
      { text: "고객사별 보고서 일괄 생성", status: "yes" },
      { text: "고급 수수료 정산", status: "yes" },
      { text: "우선 기능 요청", status: "yes" },
    ],
  },
  {
    planKey: "vip",
    icon: "👑",
    label: "VIP 온보딩 파트너스",
    target: "엑셀·수기 자료가 많고 직접 세팅할 시간이 없는 컨설턴트·노무법인",
    color: "#92400E",
    colorBg: "#FFFBEB",
    colorBorder: "#FDE68A",
    badge: "전담 구축",
    highlight: false,
    isConsult: true,
    tagline: "엑셀 이관부터 내부 운영 세팅까지 전담으로 구축해드립니다.",
    monthlyPrice: null,
    annualPrice: null,
    monthly: { planId: "" },
    annual: { planId: "" },
    priceDisplay: "초기 세팅비 150만원~\n+ 월 50만원~",
    ctaText: "도입 상담 문의",
    limits: { companies: "팀/사무소 플랜 포함", employees: "규모 협의", team: "담당 매니저 배정" },
    addOns: null,
    valueProps: [
      "기존 엑셀 데이터 이관 대행으로 즉시 가동",
      "고객사·대상자 데이터 정리 완료 상태 납품",
      "1:1 초기 온보딩 교육 · 내부 운영 맞춤 세팅",
      "도입 후 30일 이내 사용성 점검 및 보완 지원",
    ],
    features: [
      { text: "팀/사무소 플랜 전체 포함", status: "yes" },
      { text: "기존 엑셀 데이터 이관 대행", status: "yes" },
      { text: "고객사·대상자 데이터 정리", status: "yes" },
      { text: "1:1 초기 온보딩 교육", status: "yes" },
      { text: "내부 운영 방식 맞춤 세팅", status: "yes" },
      { text: "월 1회 운영 점검 세션", status: "yes" },
      { text: "VIP 전용 다이렉트 문의 채널", status: "yes" },
      { text: "제품 로드맵 우선 반영", status: "yes" },
      { text: "고용지원금 영업·운영 스크립트 코칭", status: "yes" },
      { text: "도입 30일 이내 사용성 보완 지원", status: "yes" },
    ],
  },
];

const ANNUAL_SAVE_PCT = 17;

// 비교표 — [기능명, starter, pro, team, vip]
const COMPARE_ROWS = [
  ["고객사 수",                "5개",    "20개",  "60개",    "협의"],
  ["대상자 수",                "50명",   "250명", "800명",   "협의"],
  ["팀원",                     "1인",    "1인",   "3명+",    "협의"],
  ["D-Day 알림 · 진행 보드",   true,     true,    true,      true],
  ["서류 체크리스트",           true,     true,    true,      true],
  ["급여 계산기 · 시뮬레이터",  true,     true,    true,      true],
  ["기본 업무일지",             true,     true,    true,      true],
  ["고객 보고서",               "기본",   "고급",  "일괄",    "일괄"],
  ["수수료 정산",               "일부",   true,    "고급",    "고급"],
  ["미수금 관리",               false,    true,    true,      true],
  ["서류 요청 문구 자동 생성",   false,    true,    true,      true],
  ["엑셀 컬럼 매핑",            false,    true,    "고급",    "고급"],
  ["활동 로그",                 false,    true,    "팀별",    "팀별"],
  ["월별 수령·청구 리포트",      false,    true,    true,      true],
  ["담당자 배정",               false,    false,   true,      true],
  ["보고서 일괄 생성",          false,    false,   true,      true],
  ["엑셀 이관 대행",            false,    false,   false,     true],
  ["1:1 온보딩 · 세팅 지원",    false,    false,   false,     true],
  ["월 운영 점검 세션",          false,    false,   false,     true],
];

function CellVal({ v }) {
  if (v === true)  return <span style={{ color: "#059669", fontSize: 16 }}>✅</span>;
  if (v === false) return <span style={{ color: "#CBD5E1", fontSize: 15 }}>—</span>;
  return <span style={{ fontWeight: 700, color: "#475569", fontSize: 13 }}>{v}</span>;
}

function FeatDot({ status }) {
  if (status === "yes")     return <span style={{ color: "#059669", fontSize: 13, flexShrink: 0 }}>✓</span>;
  if (status === "limited") return <span style={{ color: "#D97706", fontSize: 13, flexShrink: 0 }}>◐</span>;
  return <span style={{ color: "#CBD5E1", fontSize: 13, flexShrink: 0 }}>—</span>;
}

function useLocalToast() {
  const [msg, setMsg] = useState("");
  function show(text) {
    setMsg(text);
    clearTimeout(window.__billingToastT);
    window.__billingToastT = setTimeout(() => setMsg(""), 4500);
  }
  return [msg, show];
}

export default function BillingPage({ onBack }) {
  const { org, profile, signOut } = useAuth();
  const { sub, trialDaysLeft, isTrialing } = useSub(org);
  const [period, setPeriod] = useState("monthly");
  const [toastMsg, showToast] = useLocalToast();
  const [loading, setLoading] = useState(null);

  const isActive = sub?.status === "active";
  const isExpired = sub && sub.status !== "active" && sub.status !== "trialing";

  function handleCta(plan) {
    if (plan.isConsult) {
      showToast("도입 상담 문의를 남겨주세요. 빠른 시일 내 연락드리겠습니다. (support@hrsubsidy.kr)");
    } else {
      showToast("결제 연동 준비 중입니다. 베타 기간에는 무료로 이용 가능합니다.");
    }
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

      {/* 인라인 토스트 */}
      {toastMsg && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9900, background: "#1E293B", color: "#fff", padding: "14px 26px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 10px 36px rgba(15,23,42,0.28)", maxWidth: "90vw", textAlign: "center", lineHeight: 1.55 }}>
          ℹ️ {toastMsg}
        </div>
      )}

      <div style={{ maxWidth: 1160, margin: "0 auto" }}>

        {/* 상단 내비 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          {onBack
            ? <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: FF }}>← 앱으로 돌아가기</button>
            : <span />}
          <button onClick={signOut} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 13, cursor: "pointer", fontFamily: FF }}>로그아웃</button>
        </div>

        {/* 히어로 */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: "#7C3AED", letterSpacing: "0.08em", background: "#F5F3FF", padding: "5px 14px", borderRadius: 20, marginBottom: 14 }}>
            컨설턴트용 고용지원금 운영 시스템
          </div>
          <h1 style={{ margin: "0 0 14px", fontSize: 30, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.8px", lineHeight: 1.28 }}>
            엑셀로 관리하던 고용지원금 업무를<br />하나의 시스템으로 바꾸세요.
          </h1>
          <p style={{ margin: "0 auto", color: "#64748B", fontSize: 15, maxWidth: 540, lineHeight: 1.7 }}>
            신청기한, 서류, 대상자, 수수료, 고객 보고서까지 한 번에 관리하는<br />컨설턴트용 고용지원금 운영 시스템입니다.
          </p>
          {profile?.display_name && (
            <div style={{ marginTop: 10, fontSize: 13, color: "#94A3B8" }}>{profile.display_name} · {org?.name}</div>
          )}
        </div>

        {/* 체험/구독 상태 배너 */}
        {isTrialing && trialDaysLeft !== null && (
          <div style={{ padding: "14px 22px", background: trialDaysLeft <= 3 ? "#FEF2F2" : "#F0FDF4", border: `1px solid ${trialDaysLeft <= 3 ? "#FECACA" : "#BBF7D0"}`, borderRadius: 12, marginBottom: 24, textAlign: "center", fontSize: 14, color: trialDaysLeft <= 3 ? "#DC2626" : "#166534", fontWeight: 600, lineHeight: 1.6 }}>
            {trialDaysLeft <= 0
              ? "⏳ 베타 기간 중입니다. 아래 요금제는 정식 출시 예정 안내입니다."
              : `⏳ 무료체험 ${trialDaysLeft}일 남음 · 베타 기간에는 모든 기능을 무료로 이용할 수 있습니다.`}
            <div style={{ fontSize: 12, fontWeight: 500, color: "#94A3B8", marginTop: 4 }}>입력하신 데이터는 결제와 무관하게 그대로 유지됩니다.</div>
          </div>
        )}
        {isActive && (
          <div style={{ padding: "14px 22px", background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 12, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 14, color: "#059669", fontWeight: 600 }}>
              ✅ 구독 활성 중 · 다음 결제일: {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("ko-KR") : "-"}
            </div>
            <button onClick={handlePortal} disabled={!!loading} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #6EE7B7", background: "#fff", color: "#059669", fontSize: 13, cursor: "pointer", fontWeight: 600, fontFamily: FF }}>
              {loading === "portal" ? "..." : "결제 관리 / 플랜 변경"}
            </button>
          </div>
        )}
        {isExpired && (
          <div style={{ padding: "14px 22px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, marginBottom: 24, textAlign: "center", fontSize: 14, color: "#1D4ED8", fontWeight: 600 }}>
            ℹ️ 베타 기간에는 결제 없이 계속 이용하실 수 있습니다. 아래는 정식 출시 예정 요금제입니다.
          </div>
        )}

        {/* 월간/연간 토글 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 32 }}>
          <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 12, padding: 4, gap: 4 }}>
            {[["monthly", "월간 결제"], ["annual", "연간 결제"]].map(([k, l]) => {
              const on = period === k;
              return (
                <button key={k} onClick={() => setPeriod(k)}
                  style={{ padding: "11px 28px", borderRadius: 9, border: "none", fontSize: 15, fontWeight: on ? 700 : 500, color: on ? "#1E293B" : "#64748B", background: on ? "#fff" : "transparent", cursor: "pointer", fontFamily: FF, boxShadow: on ? "0 1px 6px rgba(0,0,0,0.10)" : "none", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 8 }}>
                  {l}
                  {k === "annual" && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#D1FAE5", padding: "2px 8px", borderRadius: 8 }}>{ANNUAL_SAVE_PCT}% 할인</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* 월간 선택 시에도 연간 할인 문구 항상 표시 */}
          <div style={{ fontSize: 13, color: "#64748B" }}>
            💡 연간 결제 시 약 <strong style={{ color: "#059669" }}>{ANNUAL_SAVE_PCT}% 할인</strong> — 2개월 무료 효과
          </div>
        </div>

        {/* ── 플랜 카드 4개 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 44, alignItems: "stretch" }} className="plan-grid">
          {PLAN_CONFIG.map((plan) => {
            const price = period === "annual" ? plan.annualPrice : plan.monthlyPrice;
            const monthlyEquiv = plan.annualPrice ? Math.round(plan.annualPrice / 12) : null;
            const hl = plan.highlight;
            const isVip = plan.isConsult;

            return (
              <div key={plan.planKey}
                style={{
                  background: isVip ? "linear-gradient(160deg,#FFFBEB,#FEF3C7)" : "#fff",
                  borderRadius: 20,
                  border: hl ? `2.5px solid ${plan.color}` : `1.5px solid ${isVip ? plan.colorBorder : "#E2E8F0"}`,
                  padding: hl ? "32px 22px 26px" : "26px 22px 24px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: hl
                    ? `0 18px 52px ${plan.color}28`
                    : isVip
                    ? `0 6px 24px ${plan.color}20`
                    : "0 2px 10px rgba(15,23,42,0.05)",
                  transform: hl ? "translateY(-10px)" : "none",
                }}>

                {/* 배지 */}
                {plan.badge && (
                  <div style={{
                    position: "absolute", top: hl ? -15 : -12, left: "50%", transform: "translateX(-50%)",
                    background: hl ? plan.color : isVip ? "#92400E" : "#334155",
                    color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 16px", borderRadius: 20,
                    whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(15,23,42,0.2)",
                  }}>
                    {hl ? "⭐ " : isVip ? "👑 " : ""}{plan.badge}
                  </div>
                )}

                {/* 헤더 */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{plan.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: plan.color, marginBottom: 5 }}>{plan.label}</div>
                  <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.55, minHeight: 36 }}>{plan.target}</div>
                </div>

                {/* tagline */}
                {plan.tagline && (
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: plan.color, background: plan.colorBg, padding: "9px 13px", borderRadius: 9, marginBottom: 14, lineHeight: 1.5, border: `1px solid ${plan.colorBorder}` }}>
                    {plan.tagline}
                  </div>
                )}

                {/* 가격 */}
                <div style={{ marginBottom: 14, paddingBottom: 16, borderBottom: "1px solid #F1F5F9" }}>
                  {isVip ? (
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", letterSpacing: "-0.3px", lineHeight: 1.6, whiteSpace: "pre-line" }}>{plan.priceDisplay}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>규모·요건에 따라 상담 후 확정</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 26, fontWeight: 800, color: "#1E293B", letterSpacing: "-1px", lineHeight: 1 }}>
                          ₩{(price || 0).toLocaleString()}
                        </span>
                        <span style={{ fontSize: 14, color: "#94A3B8", paddingBottom: 2 }}>/{period === "annual" ? "년" : "월"}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 6 }}>
                        {period === "annual"
                          ? <>월 환산 <strong style={{ color: plan.color }}>₩{(monthlyEquiv || 0).toLocaleString()}</strong></>
                          : <>연간 결제 시 <strong style={{ color: "#059669" }}>{ANNUAL_SAVE_PCT}% 할인</strong></>}
                      </div>
                    </div>
                  )}
                </div>

                {/* 핵심 제한 */}
                <div style={{ background: plan.colorBg, borderRadius: 10, padding: "10px 13px", marginBottom: 14, border: `1px solid ${plan.colorBorder}` }}>
                  {[plan.limits.companies, plan.limits.employees, plan.limits.team].map((t, i) => (
                    <div key={i} style={{ fontSize: 12.5, fontWeight: 700, color: plan.color, lineHeight: 1.8 }}>{t}</div>
                  ))}
                </div>

                {/* 결과 중심 가치 문구 */}
                <div style={{ marginBottom: 14 }}>
                  {plan.valueProps.map((v, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, color: "#334155", marginBottom: 6, lineHeight: 1.45 }}>
                      <span style={{ color: plan.color, flexShrink: 0, fontWeight: 700 }}>→</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>

                {/* 기능 목록 */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>포함 기능</div>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, color: f.status === "no" ? "#CBD5E1" : "#334155" }}>
                      <FeatDot status={f.status} />
                      <span style={{ lineHeight: 1.45 }}>
                        {f.text}
                        {f.note && <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 4, padding: "1px 5px", marginLeft: 4, verticalAlign: "middle", fontWeight: 700 }}>{f.note}</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 팀 플랜 확장 옵션 */}
                {plan.addOns && (
                  <div style={{ background: "#F8FAFC", borderRadius: 9, padding: "9px 12px", marginBottom: 16, borderLeft: `3px solid ${plan.color}` }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", marginBottom: 4, textTransform: "uppercase" }}>확장 옵션</div>
                    {plan.addOns.map((a, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>+ {a}</div>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <button onClick={() => handleCta(plan)}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 11,
                    border: hl ? "none" : `1.5px solid ${plan.color}`,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: FF,
                    letterSpacing: "-0.3px",
                    background: hl
                      ? `linear-gradient(135deg, ${plan.color}e0, ${plan.color})`
                      : isVip
                      ? `linear-gradient(135deg, #92400E, #B45309)`
                      : "#fff",
                    color: (hl || isVip) ? "#fff" : plan.color,
                    boxShadow: hl ? `0 6px 22px ${plan.color}44` : isVip ? "0 4px 14px rgba(146,64,14,0.3)" : "none",
                    transition: "opacity 0.15s",
                  }}>
                  {plan.ctaText}
                </button>
              </div>
            );
          })}
        </div>

        {/* ── 기능 비교표 ── */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "auto", marginBottom: 28 }}>
          <div style={{ padding: "18px 22px", background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B" }}>📊 플랜 상세 비교</div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>✅ 포함 &nbsp;·&nbsp; ◐ 일부 &nbsp;·&nbsp; — 미지원</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#FAFBFC" }}>
                <th style={{ padding: "12px 18px", textAlign: "left", color: "#64748B", fontWeight: 600, fontSize: 13, minWidth: 170 }}>기능</th>
                {PLAN_CONFIG.map((plan) => (
                  <th key={plan.planKey} style={{ padding: "12px 14px", textAlign: "center", minWidth: 110, background: plan.highlight ? plan.colorBg : "transparent" }}>
                    <div style={{ color: plan.color, fontWeight: 800, fontSize: 13 }}>{plan.icon} {plan.label}</div>
                    <div style={{ color: "#94A3B8", fontSize: 11.5, fontWeight: 500, marginTop: 2 }}>
                      {plan.monthlyPrice ? `₩${plan.monthlyPrice.toLocaleString()}/월` : "상담"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => {
                const [label, ...vals] = row;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    <td style={{ padding: "10px 18px", color: "#475569", fontSize: 13.5, fontWeight: 500 }}>{label}</td>
                    {vals.map((v, j) => (
                      <td key={j} style={{ padding: "10px 14px", textAlign: "center", background: PLAN_CONFIG[j]?.highlight ? PLAN_CONFIG[j].colorBg + "80" : "transparent" }}>
                        <CellVal v={v} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 푸터 */}
        <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, lineHeight: 2.4 }}>
          <div>고용지원금 매니저 Pro · 컨설턴트·노무사를 위한 고용지원금 전문 운영 시스템</div>
          <div>현재 베타 기간으로 모든 기능을 무료로 이용하실 수 있습니다</div>
          <div>도입 문의 · support@hrsubsidy.kr</div>
        </div>
      </div>

      {/* 반응형 */}
      <style>{`
        @media (max-width: 1100px) { .plan-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 580px)  { .plan-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
