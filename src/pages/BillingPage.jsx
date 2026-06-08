import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useSub } from "../hooks/useSub";
import { supabase } from "../lib/supabase";

const FF = "'Pretendard','Pretendard Variable',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif";

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
    desc: "시작하는 1인 컨설턴트",
    color: "#0891B2",
    colorBg: "#ECFEFF",
    colorBorder: "#A5F3FC",
    badge: null,
    highlight: false,
    isConsult: false,
    monthlyPrice: 39000,
    annualPrice: 390000,
    monthly: { planId: "" },
    annual: { planId: "" },
    ctaText: "스타터로 시작하기",
    limits: { companies: "고객사 10개", employees: "대상자 100명", team: "1인 사용" },
    addOns: null,
    note: null,
    coreFeatures: [
      "D-Day 알림",
      "서류 체크리스트",
      "급여 계산기 · 수령액 시뮬레이터",
      "기본 업무일지",
      "표준 엑셀 양식 가져오기",
    ],
  },
  {
    planKey: "pro",
    icon: "⭐",
    label: "컨설턴트 프로",
    desc: "여러 고객사를 관리하는 전문 컨설턴트",
    color: "#7C3AED",
    colorBg: "#F5F3FF",
    colorBorder: "#7C3AED",
    badge: "가장 많이 선택",
    highlight: true,
    isConsult: false,
    monthlyPrice: 79000,
    annualPrice: 790000,
    monthly: { planId: "" },
    annual: { planId: "" },
    ctaText: "프로 시작하기",
    limits: { companies: "고객사 30개", employees: "대상자 300명", team: "1인 사용" },
    addOns: null,
    note: null,
    coreFeatures: [
      "고객 보고서 자동화",
      "수수료 정산 · 미수금 관리",
      "서류 요청 문구 자동 생성",
      "활동 로그",
      "월별 수령 · 청구 리포트",
      "엑셀 컬럼 매핑 가져오기",
    ],
  },
  {
    planKey: "team",
    icon: "🏛️",
    label: "팀 / 사무소",
    desc: "여러 담당자가 함께 쓰는 노무사·컨설팅팀",
    color: "#059669",
    colorBg: "#ECFDF5",
    colorBorder: "#6EE7B7",
    badge: "팀 협업",
    highlight: false,
    isConsult: false,
    monthlyPrice: 129000,
    annualPrice: 1290000,
    monthly: { planId: "" },
    annual: { planId: "" },
    ctaText: "팀 플랜 시작하기",
    limits: { companies: "고객사 50개", employees: "대상자 700명", team: "팀원 3명 포함" },
    addOns: [
      "추가 고객사 20개당 월 29,000원",
      "추가 팀원 1명당 월 19,000원",
    ],
    note: "고객사 수보다 중요한 건, 여러 담당자가 실수 없이 나눠 관리하는 구조입니다.",
    coreFeatures: [
      "담당자 배정",
      "팀별 활동 로그",
      "고객사별 보고서 일괄 생성",
      "고급 수수료 정산",
      "엑셀 컬럼 매핑 고급",
      "우선 기능 요청",
    ],
  },
  {
    planKey: "vip",
    icon: "👑",
    label: "VIP 온보딩 파트너스",
    desc: "Done-for-you 세팅 서비스 — 전담 구축",
    color: "#92400E",
    colorBg: "#FFFBEB",
    colorBorder: "#FDE68A",
    badge: "전담 구축",
    highlight: false,
    isConsult: true,
    monthlyPrice: null,
    annualPrice: null,
    monthly: { planId: "" },
    annual: { planId: "" },
    priceDisplay: "초기 세팅비 100만 원~\n+ 월 50만 원~",
    ctaText: "도입 상담 문의",
    limits: { companies: "팀/사무소 플랜 포함", employees: "규모 협의", team: "담당 매니저 배정" },
    addOns: null,
    note: null,
    coreFeatures: [
      "기존 엑셀 데이터 이관 대행",
      "고객사 · 대상자 데이터 정리",
      "1:1 온보딩 교육",
      "내부 운영 방식 맞춤 세팅",
      "월 1회 운영 점검",
      "VIP 전용 문의 채널",
    ],
  },
];

