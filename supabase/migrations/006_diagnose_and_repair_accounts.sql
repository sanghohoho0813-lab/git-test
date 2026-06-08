-- ============================================================
-- 006_diagnose_and_repair_accounts.sql
-- 목적: RLS 수동 활성화 이후 생성된 꼬인 계정 진단 및 복구
-- 적용 방법: Supabase SQL Editor에 붙여넣기 전 반드시 사용자 확인
-- 안전성: SELECT 진단 → 확인 후 INSERT-only 복구 (DELETE/UPDATE/DROP 없음)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. 진단 쿼리 (읽기 전용 — 먼저 이것만 실행해 현황 파악)
-- ──────────────────────────────────────────────────────────────

-- [진단 1] organization_members row 가 없는 organizations
-- → 해당 org 의 owner 가 로그인해도 org=null 이 돼 데이터를 저장할 수 없는 상태
SELECT
  o.id          AS org_id,
  o.name        AS org_name,
  o.slug,
  o.created_at
FROM organizations o
LEFT JOIN organization_members m ON m.org_id = o.id
WHERE m.id IS NULL
ORDER BY o.created_at DESC;

-- [진단 2] organization_members row 가 없는 users
-- → 계정은 있지만 어떤 조직에도 속하지 않아 앱을 사용할 수 없는 상태
SELECT
  p.user_id,
  p.display_name,
  au.email,
  au.created_at AS user_created_at
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
LEFT JOIN organization_members m ON m.user_id = p.user_id
WHERE m.id IS NULL
ORDER BY au.created_at DESC;

-- [진단 3] subscriptions row 가 없는 organizations
-- → 코드 fallback 으로 잠김은 방지되지만, 데이터 정합성을 위해 확인
SELECT
  o.id          AS org_id,
  o.name        AS org_name,
  o.created_at
FROM organizations o
LEFT JOIN subscriptions s ON s.org_id = o.id
WHERE s.id IS NULL
ORDER BY o.created_at DESC;

-- [진단 4] org 는 있는데 member 도 있는데 subscription 만 없는 경우
SELECT
  o.id AS org_id, o.name, o.created_at,
  m.user_id, m.role
FROM organizations o
JOIN organization_members m ON m.org_id = o.id
LEFT JOIN subscriptions s ON s.org_id = o.id
WHERE s.id IS NULL
ORDER BY o.created_at DESC;


-- ──────────────────────────────────────────────────────────────
-- 2. 복구 쿼리 (진단 결과 확인 후 필요한 부분만 선택 실행)
-- 주의: 아래는 INSERT-only. 기존 데이터 변경/삭제 없음.
-- ──────────────────────────────────────────────────────────────

-- [복구 A] subscriptions row 누락 → trialing 로 backfill
-- (이미 migration 005 로 처리됐다면 이 쿼리는 ON CONFLICT DO NOTHING 으로 안전하게 건너뜀)
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


-- ──────────────────────────────────────────────────────────────
-- [복구 B] organization_members 복구 — 주의 사항 읽고 실행
-- ──────────────────────────────────────────────────────────────
-- 복구 B 는 자동화가 어렵습니다.
-- organizations 테이블에 created_by 컬럼이 없기 때문에
-- 어떤 user 가 어떤 org 를 만들었는지 자동으로 매칭할 수 없습니다.
--
-- 수동 복구 방법:
--   1. 진단 쿼리 1 로 member 없는 org 목록을 확인합니다.
--   2. 진단 쿼리 2 로 member 없는 user 목록을 확인합니다.
--   3. org.slug 에 팀 이름 + 타임스탬프가 포함돼 있으므로
--      profiles.display_name, auth.users.email, org.created_at 을 비교해 매칭합니다.
--   4. 매칭된 쌍에 대해 아래 INSERT 를 실행합니다:
--
-- INSERT INTO organization_members (org_id, user_id, role)
-- VALUES ('<org_id>', '<user_id>', 'owner')
-- ON CONFLICT (org_id, user_id) DO NOTHING;
--
-- 5. 삽입 후 해당 user 가 로그인하면 org 가 정상 로드됩니다.
-- ──────────────────────────────────────────────────────────────
