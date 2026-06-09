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

-- 이전에 생성된 구 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "feedback_responses_insert" ON feedback_responses;

-- 로그인된 사용자라면 누구나 INSERT 가능 (SELECT/UPDATE/DELETE 정책 없음 = 차단)
CREATE POLICY "feedback_insert_authenticated"
  ON feedback_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