const ANNUAL_SAVE_PCT = 17;

// 비교표 — 차이점 확인용. 모든 플랜 공통 포함 기능은 표에서 제외하고 차이 나는 항목만 표시.
// [기능명, starter, pro, team, vip]
const COMPARE_ROWS = [
  ["고객사 수",              "10개",  "30개",  "50개",   "협의"],
  ["대상자 수",              "100명", "300명", "700명",  "협의"],
  ["팀원",                   "1인",   "1인",   "3명+",   "협의"],
  ["고객 보고서",            "기본",  "고급",  "일괄",   "일괄"],
  ["수수료 정산",            "일부",  true,    "고급",   "고급"],
  ["미수금 관리",            false,   true,    true,     true],
  ["서류 문구 자동 생성",     false,   true,    true,     true],
  ["엑셀 컬럼 매핑",         false,   true,    "고급",   "고급"],
  ["활동 로그",              false,   true,    "팀별",   "팀별"],
  ["월별 수령·청구 리포트",   false,   true,    true,     true],
  ["담당자 배정",            false,   false,   true,     true],
  ["보고서 일괄 생성",       false,   false,   true,     true],
  ["엑셀 이관 대행",         false,   false,   false,    true],
  ["1:1 온보딩 · 세팅",      false,   false,   false,    true],
];

// 기능 설명 팝오버 — 추상적 기능명을 직관적으로 풀어주는 정보 UI
// example: 미니 예시 UI 종류 (없으면 설명만 표시)
const FEATURE_INFO = {
  "고객 보고서": {
    title: "고객 보고서 자동화",
    desc: "고객사에 보여줄 진행 현황, 신청 가능 건, 제출 필요 서류를 자동으로 정리해주는 보고서 기능입니다.",
    example: "report",
  },
  "수수료 정산": {
    title: "수수료 정산",
    desc: "고객사별 수수료, 입금 여부, 미수금 현황을 한눈에 정리하는 기능입니다.",
    example: "commission",
  },
  "미수금 관리": {
    title: "미수금 관리",
    desc: "아직 입금되지 않은 수수료를 고객사별로 모아 보여주고, 청구·입금 상태를 추적합니다.",
    example: "commission",
  },
  "서류 문구 자동 생성": {
    title: "서류 요청 문구 자동 생성",
    desc: "고객사에 보낼 '필요 서류 요청' 안내 문구를 대상자·지원금 종류에 맞게 자동으로 만들어 줍니다.",
    example: null,
  },
  "엑셀 컬럼 매핑": {
    title: "엑셀 컬럼 매핑 가져오기",
    desc: "기존 엑셀의 열 이름을 시스템 항목과 연결해 한 번에 가져오는 기능입니다.",
    example: "mapping",
  },
  "활동 로그": {
    title: "활동 로그",
    desc: "누가 언제 어떤 업체에서 어떤 작업을 했는지 기록하는 기능입니다.",
    example: "log",
  },
  "월별 수령·청구 리포트": {
    title: "월별 수령 · 청구 리포트",
    desc: "달마다 실제 수령한 지원금과 청구한 수수료를 비교해 한눈에 보여주는 월간 리포트입니다.",
    example: "monthly",
  },
  "담당자 배정": {
    title: "담당자 배정",
    desc: "고객사마다 담당 컨설턴트를 지정해, 여러 명이 실수 없이 나눠 관리하도록 합니다.",
    example: "assign",
  },
  "보고서 일괄 생성": {
    title: "보고서 일괄 생성",
    desc: "여러 고객사의 보고서를 한 번에 만들어 내려받거나 전달할 수 있는 기능입니다.",
    example: "report",
  },
};

