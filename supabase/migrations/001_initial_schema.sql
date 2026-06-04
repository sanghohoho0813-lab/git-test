-- ============================================================
-- 고용지원금 매니저 Pro - 초기 스키마
-- ============================================================

-- 팀/워크스페이스
CREATE TABLE IF NOT EXISTS organizations (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 팀 멤버 (역할: owner | admin | member)
CREATE TABLE IF NOT EXISTS organization_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- 구독 (Stripe 연동)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  status                  TEXT NOT NULL DEFAULT 'trialing',
  plan                    TEXT DEFAULT 'trial',
  trial_ends_at           TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- 개인 프로필
CREATE TABLE IF NOT EXISTS profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  title        TEXT,
  settings     JSONB DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 업체
CREATE TABLE IF NOT EXISTS companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 직원
CREATE TABLE IF NOT EXISTS employees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 캘린더 메모
CREATE TABLE IF NOT EXISTS calendar_memos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  date_key   TEXT NOT NULL,
  memos      JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, date_key)
);

-- 초대 토큰
CREATE TABLE IF NOT EXISTS invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  email      TEXT,
  token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url'),
  role       TEXT DEFAULT 'member',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT now() + interval '7 days'
);

-- ──────────── Indexes ────────────
CREATE INDEX IF NOT EXISTS idx_org_members_user    ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org     ON organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_companies_org       ON companies(org_id);
CREATE INDEX IF NOT EXISTS idx_employees_org       ON employees(org_id);
CREATE INDEX IF NOT EXISTS idx_employees_company   ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_cal_memos_org       ON calendar_memos(org_id);

-- ──────────── RLS 활성화 ────────────
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_memos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations          ENABLE ROW LEVEL SECURITY;

-- ──────────── 헬퍼 함수 ────────────
CREATE OR REPLACE FUNCTION is_org_member(org UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = org AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_org_admin(org UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = org AND user_id = auth.uid() AND role IN ('owner','admin')
  );
$$;

-- ──────────── RLS 정책 ────────────

-- organizations
CREATE POLICY "org_select" ON organizations FOR SELECT USING (is_org_member(id));
CREATE POLICY "org_update" ON organizations FOR UPDATE USING (is_org_admin(id));
CREATE POLICY "org_insert" ON organizations FOR INSERT WITH CHECK (true);

-- organization_members
CREATE POLICY "mem_select" ON organization_members FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "mem_insert" ON organization_members FOR INSERT WITH CHECK (is_org_admin(org_id) OR user_id = auth.uid());
CREATE POLICY "mem_update" ON organization_members FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "mem_delete" ON organization_members FOR DELETE USING (is_org_admin(org_id) AND user_id != auth.uid());

-- subscriptions (Supabase Edge Function 서비스롤로만 변경)
CREATE POLICY "sub_select" ON subscriptions FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "sub_insert" ON subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "sub_update" ON subscriptions FOR UPDATE USING (true);

-- profiles
CREATE POLICY "prof_own"    ON profiles FOR ALL USING (user_id = auth.uid());
CREATE POLICY "prof_team"   ON profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.org_id = om2.org_id
    WHERE om1.user_id = auth.uid() AND om2.user_id = profiles.user_id
  )
);

-- companies
CREATE POLICY "comp_select" ON companies FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "comp_insert" ON companies FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "comp_update" ON companies FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "comp_delete" ON companies FOR DELETE USING (is_org_admin(org_id));

-- employees
CREATE POLICY "emp_select" ON employees FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "emp_insert" ON employees FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "emp_update" ON employees FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "emp_delete" ON employees FOR DELETE USING (is_org_member(org_id));

-- calendar_memos
CREATE POLICY "cal_all" ON calendar_memos FOR ALL USING (is_org_member(org_id));

-- invitations
CREATE POLICY "inv_select" ON invitations FOR SELECT USING (
  is_org_member(org_id) OR
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
CREATE POLICY "inv_insert" ON invitations FOR INSERT WITH CHECK (is_org_admin(org_id));

-- ──────────── Storage 버킷 (Supabase 대시보드에서도 가능) ────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('attachments', 'attachments', false)
-- ON CONFLICT DO NOTHING;
