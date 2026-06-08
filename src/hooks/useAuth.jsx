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
    loadUserData(session.user.id).finally(() => { if (!cancelled) setLoadedFor(session.user.id); });
    return () => { cancelled = true; };
  }, [session]);

  // 세션 확인 전이거나, 로그인 상태인데 아직 org/profile 을 못 불러왔으면 로딩 중
  const authLoading = session === undefined
    ? true
    : (session ? loadedFor !== session.user.id : false);

  async function loadUserData(userId) {
    // maybeSingle: row 가 없어도 에러 없이 null 반환 (단일 결과 기대하지만 없을 수 있음)
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
    setProfile(prof);
    if (mem) {
      setOrg(mem.organizations);
      setOrgRole(mem.role);
    }
  }

  async function signUp(email, password, displayName, teamName) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const userId = data.user.id;

    // 프로필 upsert (재시도 시 중복 방지)
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, display_name: displayName, title: "담당자" }, { onConflict: "user_id" });
    if (profErr) throw profErr;

    // orgId 를 클라이언트에서 생성한다.
    // 이유: organizations.insert().select().single() 을 쓰면
    //   INSERT 는 성공하지만 RETURNING 에 RLS SELECT 정책(is_org_member)이 적용돼
    //   멤버 행이 아직 없는 시점에 0 rows 가 반환 → .single() 에러 → throw → 멤버 행 미생성.
    // UUID 를 직접 생성하면 .select() 없이 INSERT 만 실행하면 된다.
    const orgId = crypto.randomUUID();
    const slug = teamName.replace(/\s+/g, "-").toLowerCase() + "-" + Date.now().toString(36);

    // INSERT without .select() — RETURNING 이 없으므로 RLS SELECT 정책 미적용
    const { error: orgErr } = await supabase
      .from("organizations")
      .insert({ id: orgId, name: teamName, slug });
    if (orgErr) throw orgErr;
    // create_trial_subscription 트리거가 org INSERT 즉시 trialing 구독 행 자동 생성.
    // (마이그레이션 004 미적용 환경에서는 아래 subscription insert 로 fallback)

    // 팀 owner 로 등록
    const { error: memErr } = await supabase.from("organization_members").insert({
      org_id: orgId,
      user_id: userId,
      role: "owner",
    });
    if (memErr) throw memErr;

    // 트리거가 없는 환경(004 미적용)을 위한 subscription fallback — 에러는 무시 (이미 있으면 UNIQUE 충돌)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await supabase.from("subscriptions").upsert({
      org_id: orgId,
      status: "trialing",
      plan: "trial",
      trial_ends_at: trialEnd.toISOString(),
      current_period_end: trialEnd.toISOString(),
    }, { onConflict: "org_id" }).then(() => null).catch(() => null);

    // 모든 행 생성 완료 후 org 를 강제로 로드한다.
    // auth.signUp() 직후 발화하는 onAuthStateChange 가 loadUserData 를 병렬 실행하는데,
    // 그 시점에 멤버 행이 없어 org=null 이 될 수 있다 (race condition).
    // signUp 마지막에 명시적으로 호출해 org 를 올바른 값으로 덮어쓴다.
    await loadUserData(userId);

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

  async function refreshOrg() {
    if (session) await loadUserData(session.user.id);
  }

  return (
    <AuthContext.Provider value={{ session, profile, org, orgRole, authLoading, signUp, signIn, signOut, updateProfile, refreshOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
