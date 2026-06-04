import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [org, setOrg] = useState(null);
  const [orgRole, setOrgRole] = useState(null);

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
    if (!session) {
      setProfile(null);
      setOrg(null);
      setOrgRole(null);
      return;
    }
    loadUserData(session.user.id);
  }, [session]);

  async function loadUserData(userId) {
    const [{ data: prof }, { data: mem }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase
        .from("organization_members")
        .select("role, organizations(*)")
        .eq("user_id", userId)
        .order("joined_at", { ascending: true })
        .limit(1)
        .single(),
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

    // 프로필 생성
    await supabase.from("profiles").insert({ user_id: userId, display_name: displayName, title: "담당자" });

    // 팀 생성
    const slug = teamName.replace(/\s+/g, "-").toLowerCase() + "-" + Date.now().toString(36);
    const { data: newOrg, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: teamName, slug })
      .select()
      .single();
    if (orgErr) throw orgErr;

    // 팀 owner로 등록
    await supabase.from("organization_members").insert({
      org_id: newOrg.id,
      user_id: userId,
      role: "owner",
    });

    // 무료 트라이얼 구독 생성 (14일)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await supabase.from("subscriptions").insert({
      org_id: newOrg.id,
      status: "trialing",
      plan: "trial",
      trial_ends_at: trialEnd.toISOString(),
      current_period_end: trialEnd.toISOString(),
    });

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
    <AuthContext.Provider value={{ session, profile, org, orgRole, signUp, signIn, signOut, updateProfile, refreshOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
