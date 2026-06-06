-- 구독 플랜 유형 구분: individual(개인 업체) | agency(전문가/노무사)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'individual'
    CHECK (plan_type IN ('individual', 'agency'));

-- 기존 레코드는 기본값 individual 적용됨
COMMENT ON COLUMN subscriptions.plan_type IS
  'individual: 단일 업체 사업주, agency: 노무사·컨설팅 사무소';
