import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useData } from "../hooks/useData";
import { useSub } from "../hooks/useSub";
import BillingPage from "./BillingPage";
import SubsidyApp from "../components/app/SubsidyApp";

const FF = "'Noto Sans KR',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

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

export default function AppPage() {
  const { org, profile, orgRole, signOut, updateProfile, authLoading, session, ensureWorkspace } = useAuth();
  const { sub, isExpired, trialDaysLeft, loading: subLoading } = useSub(org);
  const data = useData(org?.id);
  const [showBilling, setShowBilling] = useState(false);

  const handleEnsure = useCallback(() => ensureWorkspace && ensureWorkspace(), [ensureWorkspace]);

  // 인증·구독 상태가 확정되기 전에는 절대 paywall/대시보드를 먼저 렌더링하지 않는다.
  if (authLoading) {
    return <AppLoading />;
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
  if (isExpired || showBilling) return <BillingPage onBack={!isExpired ? () => setShowBilling(false) : null} />;

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
      onSignOut={signOut}
      onSaveCompany={data.addCompany}
      onPatchCompany={data.patchCompany}
      onDeleteCompany={data.deleteCompany}
      onSaveEmployee={data.addEmployee}
      onPatchEmployee={data.patchEmployee}
      onDeleteEmployee={data.deleteEmployee}
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
