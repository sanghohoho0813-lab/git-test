import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const TRIAL_DAYS = 14;

// org 는 { id, created_at } 객체 또는 단순 id 문자열 모두 허용 (하위 호환)
export function useSub(org) {
  const orgId = typeof org === "string" ? org : org?.id;
  const orgCreatedAt = typeof org === "object" && org ? org.created_at : null;

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
      .maybeSingle() // row 가 없어도 에러 없이 null 반환
      .then(({ data }) => {
        if (cancelled) return;
        setSub(data);
        setLoadedFor(orgId);
      });
    return () => { cancelled = true; };
  }, [orgId]);

  // orgId 가 있는데 아직 그 org 에 대한 조회가 끝나지 않았으면 로딩 중
  const loading = orgId ? loadedFor !== orgId : false;

  const now = new Date();

  // subscription row 가 없는 경우의 fallback 체험 종료 시각.
  // org.created_at + 14일 기준으로 남은 일수를 계산한다 (없으면 현재 기준).
  const fallbackTrialEnd = (() => {
    const base = orgCreatedAt ? new Date(orgCreatedAt) : now;
    const d = new Date(base);
    d.setDate(d.getDate() + TRIAL_DAYS);
    return d;
  })();

  // 조회는 끝났는데 row 가 없으면 fallback 체험으로 간주한다.
  // (트리거 미적용·RLS 변경 등으로 row 가 누락된 기존/신규 org 가 결제 화면에 갇히는 것을 방지)
  const usingFallback = !loading && !!orgId && !sub;

  const isPaid = !loading && sub?.status === "active";

  const isTrialing = !loading && (
    (sub?.status === "trialing" && new Date(sub.trial_ends_at) > now) ||
    // row 누락은 정상적인 "만료"가 아니라 데이터 이상이므로, 베타 기간에는 잠그지 않고 체험 접근을 허용한다.
    usingFallback
  );

  const isActive = isPaid || isTrialing;

  // 체험도 끝났고 유료도 아닐 때만 만료로 판단 (이때만 강제 결제 화면)
  const isExpired = !loading && !!orgId && !isActive;

  const effectiveTrialEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : fallbackTrialEnd;
  const trialDaysLeft = (sub?.status === "trialing" || usingFallback)
    ? Math.max(0, Math.ceil((effectiveTrialEnd - now) / 86400000))
    : null;

  return { sub, loading, isActive, isPaid, isTrialing, isExpired, trialDaysLeft, usingFallback };
}
