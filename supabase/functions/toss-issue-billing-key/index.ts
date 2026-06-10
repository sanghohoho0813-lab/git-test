// ============================================================
// toss-issue-billing-key — 토스페이먼츠 빌링키 발급 + 첫 결제 (1단계)
//
// 흐름:
//   1) 로그인 JWT 검증 → 사용자 확인
//   2) customerKey(org_id)가 본인 소속 조직인지 검증
//   3) plan_key 검증 + 금액은 "서버에서만" 결정 (프론트 금액 불신뢰)
//   4) 토스 API: authKey → billingKey 발급 (Basic 인증: secretKey + ":")
//   5) billing_keys upsert (service role 전용 테이블)
//   6) 발급된 billingKey 로 첫 달 즉시 청구
//   7) payment_history 기록 (성공/실패 모두)
//   8) 성공 시 subscriptions → active + 런칭가 고정 정보 저장
//
// 자동 갱신 스케줄러/재시도/해지는 다음 단계 (이 함수는 최초 1회 결제만).
// 응답은 항상 200 + { ok: boolean } 형태 (클라이언트 처리 단순화).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// 가격 단일 출처 — 프론트가 보낸 금액은 절대 사용하지 않는다.
const PLAN_PRICES: Record<string, { regular: number; launch: number; name: string }> = {
  starter: { regular: 39000,  launch: 29000, name: "컨설턴트 스타터" },
  pro:     { regular: 79000,  launch: 59000, name: "컨설턴트 프로" },
  team:    { regular: 129000, launch: 99000, name: "팀/사무소" },
};
// 런칭가 가입 마감: 2026-06-30 23:59:59 KST 까지 "결제 시작"한 고객은 런칭가 고정
const LAUNCH_DEADLINE = new Date("2026-06-30T23:59:59+09:00");

