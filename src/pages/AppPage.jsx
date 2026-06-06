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

export default function AppPage() {
  const { org, profile, orgRole, signOut, updateProfile } = useAuth();
  const { sub, isActive, trialDaysLeft, loading: subLoading } = useSub(org?.id);
  const data = useData(org?.id);
  const [showBilling, setShowBilling] = useState(false);

  if (subLoading || data.loading) {
    return <AppSkeleton />;
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
