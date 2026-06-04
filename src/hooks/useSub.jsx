import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useSub(orgId) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    supabase
      .from("subscriptions")
      .select("*")
      .eq("org_id", orgId)
      .single()
      .then(({ data }) => { setSub(data); setLoading(false); });
  }, [orgId]);

  const isActive = sub && (
    sub.status === "active" ||
    (sub.status === "trialing" && new Date(sub.trial_ends_at) > new Date())
  );

  const trialDaysLeft = sub?.status === "trialing"
    ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at) - new Date()) / 86400000))
    : null;

  return { sub, loading, isActive, trialDaysLeft };
}
