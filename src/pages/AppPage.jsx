import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useData } from "../hooks/useData";
import { useSub } from "../hooks/useSub";
import { trackActivity } from "../lib/activity";
import { isAccessAllowed, PRODUCT_NAME, redeemInviteCode, inviteReasonMessage } from "../lib/product";
import BillingPage from "./BillingPage";
import SubsidyApp from "../components/app/SubsidyApp";

const FF = "'Pretendard','Pretendard Variable',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif";

function AppSkeleton() {
  const card = { background: "#fff", borderRadius: 14, border: "1px solid #F1F5F9", padding: 20 };
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F1F5F9", fontFamily: FF }}>
      {/* 사이드바 스켈레톤 */}
      <div style={{ width: 270, background: "#1E293B", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 14 }} className="hide-mobile">
        <div className="skeleton" style={{ height: 28, width: "80%", background: "rgba(255,255,255,0.12)" }} />
        <div className="skeleton" style={{ height: 14, width: "55%", background: "rgba(255,255,255,0.08)", marginBottom: 18 }} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton" style={{ height: 22, width: "90%", background: "rgba(255,255,255,0.07)" }} />
        ))}
      </div>
      {/* 콘텐츠 스켈레톤 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ height: 76, background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 40px", justifyContent: "space-between" }}>
          <div className="skeleton" style={{ height: 26, width: 200 }} />
          <div className="skeleton" style={{ height: 44, width: 140, borderRadius: 10 }} />
        </div>
        <div style={{ padding: "32px 40px" }}>
          <div className="skeleton" style={{ height: 96, width: "100%", borderRadius: 16, marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={card}>
                <div className="skeleton" style={{ height: 16, width: "50%", marginBottom: 14 }} />
                <div className="skeleton" style={{ height: 32, width: "70%" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid-2-mobile">
            <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
            <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC", fontFamily: FF, padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏛</div>
        <div style={{ width: 30, height: 30, margin: "0 auto 18px", border: "3px solid #E2E8F0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>고용지원금 Pro를 불러오는 중입니다…</div>
        <div style={{ fontSize: 14, color: "#64748B" }}>계정과 구독 상태를 확인하고 있습니다.</div>
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

// 세션은 있는데 org 가 아직 없을 때(신규 가입 직후 트리거 반영 지연 등) 표시.
// 빈 대시보드나 결제 화면으로 보내지 않고, 워크스페이스가 준비될 때까지 자동 재시도한다.
function WorkspaceInit({ onEnsure, onSignOut }) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    async function tick() {
      if (cancelled) return;
      attempts += 1;
      await onEnsure(); // 성공해 org 가 생기면 부모가 이 컴포넌트를 언마운트함
      if (cancelled) return;
      if (attempts >= 5) { setStuck(true); return; }
      setTimeout(tick, 1500);
    }
    const t = setTimeout(tick, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [onEnsure]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC", fontFamily: FF, padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏛</div>
        <div style={{ width: 30, height: 30, margin: "0 auto 18px", border: "3px solid #E2E8F0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>워크스페이스를 준비하고 있습니다…</div>
        <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
          계정 초기 설정을 마무리하는 중입니다. 잠시만 기다려주세요.
        </div>
        {stuck && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 12 }}>
              초기화가 지연되고 있습니다. 새로고침해도 계속되면 잠시 후 다시 시도해주세요.
            </div>
            <button onClick={() => window.location.reload()} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FF, marginRight: 8 }}>새로고침</button>
            <button onClick={onSignOut} style={{ background: "#F1F5F9", color: "#475569", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FF }}>로그아웃</button>
          </div>
        )}
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

// 제품 접근권한이 없거나 차단/만료된 사용자를 위한 안내 화면 (대시보드 진입 차단).
// 기존 가입자도 초대코드를 입력하면 즉시 employment 권한을 활성화할 수 있다.
function AccessGate({ status, onSignOut, onRetry, email }) {
  const blocked = status === "blocked";
  const expired = status === "expired";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const title = blocked ? "이용이 제한된 계정입니다"
    : expired ? "이용 권한이 만료되었습니다"
    : "아직 이용 권한이 없습니다";
  async function activate() {
    if (!code.trim()) { setMsg("초대코드를 입력해 주세요."); return; }
    setBusy(true); setMsg("");
    try {
      const res = await redeemInviteCode(code.trim());
      if (res && res.ok) {
        setMsg("권한이 활성화되었습니다. 잠시 후 이동합니다…");
        await onRetry(); // productAccess 재조회 → approved 면 자동 진입
      } else {
        setMsg(inviteReasonMessage(res && res.reason));
      }
    } catch (e) {
      setMsg("활성화 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
    setBusy(false);
  }
  const canRedeem = !blocked; // 차단 계정은 코드로 자가 활성화 불가
  return (
    <div style={{ fontFamily: FF, minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: "40px 32px", maxWidth: 440, width: "100%", textAlign: "center", boxShadow: "0 12px 40px rgba(15,23,42,0.12)", border: "1px solid #E8EDF3" }}>
        <div style={{ fontSize: 52, marginBottom: 14 }}>{blocked ? "🚫" : expired ? "⏳" : "🔒"}</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 21, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.4px" }}>{title}</h2>
        <p style={{ color: "#64748B", fontSize: 15, lineHeight: 1.7, margin: 0 }}>
          이 계정({email})은 {PRODUCT_NAME} 이용 권한이 확인되지 않았습니다.<br />
          {blocked ? "이용 권한이 만료되었거나 차단되었습니다. 관리자에게 문의해 주세요." : "초대코드가 있으신 경우 아래에 입력해 권한을 활성화해 주세요."}
        </p>

        {canRedeem && (
          <div style={{ marginTop: 22, textAlign: "left" }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>초대코드</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="관리자에게 받은 초대코드"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: FF }} />
            <button onClick={activate} disabled={busy}
              style={{ width: "100%", marginTop: 10, background: busy ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: 11, padding: "12px", fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: FF }}>
              {busy ? "확인 중…" : "초대코드로 권한 활성화"}
            </button>
            {msg && <div style={{ marginTop: 10, fontSize: 13.5, color: msg.indexOf("활성화되었습니다") >= 0 ? "#059669" : "#DC2626", fontWeight: 600 }}>{msg}</div>}
            <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 10, lineHeight: 1.6 }}>초대코드가 없으신 경우 관리자(ksh90813@naver.com)에게 문의해 주세요.</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 22, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onRetry} style={{ background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0", borderRadius: 11, padding: "11px 20px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>권한 다시 확인</button>
          <button onClick={onSignOut} style={{ background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0", borderRadius: 11, padding: "11px 20px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: FF }}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}

export default function AppPage() {
  const { org, profile, orgRole, signOut, updateProfile, authLoading, session, ensureWorkspace, productAccess, refreshAccess } = useAuth();
  const { sub, isExpired, trialDaysLeft, loading: subLoading } = useSub(org);
  const data = useData(org?.id);
  const [showBilling, setShowBilling] = useState(false);

  const handleEnsure = useCallback(() => ensureWorkspace && ensureWorkspace(), [ensureWorkspace]);

  // 앱 진입 시 마지막 활동 기록 (자동 로그아웃 없음 · 5분 throttle).
  useEffect(() => {
    if (session?.user?.id && org?.id) {
      trackActivity(
        { userId: session.user.id, userEmail: session.user.email, orgId: org.id, orgName: org.name },
        "app.open"
      );
    }
  }, [session?.user?.id, org?.id]);

  // 인증·구독 상태가 확정되기 전에는 절대 paywall/대시보드를 먼저 렌더링하지 않는다.
  if (authLoading) {
    return <AppLoading />;
  }

  // 제품(employment) 접근권한 확인 — 권한이 없으면 대시보드 대신 접근 차단 화면.
  // 운영자(ksh90813) 계정은 안전상 예외로 둔다. (그 외는 user_product_access 기준)
  const isOperator = (session?.user?.email || "").trim().toLowerCase() === "ksh90813@naver.com";
  if (session && !isOperator && !isAccessAllowed(productAccess)) {
    return <AccessGate status={productAccess?.status} email={session?.user?.email || ""} onSignOut={signOut} onRetry={refreshAccess} />;
  }

  // 세션은 있는데 org 가 아직 없으면(신규 가입 직후 트리거 반영 지연 등)
  // 빈 대시보드/결제 화면 대신 초기화 화면을 보여주고 워크스페이스가 준비될 때까지 재시도한다.
  if (session && !org) {
    return <WorkspaceInit onEnsure={handleEnsure} onSignOut={signOut} />;
  }

  // org 확정 후 구독/데이터 로딩 동안 로딩 화면 유지
  if (subLoading || data.loading) {
    return <AppLoading />;
  }

  // 무료체험 중(trialing)·유료(active)면 그대로 대시보드 진입.
  // 체험까지 끝난 만료 상태(isExpired)에서만 결제 화면을 강제하고,
  // 그 외에는 사용자가 사이드바 "구독" 버튼을 눌러 명시적으로 열 때만 표시한다.
  // 관리자(운영자) 계정은 결제 대상이 아니므로 구독 상태와 무관하게 강제 이동에서 제외.
  const isAdminUser = (session?.user?.email || "").trim().toLowerCase() === "ksh90813@naver.com";
  if ((isExpired && !isAdminUser) || showBilling) {
    return <BillingPage onBack={(!isExpired || isAdminUser) ? () => setShowBilling(false) : null} />;
  }

  return (
    <SubsidyApp
      companies={data.companies}
      employees={data.employees}
      calendarMemos={data.calendarMemos}
      addCompany={data.addCompany}
      updateCompany={data.updateCompany}
      deleteCompany={data.deleteCompany}
      addEmployee={data.addEmployee}
      updateEmployee={data.updateEmployee}
      deleteEmployee={data.deleteEmployee}
      saveCalendarMemo={data.saveCalendarMemo}
      uploadFile={data.uploadFile}
      getFileUrl={data.getFileUrl}
      deleteFile={data.deleteFile}
      profile={profile}
      onUpdateProfile={updateProfile}
      orgName={org?.name}
      orgRole={orgRole}
      userEmail={session?.user?.email || ""}
      orgId={org?.id || null}
      userId={session?.user?.id || null}
      onSignOut={signOut}
      onSaveCompany={data.addCompany}
      onPatchCompany={data.patchCompany}
      onDeleteCompany={data.deleteCompany}
      onSaveEmployee={data.addEmployee}
      onPatchEmployee={data.patchEmployee}
      onDeleteEmployee={data.deleteEmployee}
      onBulkSaveCompanies={data.addCompaniesBulk}
      onBulkSaveEmployees={data.addEmployeesBulk}
      onDeleteSampleRows={data.deleteSampleRows}
      programs={profile?.settings?.customPrograms}
      onSavePrograms={(map) => updateProfile({ settings: { ...(profile?.settings || {}), customPrograms: map } })}
      onSaveMemo={data.saveCalendarMemo}
      uploadFn={data.uploadFile}
      getUrlFn={data.getFileUrl}
      onOpenBilling={() => setShowBilling(true)}
      onOpenTeam={() => {}}
      trialDaysLeft={trialDaysLeft}
      plan={sub?.plan_type}
      subStatus={sub?.status}
    />
  );
}