const TOSS_API = "https://api.tosspayments.com";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { authKey, customerKey, planKey } = await req.json();

    // ── 1. 로그인 사용자 확인 (요청에 실린 JWT 사용) ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supaAuth.auth.getUser();
    if (!user) return json({ ok: false, error: "로그인이 필요합니다. 다시 로그인 후 시도해주세요." });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 2. customerKey(org_id) 소속 검증 ──
    if (!customerKey || typeof customerKey !== "string") {
      return json({ ok: false, error: "조직 정보(customerKey)가 없습니다." });
    }
    const { data: mem } = await admin
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", customerKey)
      .maybeSingle();
    if (!mem) return json({ ok: false, error: "해당 조직에 대한 결제 권한이 없습니다." });
    const orgId: string = mem.org_id;

    // ── 3. plan 검증 + 서버 가격 결정 ──
    const plan = PLAN_PRICES[planKey];
    if (!plan) return json({ ok: false, error: "알 수 없는 요금제입니다: " + planKey });
    if (!authKey) return json({ ok: false, error: "카드 등록 정보(authKey)가 없습니다. 처음부터 다시 시도해주세요." });

    const now = new Date();
    const launchLocked = now.getTime() <= LAUNCH_DEADLINE.getTime();
    const amount = launchLocked ? plan.launch : plan.regular;

    const secretKey = Deno.env.get("TOSS_SECRET_KEY");
    if (!secretKey) {
      return json({ ok: false, error: "서버에 결제 키(TOSS_SECRET_KEY)가 설정되지 않았습니다. 관리자에게 문의해주세요." });
    }
    // 토스 Basic 인증: "시크릿키:" (콜론 포함) 을 base64 인코딩
    const basicAuth = "Basic " + btoa(secretKey + ":");

    // ── 4. billingKey 발급 ──
    const issueRes = await fetch(`${TOSS_API}/v1/billing/authorizations/issue`, {
      method: "POST",
      headers: { Authorization: basicAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ authKey, customerKey: orgId }),
    });
    const issue = await issueRes.json();
    if (!issueRes.ok) {
      console.error("[toss-issue] billingKey 발급 실패:", issue.code, issue.message);
      return json({ ok: false, code: issue.code, error: "카드 등록에 실패했습니다: " + (issue.message || issue.code || "알 수 없는 오류") });
    }
    const billingKey: string = issue.billingKey;
    const cardCompany: string | null = issue.cardCompany || issue.card?.company || null;
    const cardMasked: string | null = issue.card?.number || issue.cardNumber || null;

    // ── 5. billingKey 저장 (클라이언트 접근 불가 테이블) ──
    const { error: bkErr } = await admin.from("billing_keys").upsert({
      org_id: orgId,
      billing_key: billingKey,
      customer_key: orgId,
      card_company: cardCompany,
      card_masked: cardMasked,
      updated_at: now.toISOString(),
    }, { onConflict: "org_id" });
    if (bkErr) {
      console.error("[toss-issue] billing_keys 저장 실패:", bkErr.message);
      return json({ ok: false, error: "카드 정보 저장에 실패했습니다. 잠시 후 다시 시도해주세요." });
    }

    // ── 6. 첫 달 즉시 청구 ──
    // orderId: org 앞 8자 + 청구 연월 + 타임스탬프 → 전역 유니크 (payment_history.order_id UNIQUE)
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const orderId = `${orgId.slice(0, 8)}-${ym}-${Date.now()}`;
    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();

    const chargeRes = await fetch(`${TOSS_API}/v1/billing/${billingKey}`, {
      method: "POST",
      headers: { Authorization: basicAuth, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerKey: orgId,
        amount,
        orderId,
        orderName: `고용지원금 Pro ${plan.name} (월간)`,
        customerEmail: user.email || undefined,
        customerName: org?.name || undefined,
      }),
    });
    const charge = await chargeRes.json();

    if (!chargeRes.ok) {
      console.error("[toss-issue] 첫 결제 실패:", charge.code, charge.message);
      // 실패 이력도 기록 (서비스 개선·CS 대응용)
      await admin.from("payment_history").insert({
        org_id: orgId,
        order_id: orderId,
        amount,
        status: "failed",
        plan_key: planKey,
        billing_period: "monthly",
        launch_price: launchLocked,
        error_code: charge.code || null,
        error_message: charge.message || null,
      });
      return json({ ok: false, code: charge.code, error: "결제에 실패했습니다: " + (charge.message || charge.code || "카드사 승인 거절") });
    }

    // ── 7. 결제 이력 저장 ──
    const nowIso = now.toISOString();
    await admin.from("payment_history").insert({
      org_id: orgId,
      order_id: orderId,
      payment_key: charge.paymentKey || null,
      amount,
      status: "paid",
      plan_key: planKey,
      billing_period: "monthly",
      launch_price: launchLocked,
      receipt_url: charge.receipt?.url || null,
      paid_at: charge.approvedAt || nowIso,
    });

    // ── 8. 구독 활성화 ──
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { error: subErr } = await admin.from("subscriptions").upsert({
      org_id: orgId,
      status: "active",
      plan: "monthly",
      plan_key: planKey,
      billing_period: "monthly",
      price_amount: amount,
      regular_price_amount: plan.regular,
      launch_price_locked: launchLocked,
      launch_price_deadline: LAUNCH_DEADLINE.toISOString(),
      billing_started_at: nowIso,
      toss_customer_key: orgId,
      current_period_end: periodEnd.toISOString(),
      last_payment_at: nowIso,
      fail_count: 0,
      cancel_at_period_end: false,
      updated_at: nowIso,
    }, { onConflict: "org_id" });
    if (subErr) {
      // 결제는 성공했는데 DB 갱신 실패 — 치명적이므로 로그 + 안내 (수동 복구 가능하도록 orderId 노출)
      console.error("[toss-issue] subscriptions 갱신 실패:", subErr.message, "orderId:", orderId);
      return json({ ok: false, error: "결제는 완료되었으나 구독 상태 반영에 실패했습니다. 고객센터에 주문번호(" + orderId + ")로 문의해주세요." });
    }

    return json({
      ok: true,
      amount,
      launchPriceLocked: launchLocked,
      orderId,
      cardCompany,
      cardMasked,
      periodEnd: periodEnd.toISOString(),
    });
  } catch (e) {
    console.error("[toss-issue] 예외:", e);
    return json({ ok: false, error: "결제 처리 중 오류가 발생했습니다: " + ((e as Error)?.message || String(e)) });
  }
});
