-- ============================================================
-- 고용지원금 Pro - 사용자 활동(최근 사용) 추적
--   목적: 자동 로그아웃 없이 "마지막 활동 시간"을 기록해
--         운영자가 사용자별 최근 사용 여부/휴면 후보를 파악.
--   설계: 사용자당 1행 upsert (감사 로그가 아닌 "마지막 상태" 스냅샷).
--         클라이언트에서 5분 throttle 로 갱신.
--   보안: 일반 사용자는 본인 행만, 관리자(ksh90813@naver.com)만 전체 조회.
--   ※ 기존 테이블/정책을 일절 변경하지 않는 신규 추가 마이그레이션.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_activity (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email         TEXT,
  org_id             UUID,
  org_name           TEXT,
  last_seen_at       TIMESTAMPTZ,
  last_active_path   TEXT,
  last_active_action TEXT,
  user_agent         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_seen ON user_activity(last_seen_at DESC);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- 본인 행만 INSERT 가능
DROP POLICY IF EXISTS "ua_insert_self" ON user_activity;
CREATE POLICY "ua_insert_self" ON user_activity
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 본인 행만 UPDATE 가능 (upsert 시 사용)
DROP POLICY IF EXISTS "ua_update_self" ON user_activity;
CREATE POLICY "ua_update_self" ON user_activity
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- SELECT: 본인 행 또는 총괄 관리자(ksh90813@naver.com)만
DROP POLICY IF EXISTS "ua_select_self_or_admin" ON user_activity;
CREATE POLICY "ua_select_self_or_admin" ON user_activity
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR lower(auth.jwt() ->> 'email') = 'ksh90813@naver.com'
  );

-- DELETE 정책 없음(=불가). 활동 기록 임의 삭제 방지.
