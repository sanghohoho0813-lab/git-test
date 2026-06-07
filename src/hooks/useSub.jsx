import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useSub(orgId) {
  const [sub, setSub] = useState(null);
  // 어떤 orgId 에 대한 구독을 이미 확정했는지 추적 → 로딩 상태를 파생값으로 계산해
  // org 가 바뀌는 순간의 1프레임 깜빡임(구독화면 잠깐 노출)을 제거한다.
  const [loadedFor, setLoadedFor] = useState(null);

  useEffect(() => {
    if (!orgId) { setSub(null); setLoadedFor(null); return; }
    let cancelled = false;
    supabase
      .from("subscriptions")
      .select("*")
      .eq("org_id", orgId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setSub(data);
        setLoadedFor(orgId);
      });
    return () => { cancelled = true; };
  }, [orgId]);

  // orgId 가 있는데 아직 그 org 에 대한 조회가 끝나지 않았으면 로딩 중
  const loading = orgId ? loadedFor !== orgId : false;

  const isActive = !loading && sub && (
    sub.status === "active" ||
    (sub.status === "trialing" && new Date(sub.trial_ends_at) > new Date())
  );

  const trialDaysLeft = sub?.status === "trialing"
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - new Date()) / 86400000))
    : null;

  return { sub, loading, isActive, trialDaysLeft };
}
