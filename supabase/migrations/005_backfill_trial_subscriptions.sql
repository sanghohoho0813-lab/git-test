-- 005_backfill_trial_subscriptions.sql
-- 목적: subscriptions row 가 없는 기존 organization 에 trialing row 를 보충(backfill)한다.
-- 안전성:
--   * 오직 INSERT 만 수행한다. 기존 row 는 ON CONFLICT (org_id) DO NOTHING 으로 절대 건드리지 않는다.
--   * DROP / TRUNCATE / DELETE / UPDATE 없음 → 기존 데이터 삭제·초기화·리셋 없음.
--   * 여러 번 실행해도 안전(idempotent).
-- 체험 종료일: 각 org 의 created_at 기준 +14일. 이미 지난 경우에도 row 를 만들어 두면
--   앱이 created_at 기준으로 정확히 만료를 판단할 수 있다(코드 fallback 과 동일 기준).

INSERT INTO subscriptions (org_id, status, plan, trial_ends_at, current_period_end)
SELECT
  o.id,
  'trialing',
  'trial',
  o.created_at + interval '14 days',
  o.created_at + interval '14 days'
FROM organizations o
LEFT JOIN subscriptions s ON s.org_id = o.id
WHERE s.id IS NULL
ON CONFLICT (org_id) DO NOTHING;
