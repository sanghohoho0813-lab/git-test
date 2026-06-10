-- ============================================================
-- 고용지원금 Pro - 토스페이먼츠 정기구독(빌링) 연동 준비
--   ※ 이 파일은 아직 실행하지 않습니다. 사용자가 내용을 확인한 뒤
--      Supabase SQL Editor 에서 직접 실행합니다.
--
--   가격 정책 (런칭가 고정):
--     · 6월 30일까지 결제를 시작한 고객 → launch_price_locked = true
--     · 현재 플랜을 유지하는 동안 런칭가(price_amount)로 계속 청구
--     · 정상가는 regular_price_amount 에 보관
--     · 해지 후 재가입 / 플랜 변경 / 장기 미납 시 런칭가 유지 여부는
--       추후 정책에 따라 launch_price_locked 값으로 제어
--
--   서버 가격 결정 원칙 (Edge Function 구현 시 필수):
--     · 프론트가 보내는 금액은 절대 신뢰하지 않는다.
--     · 청구액은 서버에서 plan_key + launch_price_locked 로만 결정한다.
--         starter : locked 29,000 / 일반 39,000
--         pro     : locked 59,000 / 일반 79,000
--         team    : locked 99,000 / 일반 129,000
--
--   안전 원칙: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS 만 사용.
--   기존 데이터 변경·삭제 없음. DROP/TRUNCATE/DELETE 없음.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. subscriptions 확장 (additive only)
--    status 값은 기존 체계 재사용: trialing → active → past_due → canceled
-- ────────────────────────────────────────────────────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS toss_customer_key     TEXT,                  -- 토스 customerKey (org_id 사용 권장)
  ADD COLUMN IF NOT EXISTS plan_key              TEXT,                  -- starter | pro | team
  ADD COLUMN IF NOT EXISTS billing_period        TEXT,                  -- monthly | annual
  ADD COLUMN IF NOT EXISTS price_amount          INTEGER,               -- 실제 청구액(원) — 런칭가 고객은 런칭가
  ADD COLUMN IF NOT EXISTS regular_price_amount  INTEGER,               -- 정상가(원) — 표시/정책 변경 대비 보관
  ADD COLUMN IF NOT EXISTS launch_price_locked   BOOLEAN DEFAULT false, -- 런칭가 고정 대상 여부
  ADD COLUMN IF NOT EXISTS launch_price_deadline TIMESTAMPTZ,           -- 런칭가 가입 마감 (예: 2026-06-30 23:59 KST)
  ADD COLUMN IF NOT EXISTS billing_started_at    TIMESTAMPTZ,           -- 첫 결제 시작 시각 (런칭가 판정 기준)
  ADD COLUMN IF NOT EXISTS cancel_at_period_end  BOOLEAN DEFAULT false, -- 기간 만료 시 해지 예약
  ADD COLUMN IF NOT EXISTS last_payment_at       TIMESTAMPTZ,           -- 마지막 결제 성공 시각
  ADD COLUMN IF NOT EXISTS fail_count            INTEGER DEFAULT 0;     -- 연속 결제 실패 횟수 (재시도 제어)

COMMENT ON COLUMN subscriptions.launch_price_locked IS
  '런칭 초기 고객(6/30까지 결제 시작) — 현재 플랜 유지 동안 런칭가 적용. 해지 후 재가입/플랜 변경/장기 미납 시 정책에 따라 false 로 전환 가능';

-- ────────────────────────────────────────────────────────────
-- 2. billing_keys — 토스 billingKey 보관 (service role 전용)
--    · billingKey 는 subscriptions 에 저장하지 않는다.
--      (subscriptions 는 조직 멤버 SELECT 가 열려 있어 노출 위험)
--    · RLS 는 켜되 정책을 만들지 않음 → 일반 클라이언트는 어떤 작업도 불가.
--      Edge Function(service role)만 읽기/쓰기.
--    · 클라이언트에는 card_masked 등 표시용 정보만 별도 API 로 제공.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_keys (
  org_id       UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  billing_key  TEXT NOT NULL,             -- 토스 billingKey (시크릿 키 없이는 단독 결제 불가)
  customer_key TEXT NOT NULL,             -- 발급 시 사용한 customerKey (org_id)
  card_company TEXT,                      -- 표시용: 카드사
  card_masked  TEXT,                      -- 표시용: 마스킹 번호 (****-****-****-1234)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE billing_keys ENABLE ROW LEVEL SECURITY;
-- 정책 없음(의도적) = 기본 거부. service role 만 접근 가능.

-- ────────────────────────────────────────────────────────────
-- 3. payment_history — 결제 이력 (조직 멤버 본인 조직만 조회)
--    · order_id UNIQUE = 스케줄러 중복 실행에도 이중 청구 방지 (멱등성 키)
--      형식 권장: {org_id 앞8자리}-{YYYYMM}-{타임스탬프}
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID REFERENCES organizations(id) ON DELETE CASCADE,
  order_id       TEXT UNIQUE NOT NULL,    -- 토스 orderId (멱등성 보장)
  payment_key    TEXT,                    -- 토스 paymentKey (취소/조회용)
  amount         INTEGER NOT NULL,        -- 청구액(원)
  status         TEXT NOT NULL,           -- paid | failed | refunded
  plan_key       TEXT,                    -- 청구 시점 플랜
  billing_period TEXT,                    -- monthly | annual
  launch_price   BOOLEAN DEFAULT false,   -- 런칭가 청구 여부 (감사 추적용)
  receipt_url    TEXT,                    -- 토스 영수증 URL
  error_code     TEXT,                    -- 실패 시 토스 에러 코드
  error_message  TEXT,                    -- 실패 사유
  paid_at        TIMESTAMPTZ,             -- 결제 승인 시각
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_org ON payment_history(org_id, created_at DESC);

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- 조직 멤버는 본인 조직 결제 이력만 조회 (INSERT/UPDATE/DELETE 정책 없음 = service role 전용)
DROP POLICY IF EXISTS "ph_select" ON payment_history;
CREATE POLICY "ph_select" ON payment_history
  FOR SELECT TO authenticated
  USING (is_org_member(org_id));