function CellVal({ v, fs }) {
  if (v === true)  return <span style={{ color: "#059669", fontSize: fs(17) }}>✅</span>;
  if (v === false) return <span style={{ color: "#CBD5E1", fontSize: fs(16) }}>—</span>;
  return <span style={{ fontWeight: 700, color: "#475569", fontSize: fs(14) }}>{v}</span>;
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

// 미니 예시 UI 렌더러 — 팝오버 안에 들어가는 작은 인포그래픽
function MiniExample({ kind }) {
  const box = { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12, marginTop: 12 };
  const cap = { fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" };

  if (kind === "report") {
    const cards = [["신청 가능", "3건", "#2563EB"], ["제출 서류", "5건", "#D97706"], ["예상 수령", "1,240만", "#059669"]];
    return (
      <div style={box}>
        <div style={cap}>보고서 미리보기</div>
        <div style={{ display: "flex", gap: 8 }}>
          {cards.map(([l, v, c], i) => (
            <div key={i} style={{ flex: 1, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#64748B", marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "commission") {
    const rows = [["A상사", "88만", true], ["B물산", "120만", false], ["C테크", "64만", false]];
    return (
      <div style={box}>
        <div style={cap}>정산 현황 예시</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 10px", fontSize: 13 }}>
          <div style={{ color: "#94A3B8", fontWeight: 600 }}>고객사</div>
          <div style={{ color: "#94A3B8", fontWeight: 600, textAlign: "right" }}>수수료</div>
          <div style={{ color: "#94A3B8", fontWeight: 600, textAlign: "right" }}>입금</div>
          {rows.map(([c, f, paid], i) => (
            <Frag key={i}>
              <div style={{ color: "#334155", fontWeight: 600 }}>{c}</div>
              <div style={{ color: "#334155", textAlign: "right" }}>{f}</div>
              <div style={{ textAlign: "right" }}>{paid
                ? <span style={{ color: "#059669", fontWeight: 700 }}>✅ 입금</span>
                : <span style={{ color: "#D97706", fontWeight: 700 }}>⏳ 대기</span>}</div>
            </Frag>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "mapping") {
    const rows = [["성명", "이름"], ["주민번호", "생년월일"], ["입사일", "취업일"]];
    return (
      <div style={box}>
        <div style={cap}>엑셀 열 → 시스템 필드</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map(([a, b], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ flex: 1, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", color: "#475569" }}>{a}</span>
              <span style={{ color: "#7C3AED", fontWeight: 700 }}>→</span>
              <span style={{ flex: 1, background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 6, padding: "4px 8px", color: "#6D28D9", fontWeight: 600 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "log") {
    const rows = [["10:24", "김컨설턴트", "A상사 서류 업로드"], ["09:50", "이매니저", "B물산 신청 완료"], ["어제", "박대표", "C테크 수수료 청구"]];
    return (
      <div style={box}>
        <div style={cap}>최근 활동</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(([t, who, what], i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "baseline" }}>
              <span style={{ color: "#94A3B8", width: 38, flexShrink: 0 }}>{t}</span>
              <span style={{ color: "#7C3AED", fontWeight: 700, flexShrink: 0 }}>{who}</span>
              <span style={{ color: "#475569" }}>{what}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "monthly") {
    const rows = [["수령", 320, "#059669"], ["청구", 410, "#2563EB"]];
    const max = 410;
    return (
      <div style={box}>
        <div style={cap}>6월 요약</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(([l, v, c], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 34, fontSize: 12, color: "#64748B", fontWeight: 600 }}>{l}</span>
              <div style={{ flex: 1, background: "#E2E8F0", borderRadius: 6, height: 14, overflow: "hidden" }}>
                <div style={{ width: `${(v / max) * 100}%`, background: c, height: "100%", borderRadius: 6 }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: c, width: 48, textAlign: "right" }}>{v}만</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "assign") {
    const rows = [["A상사", "김컨설턴트"], ["B물산", "이매니저"], ["C테크", "박대표"]];
    return (
      <div style={box}>
        <div style={cap}>담당자 배정 예시</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map(([c, who], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ flex: 1, color: "#334155", fontWeight: 600 }}>{c}</span>
              <span style={{ color: "#059669", fontWeight: 700 }}>→ {who}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// React.Fragment shorthand (배열 내 다중 셀용)
function Frag({ children }) { return <>{children}</>; }

export default function BillingPage({ onBack }) {
  const { org, profile, signOut } = useAuth();
  const { sub, trialDaysLeft, isTrialing } = useSub(org);
  const [period, setPeriod] = useState("monthly");
  const [textScale, setTextScale] = useState("default"); // default | large — 요금제 페이지 전용 UI 상태
  const [toastMsg, showToast] = useLocalToast();
  const [loading, setLoading] = useState(null);
  const [infoKey, setInfoKey] = useState(null); // 열려 있는 기능 설명 팝오버 키

  const isActive = sub?.status === "active";
  const isExpired = sub && sub.status !== "active" && sub.status !== "trialing";

  // 보기 크기 스케일 — 크게 보기 선택 시 카드/표 텍스트 1단계 확대
  const scale = textScale === "large" ? 1.16 : 1;
  const fs = (n) => Math.round(n * scale);
  const headH = Math.round(106 * scale);
  const priceH = Math.round(78 * scale);

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

  const info = infoKey ? FEATURE_INFO[infoKey] : null;

  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "#F8FAFC", padding: "24px 16px" }}>

      {/* 인라인 토스트 */}
      {toastMsg && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9900, background: "#1E293B", color: "#fff", padding: "14px 26px", borderRadius: 12, fontSize: 15, fontWeight: 600, boxShadow: "0 10px 36px rgba(15,23,42,0.28)", maxWidth: "90vw", textAlign: "center", lineHeight: 1.55 }}>
          ℹ️ {toastMsg}
        </div>
      )}

      {/* 기능 설명 팝오버 (제목 + 설명 + 미니 예시 UI) */}
      {info && (
        <div onClick={() => setInfoKey(null)} style={{ position: "fixed", inset: 0, zIndex: 9800, background: "rgba(15,23,42,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "22px 22px 20px", width: "100%", maxWidth: 360, boxShadow: "0 24px 60px rgba(15,23,42,0.3)", position: "relative" }}>
            <button onClick={() => setInfoKey(null)} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer", lineHeight: 1, fontFamily: FF }}>✕</button>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 10, background: "#EFF6FF", color: "#2563EB", fontSize: 16, fontWeight: 800, marginBottom: 12 }}>ℹ</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>{info.title}</div>
            <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{info.desc}</div>
            {info.example && <MiniExample kind={info.example} />}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1160, margin: "0 auto" }}>

        {/* 상단 내비 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          {onBack
            ? <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: FF }}>← 앱으로 돌아가기</button>
            : <span />}
          <button onClick={signOut} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: 13, cursor: "pointer", fontFamily: FF }}>로그아웃</button>
        </div>

        {/* 히어로 */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ margin: "0 0 18px", fontSize: "clamp(23px,5.5vw,33px)", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.8px", lineHeight: 1.32, wordBreak: "keep-all" }}>
            불필요한 시간은 줄이고,<br />누락되는 지원금은 없도록.<br />영업에만 집중하세요.
          </h1>
          <p style={{ margin: "0 auto", color: "#64748B", fontSize: "clamp(14px,3.8vw,16px)", maxWidth: 540, lineHeight: 1.7, wordBreak: "keep-all" }}>
            신청기한, 서류, 대상자, 수수료, 고객 보고서까지<br />컨설턴트용 고용지원금 운영 시스템 하나로 관리하세요.
          </p>
          {profile?.display_name && (
            <div style={{ marginTop: 12, fontSize: 13, color: "#94A3B8" }}>{profile.display_name} · {org?.name}</div>
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

        {/* 월간/연간 토글 + 보기 크기 토글 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 36 }}>
          <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 12, padding: 4, gap: 4 }}>
            {[["monthly", "월간 결제"], ["annual", "연간 결제"]].map(([k, l]) => {
              const on = period === k;
              return (
                <button key={k} onClick={() => setPeriod(k)}
                  style={{ padding: "12px 30px", borderRadius: 9, border: "none", fontSize: 16, fontWeight: on ? 700 : 500, color: on ? "#1E293B" : "#64748B", background: on ? "#fff" : "transparent", cursor: "pointer", fontFamily: FF, boxShadow: on ? "0 1px 6px rgba(0,0,0,0.10)" : "none", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 8 }}>
                  {l}
                  {k === "annual" && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", background: "#D1FAE5", padding: "2px 8px", borderRadius: 8 }}>{ANNUAL_SAVE_PCT}% 할인</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {/* 월간 선택 시에도 연간 할인 문구 항상 표시 */}
            <div style={{ fontSize: 14, color: "#475569" }}>
              💡 연간 결제 시 약 <strong style={{ color: "#059669" }}>{ANNUAL_SAVE_PCT}% 할인</strong> — 2개월 무료 효과
            </div>
            {/* 보기 크기 토글 */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: 4 }}>
              <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, padding: "0 4px" }}>보기 크기</span>
              {[["default", "기본"], ["large", "크게"]].map(([k, l]) => {
                const on = textScale === k;
                return (
                  <button key={k} onClick={() => setTextScale(k)}
                    style={{ padding: "5px 12px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: on ? 700 : 500, color: on ? "#1E293B" : "#64748B", background: on ? "#F1F5F9" : "transparent", cursor: "pointer", fontFamily: FF }}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 플랜 카드 4개 (구조·높이 통일) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18, marginBottom: 44, alignItems: "stretch" }} className="plan-grid">
          {PLAN_CONFIG.map((plan) => {
            const price = period === "annual" ? plan.annualPrice : plan.monthlyPrice;
            const hl = plan.highlight;
            const isVip = plan.isConsult;

            return (
              <div key={plan.planKey}
                style={{
                  background: isVip ? "linear-gradient(165deg,#FFFCF2,#FEF7E3)" : "#fff",
                  borderRadius: 18,
                  border: hl ? `2.5px solid ${plan.color}` : `1.5px solid ${isVip ? plan.colorBorder : "#E2E8F0"}`,
                  padding: "28px 22px 26px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: hl
                    ? `0 16px 44px ${plan.color}26`
                    : isVip
                    ? `0 6px 22px ${plan.color}1c`
                    : "0 2px 10px rgba(15,23,42,0.05)",
                }}>

                {/* 배지 (절대 위치 — 카드 흐름에 영향 없음) */}
                {plan.badge && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: hl ? plan.color : isVip ? "#92400E" : "#334155",
                    color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 16px", borderRadius: 20,
                    whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(15,23,42,0.2)",
                  }}>
                    {hl ? "⭐ " : isVip ? "👑 " : ""}{plan.badge}
                  </div>
                )}

                {/* 1) 플랜명 + 한 줄 설명 (고정 높이로 가격 시작선 통일) */}
                <div style={{ height: headH, marginBottom: 6 }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{plan.icon}</div>
                  <div style={{ fontSize: fs(18), fontWeight: 800, color: plan.color, marginBottom: 7 }}>{plan.label}</div>
                  <div style={{ fontSize: fs(13.5), color: "#64748B", lineHeight: 1.45 }}>{plan.desc}</div>
                </div>

                {/* 2) 가격 영역 (모든 카드 동일 높이·시작선, 가격 강조 + 여백 확대) */}
                <div style={{ height: priceH, display: "flex", flexDirection: "column", justifyContent: "flex-end", marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #F1F5F9" }}>
                  {isVip ? (
                    <div style={{ fontSize: fs(17), fontWeight: 800, color: "#1E293B", letterSpacing: "-0.3px", lineHeight: 1.5, whiteSpace: "pre-line" }}>{plan.priceDisplay}</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
                        <span style={{ fontSize: fs(34), fontWeight: 800, color: "#0F172A", letterSpacing: "-1.5px", lineHeight: 1 }}>
                          ₩{(price || 0).toLocaleString()}
                        </span>
                        <span style={{ fontSize: fs(16), color: "#94A3B8", paddingBottom: 3, fontWeight: 600 }}>/{period === "annual" ? "년" : "월"}</span>
                      </div>
                      <div style={{ fontSize: fs(13.5), color: "#059669", marginTop: 10, fontWeight: 600 }}>연간 결제 시 {ANNUAL_SAVE_PCT}% 할인</div>
                    </>
                  )}
                </div>

                {/* 3) 규모 요약 박스 */}
                <div style={{ background: plan.colorBg, borderRadius: 10, padding: "12px 14px", marginBottom: 16, border: `1px solid ${plan.colorBorder}` }}>
                  {[plan.limits.companies, plan.limits.employees, plan.limits.team].map((t, i) => (
                    <div key={i} style={{ fontSize: fs(13.5), fontWeight: 700, color: plan.color, lineHeight: 1.9 }}>{t}</div>
                  ))}
                </div>

                {/* 4) 핵심 기능 리스트 (flex:1 — CTA를 하단에 고정) */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
                  {/* 팀 플랜 뉘앙스 문구 */}
                  {plan.note && (
                    <div style={{ fontSize: fs(12.5), color: plan.color, background: plan.colorBg, border: `1px solid ${plan.colorBorder}`, borderRadius: 9, padding: "9px 11px", lineHeight: 1.5, fontWeight: 600, marginBottom: 2 }}>
                      💬 {plan.note}
                    </div>
                  )}
                  {plan.coreFeatures.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: fs(14), color: "#334155" }}>
                      <span style={{ color: "#059669", flexShrink: 0, fontWeight: 700 }}>✓</span>
                      <span style={{ lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                  {/* 팀 플랜 확장 옵션 */}
                  {plan.addOns && (
                    <div style={{ background: "#F8FAFC", borderRadius: 9, padding: "10px 12px", marginTop: 4, borderLeft: `3px solid ${plan.color}` }}>
                      <div style={{ fontSize: fs(11), fontWeight: 700, color: "#94A3B8", marginBottom: 5, textTransform: "uppercase" }}>확장 옵션</div>
                      {plan.addOns.map((a, i) => (
                        <div key={i} style={{ fontSize: fs(12.5), color: "#475569", lineHeight: 1.65 }}>+ {a}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5) CTA (하단 정렬) */}
                <button onClick={() => handleCta(plan)}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 11,
                    border: hl ? "none" : `1.5px solid ${plan.color}`,
                    fontSize: fs(15),
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

        {/* ── 기능 비교표 (차이점 확인용 + 기능 설명 팝오버) ── */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "auto", marginBottom: 16 }}>
          <div style={{ padding: "18px 22px", background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: fs(17), fontWeight: 700, color: "#1E293B" }}>📊 플랜 차이점 비교</div>
            <div style={{ fontSize: fs(12.5), color: "#94A3B8" }}>ⓘ 아이콘을 누르면 기능 설명이 열립니다 &nbsp;·&nbsp; ✅ 포함 · — 미지원</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs(14), minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0", background: "#FAFBFC" }}>
                <th style={{ padding: "14px 18px", textAlign: "left", color: "#64748B", fontWeight: 600, fontSize: fs(13.5), minWidth: 170 }}>기능</th>
                {PLAN_CONFIG.map((plan) => (
                  <th key={plan.planKey} style={{ padding: "14px 14px", textAlign: "center", minWidth: 100, background: plan.highlight ? plan.colorBg : "transparent" }}>
                    <div style={{ color: plan.color, fontWeight: 800, fontSize: fs(14) }}>{plan.icon} {plan.label}</div>
                    <div style={{ color: "#94A3B8", fontSize: fs(12.5), fontWeight: 500, marginTop: 3 }}>
                      {plan.monthlyPrice ? `₩${plan.monthlyPrice.toLocaleString()}/월` : "상담"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => {
                const [label, ...vals] = row;
                const hasInfo = !!FEATURE_INFO[label];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    <td style={{ padding: "12px 18px", color: "#475569", fontSize: fs(14), fontWeight: 500 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {label}
                        {hasInfo && (
                          <button onClick={() => setInfoKey(label)} title="기능 설명 보기"
                            style={{ flexShrink: 0, width: fs(19), height: fs(19), borderRadius: "50%", border: "none", background: "#EFF6FF", color: "#2563EB", fontSize: fs(12), fontWeight: 800, cursor: "pointer", fontFamily: FF, display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                            ?
                          </button>
                        )}
                      </span>
                    </td>
                    {vals.map((v, j) => (
                      <td key={j} style={{ padding: "12px 14px", textAlign: "center", background: PLAN_CONFIG[j]?.highlight ? PLAN_CONFIG[j].colorBg + "80" : "transparent" }}>
                        <CellVal v={v} fs={fs} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 공통 포함 안내 */}
        <div style={{ fontSize: fs(13), color: "#94A3B8", textAlign: "center", marginBottom: 28, lineHeight: 1.7 }}>
          기본 기능(D-Day 알림 · 진행 보드 · 서류 체크리스트 · 급여 계산기 · 업무일지)은 모든 플랜에 공통 포함됩니다.
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
