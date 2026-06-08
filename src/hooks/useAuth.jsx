import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [org, setOrg] = useState(null);
  const [orgRole, setOrgRole] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null); // org/profile 을 확정한 user id

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return; // 세션 확인 전
    if (!session) {
      setProfile(null);
      setOrg(null);
      setOrgRole(null);
      setLoadedFor("none");
      return;
    }
    let cancelled = false;
    // 신규 가입 직후에는 DB 트리거(handle_new_user)가 워크스페이스를 만드는 데
    // 약간의 지연이 있을 수 있어 멤버십이 보일 때까지 짧게 재시도한다.
    loadUserData(session.user.id, 6).finally(() => { if (!cancelled) setLoadedFor(session.user.id); });
    return () => { cancelled = true; };
  }, [session]);

  // 세션 확인 전이거나, 로그인 상태인데 아직 org/profile 을 못 불러왔으면 로딩 중
  const authLoading = session === undefined
    ? true
    : (session ? loadedFor !== session.user.id : false);

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

  async function signUp(email, password, displayName, teamName) {
    // 워크스페이스(profile/org/member/subscription)는 DB 트리거 handle_new_user 가
    // auth.users INSERT 시점에 원자적으로 생성한다. 클라이언트는 더 이상 직접 insert 하지 않는다.
    // 트리거가 raw_user_meta_data 에서 이름/팀명을 읽도록 메타데이터로 전달한다.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, team_name: teamName } },
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

  return (
    <AuthContext.Provider value={{ session, profile, org, orgRole, authLoading, signUp, signIn, signOut, updateProfile, refreshOrg, ensureWorkspace }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
