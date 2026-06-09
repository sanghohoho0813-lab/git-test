-- 피드백 설문 응답 테이블 (INSERT 전용, 일반 사용자 SELECT 불가)
CREATE TABLE IF NOT EXISTS feedback_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID,
  user_id     UUID,
  user_email  TEXT,
  org_name    TEXT,
  answers     JSONB NOT NULL DEFAULT '{}',
  free_text   TEXT,
  page_path   TEXT,
  user_agent  TEXT,
  app_version TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- authenticated 사용자만 INSERT 가능
CREATE POLICY "feedback_responses_insert" ON feedback_responses
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 일반 사용자 SELECT 정책 없음 (운영자만 Supabase 대시보드 Table Editor에서 확인)
