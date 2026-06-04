import { useAuth } from "../hooks/useAuth";
import { useData } from "../hooks/useData";
import { useSub } from "../hooks/useSub";
import BillingPage from "./BillingPage";
import SubsidyApp from "../components/app/SubsidyApp";

export default function AppPage() {
  const { org, profile, orgRole, signOut, updateProfile } = useAuth();
  const { isActive, trialDaysLeft, loading: subLoading } = useSub(org?.id);
  const data = useData(org?.id);

  if (subLoading || data.loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", color: "#64748B" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div>로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!isActive) return <BillingPage />;

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
      updateProfile={updateProfile}
      org={org}
      orgRole={orgRole}
      signOut={signOut}
      trialDaysLeft={trialDaysLeft}
    />
  );
}
