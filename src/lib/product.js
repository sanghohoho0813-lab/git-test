// ============================================================
// 제품(SaaS)별 접근권한 — 3개 SaaS 공통 구조에서 이 앱의 식별자.
// 다른 앱에서는 PRODUCT_KEY 만 'labcare' / 'consulting' 으로 바꾸면 된다.
// ============================================================
import { supabase } from "./supabase";

export const PRODUCT_KEY = "employment";
export const PRODUCT_NAME = "고용지원금 매니저 Pro";

// 초대코드 사전 검증 (회원가입 전, anon 호출 가능).
// 반환: { valid:boolean, reason?:string, product_key?, role?, label? }
export async function validateInviteCode(code) {
  const { data, error } = await supabase.rpc("validate_invite_code", { p_code: code });
  if (error) return { valid: false, reason: "error", message: error.message };
  return data || { valid: false, reason: "error" };
}

const REASON_MSG = {
  empty: "초대코드를 입력해 주세요.",
  not_found: "존재하지 않는 초대코드입니다.",
  inactive: "사용할 수 없는(비활성) 초대코드입니다.",
  expired: "만료된 초대코드입니다.",
  exhausted: "사용 횟수가 모두 소진된 초대코드입니다.",
  error: "초대코드 확인 중 오류가 발생했습니다.",
};
export function inviteReasonMessage(reason) {
  return REASON_MSG[reason] || "유효하지 않은 초대코드입니다.";
}

// 로그인한 기존 사용자가 초대코드로 접근권한을 직접 활성화.
// 반환: { ok:boolean, reason?, product_key?, role?, message? }
export async function redeemInviteCode(code) {
  const { data, error } = await supabase.rpc("redeem_invite_code", { p_code: code });
  if (error) return { ok: false, reason: "error", message: error.message };
  return data || { ok: false, reason: "error" };
}

// 현재 로그인 사용자의 이 제품 접근권한 1건 조회.
// 반환: { status: 'approved'|'pending'|'blocked'|'expired'|'none', role, expires_at } | null(미인증)
export async function fetchProductAccess(userId) {
  if (!userId) return { status: "none", role: null };
  const { data, error } = await supabase
    .from("user_product_access")
    .select("role, status, expires_at")
    .eq("user_id", userId)
    .eq("product_key", PRODUCT_KEY)
    .maybeSingle();
  if (error || !data) return { status: "none", role: null };
  let status = data.status;
  if (status === "approved" && data.expires_at && new Date(data.expires_at) <= new Date()) {
    status = "expired";
  }
  return { status, role: data.role, expires_at: data.expires_at };
}

// 접근 허용 여부 (대시보드 진입 가능?)
export function isAccessAllowed(access) {
  return !!access && access.status === "approved";
}

function fmtYmd(s) {
  if (!s) return "";
  const d = new Date(s);
  return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
}

// 사이드바 등에 표시할 "이용 가능 기간" 라벨.
// 반환: { text, tone } tone: 'admin'|'unlimited'|'normal'|'soon'|'expired'
export function accessPeriodLabel(access, isAdmin) {
  if (isAdmin || (access && access.role === "admin")) {
    return { text: "관리자 계정 · 이용 제한 없음", tone: "admin" };
  }
  const exp = access && access.expires_at;
  if (!exp) return { text: "이용 가능 기간: 제한 없음", tone: "unlimited" };
  const end = new Date(exp);
  const days = Math.ceil((end - new Date()) / 86400000);
  if (days < 0) return { text: "이용 기간 만료: " + fmtYmd(exp), tone: "expired" };
  if (days <= 3) return { text: "이용 가능 기간: " + fmtYmd(exp) + "까지 (D-" + days + ")", tone: "soon" };
  return { text: "이용 가능 기간: " + fmtYmd(exp) + "까지", tone: "normal" };
}

// 관리자 목록 만료일 표시용. 반환 { text, tone }
export function expiryLabel(expiresAt) {
  if (!expiresAt) return { text: "제한 없음", tone: "none" };
  const days = Math.ceil((new Date(expiresAt) - new Date()) / 86400000);
  if (days < 0) return { text: "만료됨 (" + fmtYmd(expiresAt) + ")", tone: "expired" };
  if (days <= 3) return { text: fmtYmd(expiresAt) + " (D-" + days + ")", tone: "soon" };
  return { text: fmtYmd(expiresAt), tone: "ok" };
}
