import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PRODUCT_KEY, fetchProductAccess } from "../lib/product";

const AuthContext = createContext(null);

// 같은 사용자의 세션 재발급(토큰 갱신 등)이면 이전 객체 참조를 그대로 유지한다.
// 참조가 바뀌지 않으면 [session] effect 가 재실행되지 않아, 모바일에서 파일 선택기
// 복귀 시 org/접근권한을 다시 불러오며 화면이 초기화(언마운트)되는 것을 방지한다.
function keepIfSameUser(prev, next) {
  var n = next || null;
  if (prev === undefined) return n;            // 최초 1회는 항상 반영
  var pu = prev && prev.user ? prev.user.id : null;
  var nu = n && n.user ? n.user.id : null;
  if (pu && nu && pu === nu) return prev;       // 같은 사용자 → 참조 유지(재로딩 방지)
  return n;                                     // 로그인/로그아웃/사용자 변경만 반영
}

// 비밀번호 재설정(recovery) 진입 여부를 "모듈 로드 시점"에 한 번 캡처한다.
// supabase 클라이언트가 URL 해시의 recovery 토큰을 비동기로 소비·정리하기 전에
// 값을 읽어두어야, 이후 라우팅이 기존 세션으로 대시보드에 들어가는 것을 막을 수 있다.
const INITIAL_RECOVERY = (() => {
  try {
    if (typeof window === "undefined") return false;
    if (window.location.pathname === "/reset-password") return true;
    const h = window.location.hash || "";
    const s = window.location.search || "";
    return /type=recovery/.test(h) || /type=recovery/.test(s);
  } catch (e) { return false; }
})();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [org, setOrg] = useState(null);
  const [orgRole, setOrgRole] = useState(null);
  // 제품(employment) 접근권한. { status, role, expires_at } | null(로딩 전)
  const [productAccess, setProductAccess] = useState(undefined);
  const [loadedFor, setLoadedFor] = useState(null); // org/profile 을 확정한 user id
  // recovery(비밀번호 재설정) 모드. 이 값이 true면 라우터가 기존 세션과 무관하게
  // 무조건 비밀번호 재설정 화면을 우선 렌더링한다(대시보드 자동 진입 차단).
  const [recoveryMode, setRecoveryMode] = useState(INITIAL_RECOVERY);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession((prev) => keepIfSameUser(prev, session));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 비밀번호 재설정 링크로 들어온 경우 Supabase 가 PASSWORD_RECOVERY 이벤트를 발생시킨다.
      // 이때는 절대 대시보드로 보내지 않고 재설정 화면을 유지한다.
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      // 모바일에서 파일 선택기 등으로 앱이 백그라운드→포그라운드로 돌아올 때
      // Supabase 가 토큰 갱신(SIGNED_IN/TOKEN_REFRESHED)을 다시 발생시킨다.
      // 이때 같은 사용자면 session 객체 참조를 유지해, org/접근권한 재로딩 effect 가
      // 다시 돌면서 앱 전체가 "불러오는 중" 으로 언마운트되는 것을 막는다.
      setSession((prev) => keepIfSameUser(prev, session));
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // 세션 확인 전
    if (!session) {
      setProfile(null);
      setOrg(null);
      setOrgRole(null);
      setProductAccess({ status: "none", role: null });
      setLoadedFor("none");
      return;
    }
    let cancelled = false;
    setProductAccess(undefined);
    // 신규 가입 직후에는 DB 트리거(handle_new_user)가 워크스페이스를 만드는 데
    // 약간의 지연이 있을 수 있어 멤버십이 보일 때까지 짧게 재시도한다.
    // 제품 접근권한(employment)도 함께 확정한 뒤 loadedFor 를 세팅한다.
    Promise.all([
      loadUserData(session.user.id, 6),
      fetchProductAccess(session.user.id).then((a) => { if (!cancelled) setProductAccess(a); }),
    ]).finally(() => { if (!cancelled) setLoadedFor(session.user.id); });
    return () => { cancelled = true; };
  }, [session]);

  // 세션 확인 전이거나, 로그인 상태인데 아직 org/profile/접근권한을 못 불러왔으면 로딩 중
  const authLoading = session === undefined
    ? true
    : (session ? (loadedFor !== session.user.id || productAccess === undefined) : false);

  // retries: 멤버십이 아직 없을 때 0.5초 간격으로 추가 조회. 정상 계정은 1회로 끝남.
  async function loadUserData(userId, retries = 0) {
    const [{ data: prof }, { data: mem }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("organization_members")
        .select("role, organizations(*)")
        .eq("user_id", userId)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    if (prof) setProfile(prof);
    if (mem) {
      setProfile(prof);
      setOrg(mem.organizations);
      setOrgRole(mem.role);
      return true;
    }
    // 멤버십 미생성 → 트리거 반영 대기 후 재시도
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return loadUserData(userId, retries - 1);
    }
    return false;
  }

  async function signUp(email, password, displayName, teamName, inviteCode) {
    // 워크스페이스(profile/org/member/subscription) + 제품 접근권한은 DB 트리거
    // handle_new_user 가 auth.users INSERT 시점에 원자적으로 생성한다.
    // 초대코드(invite_code)가 유효하지 않으면 트리거가 예외를 던져 가입 자체가 실패한다.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, team_name: teamName, invite_code: (inviteCode || "").trim() } },
    });
    if (error) throw error;

    // 안전망: 세션이 있으면(이메일 인증 OFF) ensure_user_workspace RPC 를 best-effort 호출.
    // 트리거가 정상 동작하면 RPC 는 기존 org 를 반환만 하고 새로 만들지 않는다(idempotent).
    if (data.session) {
      try {
        await supabase.rpc("ensure_user_workspace", {
          p_display_name: displayName,
          p_team_name: teamName,
        });
      } catch (e) {
        if (import.meta.env.DEV) console.warn("ensure_user_workspace RPC 실패(무시):", e);
      }
    }

    return data;
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function endRecovery() { setRecoveryMode(false); }

  async function updateProfile(updates) {
    if (!session) return;
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: session.user.id, ...updates });
    if (error) throw error;
    setProfile((p) => ({ ...p, ...updates }));
  }

  // org 가 아직 없을 때(트리거 지연 등) 안전망 RPC 를 호출해 워크스페이스를 보장하고 재조회한다.
  async function ensureWorkspace() {
    if (!session) return false;
    try {
      await supabase.rpc("ensure_user_workspace", {});
    } catch (e) {
      if (import.meta.env.DEV) console.warn("ensure_user_workspace RPC 실패:", e);
    }
    return loadUserData(session.user.id, 2);
  }

  async function refreshOrg() {
    if (session) await loadUserData(session.user.id, 2);
  }

  // 제품 접근권한 재조회 (권한 부여 후 새로고침 없이 반영용)
  async function refreshAccess() {
    if (!session) return { status: "none", role: null };
    const a = await fetchProductAccess(session.user.id);
    setProductAccess(a);
    return a;
  }

  return (
    <AuthContext.Provider value={{ session, profile, org, orgRole, authLoading, productAccess, productKey: PRODUCT_KEY, refreshAccess, signUp, signIn, signOut, updateProfile, refreshOrg, ensureWorkspace, recoveryMode, endRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
