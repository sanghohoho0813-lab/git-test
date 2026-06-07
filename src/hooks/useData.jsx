import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ── 파일 업로드 제한 (Storage 보안) ─────────────────────────
export const MAX_FILE_MB = 10;
export const ALLOWED_FILE_EXT = ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"];
const ALLOWED_FILE_MIME = [
  "application/pdf",
  "image/jpeg", "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// 업로드 전 형식·용량 검증. 통과하면 null, 실패하면 사용자용 메시지 반환.
export function validateUploadFile(file) {
  if (!file) return "파일이 없습니다.";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_FILE_EXT.includes(ext)) {
    return "허용되지 않는 파일 형식입니다. (PDF·JPG·PNG·DOC·DOCX·XLS·XLSX만 가능)";
  }
  // MIME은 비어 있을 수 있어 확장자 통과 시 보조 검증으로만 사용
  if (file.type && ALLOWED_FILE_MIME.indexOf(file.type) === -1 && !file.type.startsWith("image/")) {
    return "허용되지 않는 파일 형식입니다.";
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return `파일이 너무 큽니다. (최대 ${MAX_FILE_MB}MB)`;
  }
  return null;
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

  // ── 활동(감사) 로그 ───────────────────────────────────────
  // 시스템 감사용 기록. 업무 일지(companies.data.notes)와는 별개.
  // 어떤 경우에도 본 작업이 사용자 액션을 막아서는 안 되므로 fire-and-forget + try/catch.
  async function logActivity(entry) {
    if (!orgId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        org_id: orgId,
        user_id: user?.id || null,
        company_id: entry.companyId || null,
        employee_id: entry.employeeId || null,
        action_type: entry.action || null,
        target_type: entry.targetType || null,
        target_id: entry.targetId != null ? String(entry.targetId) : null,
        before_value: entry.before ?? null,
        after_value: entry.after ?? null,
        message: entry.message || null,
      });
    } catch (e) {
      // 감사 로그 실패는 무시 (UX 차단 금지)
      if (import.meta.env.DEV) console.warn("activity log failed", e);
    }
  }

  // ── Companies ─────────────────────────────────────────────

  async function addCompany(companyData) {
    const id = companyData.id || crypto.randomUUID();
    setCompanies((prev) => [...prev, { ...companyData, id }]);
    const { error } = await supabase.from("companies").insert({ id, org_id: orgId, data: { ...companyData, id } });
    if (error) {
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      throw error;
    }
    if (!companyData.isSample) {
      logActivity({ action: "company.create", targetType: "company", companyId: id, targetId: id, after: { name: companyData.name }, message: `업체 '${companyData.name || ""}' 등록` });
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
    logActivity({ action: "company.update", targetType: "company", companyId: companyData.id, targetId: companyData.id, message: `업체 '${companyData.name || ""}' 정보 수정` });
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
    // notes(업무 일지)만 바뀐 patch는 감사 로그 제외 — 업무 일지 시스템과 중복 방지
    const keys = Object.keys(patch).filter((k) => k !== "notes" && k !== "id");
    if (keys.length > 0) {
      logActivity({ action: "company.update", targetType: "company", companyId: id, targetId: id, message: `업체 정보 변경 (${keys.join(", ")})` });
    }
  }

  async function deleteCompany(companyId) {
    const target = companiesRef.current.find((c) => c.id === companyId);
    // 소속 직원 먼저 삭제
    await supabase.from("employees").delete().eq("company_id", companyId).eq("org_id", orgId);
    const { error } = await supabase.from("companies").delete().eq("id", companyId).eq("org_id", orgId);
    if (error) throw error;
    setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    setEmployees((prev) => prev.filter((e) => e.companyId !== companyId));
    if (!target?.isSample) {
      logActivity({ action: "company.delete", targetType: "company", companyId: companyId, targetId: companyId, before: { name: target?.name }, message: `업체 '${target?.name || ""}' 삭제(소속 직원 포함)` });
    }
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
    if (!empData.isSample) {
      logActivity({ action: "employee.create", targetType: "employee", companyId: empData.companyId, employeeId: id, targetId: id, after: { name: empData.name }, message: `대상자 '${empData.name || ""}' 등록` });
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
    logActivity({ action: "employee.update", targetType: "employee", companyId: empData.companyId, employeeId: empData.id, targetId: empData.id, message: `대상자 '${empData.name || ""}' 정보 수정` });
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
    // 상태 변경/회차 지급 등 의미 있는 변경을 감사 로그로 남김
    const keys = Object.keys(patch).filter((k) => k !== "id" && k !== "companyId");
    if (keys.length > 0) {
      const isStatus = "status" in patch;
      logActivity({
        action: isStatus ? "employee.status_change" : "employee.update",
        targetType: "employee",
        companyId: cur.companyId,
        employeeId: id,
        targetId: id,
        before: isStatus ? { status: cur.status } : undefined,
        after: isStatus ? { status: patch.status } : undefined,
        message: isStatus ? `'${cur.name || ""}' 상태 변경` : `'${cur.name || ""}' 변경 (${keys.join(", ")})`,
      });
    }
  }

  async function deleteEmployee(empId) {
    const target = employeesRef.current.find((e) => e.id === empId);
    const { error } = await supabase.from("employees").delete().eq("id", empId).eq("org_id", orgId);
    if (error) throw error;
    setEmployees((prev) => prev.filter((e) => e.id !== empId));
    if (!target?.isSample) {
      logActivity({ action: "employee.delete", targetType: "employee", companyId: target?.companyId, employeeId: empId, targetId: empId, before: { name: target?.name }, message: `대상자 '${target?.name || ""}' 삭제` });
    }
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
    const reason = validateUploadFile(file);
    if (reason) throw new Error(reason);
    // 파일명에 민감정보가 들어갈 수 있으므로 저장 경로는 임의 id로만 구성한다.
    // (원본 파일명은 DB 메타데이터에만 보관되고 Storage 경로에는 노출되지 않음)
    const ext = (file.name.split(".").pop() || "dat").toLowerCase();
    const fileId = uid();
    const path = `${orgId}/${companyId}/${empId || "company"}/${fileId}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    logActivity({ action: "file.upload", targetType: "file", companyId, employeeId: empId || null, targetId: fileId, message: `파일 업로드: ${file.name}` });
    return { id: fileId, name: file.name, storagePath: path, type: file.type };
  }

  async function getFileUrl(storagePath) {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(storagePath, 3600);
    return data?.signedUrl;
  }

  async function deleteFile(storagePath) {
    const { error } = await supabase.storage.from("attachments").remove([storagePath]);
    if (error) throw error;
    logActivity({ action: "file.delete", targetType: "file", targetId: storagePath, message: `파일 삭제` });
  }

  return {
    companies, employees, calendarMemos, loading,
    addCompany, updateCompany, patchCompany, deleteCompany,
    addEmployee, updateEmployee, patchEmployee, deleteEmployee,
    saveCalendarMemo,
    uploadFile, getFileUrl, deleteFile,
    logActivity,
    reload: load,
  };
}
