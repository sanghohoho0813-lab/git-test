import { useState } from "react";
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

export default function AppPage() {
  const { org, profile, orgRole, signOut, updateProfile, authLoading } = useAuth();
  const { sub, isActive, trialDaysLeft, loading: subLoading } = useSub(org?.id);
  const data = useData(org?.id);
  const [showBilling, setShowBilling] = useState(false);

  // 인증·구독 상태가 확정되기 전에는 절대 paywall/대시보드를 먼저 렌더링하지 않는다.
  if (authLoading || subLoading || data.loading) {
    return <AppLoading />;
  }

  if (!isActive || showBilling) return <BillingPage onBack={isActive ? () => setShowBilling(false) : null} />;

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
