-- ============================================================
-- 고용지원금 Pro - 3순위 후속 보안 패치
--   1) subscriptions RLS 강화 (클라이언트는 조회만)
--   2) companies / employees soft delete (deleted_at)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. subscriptions RLS 강화
-- ────────────────────────────────────────────────────────────
-- [문제] 기존 정책:
--   sub_insert  WITH CHECK (true)  → 누구나 임의 구독 행 생성 가능
--   sub_update  USING (true)       → 클라이언트가 status='active' 로 변조 가능(무료 우회)
-- [해결] 클라이언트는 SELECT 만. INSERT/UPDATE/DELETE 정책을 두지 않으면 기본 거부.
--        구독 변경은 Stripe Webhook/Edge Function(service role)이 RLS 우회로 처리.
--        최초 트라이얼 구독은 아래 트리거(SECURITY DEFINER)가 자동 생성 → 클라 INSERT 불필요.

DROP POLICY IF EXISTS "sub_insert" ON subscriptions;
DROP POLICY IF EXISTS "sub_update" ON subscriptions;
DROP POLICY IF EXISTS "sub_select" ON subscriptions;

-- 조직 멤버는 본인 조직 구독만 조회 가능
CREATE POLICY "sub_select" ON subscriptions FOR SELECT USING (is_org_member(org_id));
-- INSERT/UPDATE/DELETE 정책 없음 → 일반 클라이언트는 불가(기본 거부).
-- service role 은 RLS 를 우회하므로 웹훅 upsert/update 는 그대로 동작.

-- 조직 생성 시 14일 트라이얼 구독 자동 생성 (RLS 우회 위해 SECURITY DEFINER)
CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO subscriptions (org_id, status, plan, trial_ends_at, current_period_end)
  VALUES (NEW.id, 'trialing', 'trial', now() + interval '14 days', now() + interval '14 days')
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_trial_subscription ON organizations;
CREATE TRIGGER trg_org_trial_subscription
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_trial_subscription();

-- ────────────────────────────────────────────────────────────
-- 2. Soft delete (companies / employees)
-- ────────────────────────────────────────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 활성(미삭제) 데이터 조회 최적화용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(org_id) WHERE deleted_at IS NULL;

-- 참고: RLS 정책은 deleted_at 과 무관하게 org 격리를 유지한다.
--       "기본 목록에서 숨김"은 애플리케이션 쿼리(useData)에서 deleted_at IS NULL 필터로 처리.
--       향후 복구 UI 는 deleted_at IS NOT NULL 행을 조회해 deleted_at=NULL 로 되돌리면 됨.
