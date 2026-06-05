import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

export function useData(orgId) {
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [calendarMemos, setCalendarMemos] = useState({});
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);
  const companiesRef = useRef([]);
  const employeesRef = useRef([]);

  useEffect(() => { companiesRef.current = companies; }, [companies]);
  useEffect(() => { employeesRef.current = employees; }, [employees]);

  const load = useCallback(async (showLoading = true) => {
    if (!orgId) { setLoading(false); return; }
    if (showLoading) setLoading(true);

    const [{ data: comps }, { data: emps }, { data: memos }] = await Promise.all([
      supabase.from("companies").select("id, data").eq("org_id", orgId).order("created_at"),
      supabase.from("employees").select("id, company_id, data").eq("org_id", orgId).order("created_at"),
      supabase.from("calendar_memos").select("date_key, memos").eq("org_id", orgId),
    ]);

    setCompanies((comps || []).map((r) => ({ ...r.data, id: r.id })));
    setEmployees((emps || []).map((r) => ({ ...r.data, id: r.id, companyId: r.company_id })));

    const memoMap = {};
    (memos || []).forEach((r) => { memoMap[r.date_key] = r.memos; });
    setCalendarMemos(memoMap);

    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();

    // Realtime: 팀원 변경사항 실시간 반영 (silent — no loading screen)
    if (orgId) {
      const channel = supabase
        .channel(`org-${orgId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "companies", filter: `org_id=eq.${orgId}` }, () => load(false))
        .on("postgres_changes", { event: "*", schema: "public", table: "employees", filter: `org_id=eq.${orgId}` }, () => load(false))
        .subscribe();
      channelRef.current = channel;
    }
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [orgId, load]);

  // ── Companies ─────────────────────────────────────────────

  async function addCompany(companyData) {
    const id = companyData.id || crypto.randomUUID();
    setCompanies((prev) => [...prev, { ...companyData, id }]);
    const { error } = await supabase.from("companies").insert({ id, org_id: orgId, data: { ...companyData, id } });
    if (error) {
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      throw error;
    }
    return id;
  }

  async function updateCompany(companyData) {
    const { error } = await supabase
      .from("companies")
      .update({ data: companyData, updated_at: new Date().toISOString() })
      .eq("id", companyData.id)
      .eq("org_id", orgId);
    if (error) throw error;
    setCompanies((prev) => prev.map((c) => (c.id === companyData.id ? companyData : c)));
  }

  // (id, patch) 형태로 호출 — 기존 항목과 병합 후 저장
  async function patchCompany(id, patch) {
    const cur = companiesRef.current.find((c) => c.id === id);
    if (!cur) return;
    const merged = { ...cur, ...patch, id };
    setCompanies((prev) => prev.map((c) => (c.id === id ? merged : c))); // 낙관적 반영
    const { error } = await supabase
      .from("companies")
      .update({ data: merged, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId);
    if (error) {
      setCompanies((prev) => prev.map((c) => (c.id === id ? cur : c))); // 롤백
      throw error;
    }
  }

  async function deleteCompany(companyId) {
    // 소속 직원 먼저 삭제
    await supabase.from("employees").delete().eq("company_id", companyId).eq("org_id", orgId);
    const { error } = await supabase.from("companies").delete().eq("id", companyId).eq("org_id", orgId);
    if (error) throw error;
    setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    setEmployees((prev) => prev.filter((e) => e.companyId !== companyId));
  }

  // ── Employees ─────────────────────────────────────────────

  async function addEmployee(empData) {
    const id = empData.id || crypto.randomUUID();
    const empWithId = { ...empData, id };
    setEmployees((prev) => [...prev, empWithId]);
    const { error } = await supabase.from("employees").insert({
      id,
      org_id: orgId,
      company_id: empData.companyId,
      data: empWithId,
    });
    if (error) {
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      throw error;
    }
    return id;
  }

  async function updateEmployee(empData) {
    const { error } = await supabase
      .from("employees")
      .update({ data: empData, updated_at: new Date().toISOString() })
      .eq("id", empData.id)
      .eq("org_id", orgId);
    if (error) throw error;
    setEmployees((prev) => prev.map((e) => (e.id === empData.id ? empData : e)));
  }

  // (id, patch) 형태로 호출 — 기존 항목과 병합 후 저장
  async function patchEmployee(id, patch) {
    const cur = employeesRef.current.find((e) => e.id === id);
    if (!cur) return;
    const merged = { ...cur, ...patch, id, companyId: cur.companyId };
    setEmployees((prev) => prev.map((e) => (e.id === id ? merged : e))); // 낙관적 반영
    const { error } = await supabase
      .from("employees")
      .update({ data: merged, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId);
    if (error) {
      setEmployees((prev) => prev.map((e) => (e.id === id ? cur : e))); // 롤백
      throw error;
    }
  }

  async function deleteEmployee(empId) {
    const { error } = await supabase.from("employees").delete().eq("id", empId).eq("org_id", orgId);
    if (error) throw error;
    setEmployees((prev) => prev.filter((e) => e.id !== empId));
  }

  // ── Calendar Memos ────────────────────────────────────────

  async function saveCalendarMemo(dateKey, memos) {
    setCalendarMemos((prev) => ({ ...prev, [dateKey]: memos }));
    await supabase.from("calendar_memos").upsert(
      { org_id: orgId, date_key: dateKey, memos, updated_at: new Date().toISOString() },
      { onConflict: "org_id,date_key" }
    );
  }

  // ── File Storage ──────────────────────────────────────────

  async function uploadFile(companyId, empId, file) {
    const ext = file.name.split(".").pop();
    const fileId = uid();
    const path = `${orgId}/${companyId}/${empId || "company"}/${fileId}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) throw error;
    return { id: fileId, name: file.name, storagePath: path, type: file.type };
  }

  async function getFileUrl(storagePath) {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(storagePath, 3600);
    return data?.signedUrl;
  }

  async function deleteFile(storagePath) {
    await supabase.storage.from("attachments").remove([storagePath]);
  }

  return {
    companies, employees, calendarMemos, loading,
    addCompany, updateCompany, patchCompany, deleteCompany,
    addEmployee, updateEmployee, patchEmployee, deleteEmployee,
    saveCalendarMemo,
    uploadFile, getFileUrl, deleteFile,
    reload: load,
  };
}
