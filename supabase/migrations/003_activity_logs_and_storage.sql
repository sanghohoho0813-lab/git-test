-- ============================================================
-- 고용지원금 Pro - 3순위 보안/감사 기반
--   1) 활동(감사) 로그 테이블  : 누가·언제·무엇을 변경했는지 추적
--   2) Storage 파일 접근 정책   : attachments 버킷을 조직 단위로 격리
-- ※ 업무 일지(컨설턴트용 메모, companies.data.notes)와는 별개의 시스템 감사 기록.
-- ============================================================

-- ──────────── 1. 활동 로그 ────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id    UUID,                 -- 삭제된 대상도 추적해야 하므로 FK 미설정(soft reference)
  employee_id   UUID,
  action_type   TEXT,                 -- ex) company.create / employee.update / file.delete
  target_type   TEXT,                 -- ex) company / employee / file / commission / report
  target_id     TEXT,
  before_value  JSONB,
  after_value   JSONB,
  message       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_org      ON activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_company  ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_created  ON activity_logs(org_id, created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 같은 조직 구성원만 조회 가능
CREATE POLICY "act_select" ON activity_logs FOR SELECT USING (is_org_member(org_id));
-- 기록은 본인이, 본인 조직에 대해서만 남길 수 있음
CREATE POLICY "act_insert" ON activity_logs FOR INSERT WITH CHECK (
  is_org_member(org_id) AND (user_id = auth.uid() OR user_id IS NULL)
);
-- 감사 로그는 변조 방지를 위해 UPDATE/DELETE 정책을 만들지 않는다(=불가).

-- ──────────── 2. Storage: attachments 버킷 ────────────
-- 비공개 버킷 생성(이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 경로 규칙: {org_id}/{company_id}/{emp_id|company}/{file_id}.{ext}
-- → 폴더 첫 segment(org_id)가 본인 조직일 때만 접근 허용.
CREATE POLICY "att_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'attachments'
  AND is_org_member( ((storage.foldername(name))[1])::uuid )
);
CREATE POLICY "att_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'attachments'
  AND is_org_member( ((storage.foldername(name))[1])::uuid )
);
CREATE POLICY "att_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'attachments'
  AND is_org_member( ((storage.foldername(name))[1])::uuid )
);
CREATE POLICY "att_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'attachments'
  AND is_org_member( ((storage.foldername(name))[1])::uuid )
);
