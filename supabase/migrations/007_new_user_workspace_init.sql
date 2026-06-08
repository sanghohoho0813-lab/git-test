-- ============================================================
-- 007_new_user_workspace_init.sql
-- 목적: 신규 가입 사용자의 워크스페이스(profile/org/member/subscription)를
--       DB 레벨에서 원자적으로 자동 생성한다.
--
-- 배경(근본 원인):
--   RLS 활성화 후, 클라이언트가 organizations.insert().select().single() 로
--   생성하면 RETURNING 절에 RLS SELECT 정책(is_org_member)이 적용된다.
--   첫 organization_members 행이 생기기 전에는 is_org_member(id)=false 이므로
--   RETURNING 이 0 rows → .single() 에러 → 이후 member/subscription insert 가
--   실행되지 못해 org_id/member/subscription 이 NULL 로 남는다.
--
-- 해결:
--   auth.users INSERT 시점에 SECURITY DEFINER 트리거가 RLS 를 우회하여
--   4개 행을 한 트랜잭션에서 생성한다. 클라이언트는 더 이상 직접 insert 하지 않는다.
--
-- 안전성:
--   * 이 파일은 함수/트리거 CREATE 와 INSERT-only 복구만 포함한다.
--   * DROP TABLE / TRUNCATE / DELETE / 기존행 UPDATE 없음.
--   * 모든 INSERT 는 ON CONFLICT DO NOTHING 으로 idempotent.
--   * 기존 정상 계정(멤버십 보유)은 EXISTS 가드로 건드리지 않는다.
--   * subscription 이 이미 있는 org 는 ON CONFLICT 로 건너뛴다.
--
-- ⚠️ 적용 전 반드시 아래 "0. 진단" 쿼리를 먼저 실행해 현황을 확인하세요.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. 진단 (읽기 전용 — 먼저 이것만 실행)
-- ────────────────────────────────────────────────────────────

-- [0-1] 멤버십 없는 auth user (= 워크스페이스 미생성 = 깨진 계정)
SELECT au.id AS user_id, au.email, au.created_at,
       (p.user_id IS NOT NULL) AS has_profile
FROM auth.users au
LEFT JOIN profiles p             ON p.user_id = au.id
LEFT JOIN organization_members m ON m.user_id = au.id
WHERE m.id IS NULL
ORDER BY au.created_at DESC;

-- [0-2] 멤버십 없는 organizations (= orphan org)
SELECT o.id AS org_id, o.name, o.slug, o.created_at
FROM organizations o
LEFT JOIN organization_members m ON m.org_id = o.id
WHERE m.id IS NULL
ORDER BY o.created_at DESC;

-- [0-3] subscription 없는 organizations
SELECT o.id AS org_id, o.name, o.created_at
FROM organizations o
LEFT JOIN subscriptions s ON s.org_id = o.id
WHERE s.id IS NULL
ORDER BY o.created_at DESC;


-- ────────────────────────────────────────────────────────────
-- 1. 신규 가입 자동 초기화 — auth.users 트리거 (PRIMARY)
--    이메일 인증 ON/OFF 무관하게 user 생성 시점에 실행됨.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
  v_team_name    TEXT;
  v_org_id       UUID;
  v_slug         TEXT;
BEGIN
  -- 초대 기반 가입 등 자동 org 생성을 건너뛰고 싶을 때를 위한 escape hatch
  IF COALESCE(NEW.raw_user_meta_data->>'skip_auto_workspace','') = 'true' THEN
    RETURN NEW;
  END IF;

  -- 메타데이터에서 이름/팀명 추출 (없으면 이메일 local-part 기반 기본값)
  v_display_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), split_part(NEW.email,'@',1));
  v_team_name    := COALESCE(NULLIF(NEW.raw_user_meta_data->>'team_name',''), v_display_name || ' 워크스페이스');

  -- 1) profile (이미 있으면 유지)
  INSERT INTO public.profiles (user_id, display_name, title)
  VALUES (NEW.id, v_display_name, '담당자')
  ON CONFLICT (user_id) DO NOTHING;

  -- 이미 멤버십이 있으면(재실행/복구 케이스) org 생성 중단 → 중복 org 방지
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- 2) organization (slug 는 NOT NULL UNIQUE → org_id 일부를 붙여 고유성 보장)
  v_org_id := gen_random_uuid();
  v_slug := lower(regexp_replace(v_team_name, '\s+', '-', 'g')) || '-' || substr(replace(v_org_id::text,'-',''),1,8);

  INSERT INTO public.organizations (id, name, slug)
  VALUES (v_org_id, v_team_name, v_slug);

  -- 3) owner 멤버십
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  -- 4) trialing 구독 (org INSERT 트리거 trg_org_trial_subscription 이 이미 만들면 충돌 무시)
  INSERT INTO public.subscriptions (org_id, status, plan, trial_ends_at, current_period_end)
  VALUES (v_org_id, 'trialing', 'trial', now() + interval '14 days', now() + interval '14 days')
  ON CONFLICT (org_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- 2. 안전망 RPC — 클라이언트가 로그인/가입 후 호출 (idempotent)
--    트리거가 어떤 이유로 누락됐을 때 본인 계정을 스스로 복구.
--    auth.uid() 기준이므로 인증된 세션에서만 동작.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_user_workspace(
  p_display_name TEXT DEFAULT NULL,
  p_team_name    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_org_id  UUID;
  v_email   TEXT;
  v_display TEXT;
  v_team    TEXT;
  v_slug    TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- 이미 멤버십이 있으면 그 org 를 반환(중복 생성 금지) + subscription 만 보충
  SELECT org_id INTO v_org_id
  FROM organization_members
  WHERE user_id = v_uid
  ORDER BY joined_at
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    INSERT INTO subscriptions (org_id, status, plan, trial_ends_at, current_period_end)
    VALUES (v_org_id, 'trialing', 'trial', now() + interval '14 days', now() + interval '14 days')
    ON CONFLICT (org_id) DO NOTHING;
    RETURN v_org_id;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  v_display := COALESCE(NULLIF(p_display_name,''), split_part(v_email,'@',1));
  v_team    := COALESCE(NULLIF(p_team_name,''), v_display || ' 워크스페이스');

  INSERT INTO profiles (user_id, display_name, title)
  VALUES (v_uid, v_display, '담당자')
  ON CONFLICT (user_id) DO NOTHING;

  v_org_id := gen_random_uuid();
  v_slug := lower(regexp_replace(v_team, '\s+', '-', 'g')) || '-' || substr(replace(v_org_id::text,'-',''),1,8);

  INSERT INTO organizations (id, name, slug) VALUES (v_org_id, v_team, v_slug);

  INSERT INTO organization_members (org_id, user_id, role)
  VALUES (v_org_id, v_uid, 'owner')
  ON CONFLICT (org_id, user_id) DO NOTHING;

  INSERT INTO subscriptions (org_id, status, plan, trial_ends_at, current_period_end)
  VALUES (v_org_id, 'trialing', 'trial', now() + interval '14 days', now() + interval '14 days')
  ON CONFLICT (org_id) DO NOTHING;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_workspace(TEXT, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. 기존 orphan 계정 복구 (INSERT-only · idempotent)
--    멤버십 없는 모든 기존 user 에게 profile/org/owner/subscription 보충.
--    재실행해도 이미 복구된 user 는 WHERE 절에서 제외되어 안전.
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  r        RECORD;
  v_org_id UUID;
  v_team   TEXT;
  v_slug   TEXT;
BEGIN
  FOR r IN
    SELECT au.id AS user_id, au.email,
           COALESCE(NULLIF(p.display_name,''), split_part(au.email,'@',1)) AS display_name
    FROM auth.users au
    LEFT JOIN profiles p             ON p.user_id = au.id
    LEFT JOIN organization_members m ON m.user_id = au.id
    WHERE m.id IS NULL
  LOOP
    -- profile 보충
    INSERT INTO profiles (user_id, display_name, title)
    VALUES (r.user_id, r.display_name, '담당자')
    ON CONFLICT (user_id) DO NOTHING;

    -- org 생성
    v_org_id := gen_random_uuid();
    v_team   := r.display_name || ' 워크스페이스';
    v_slug   := lower(regexp_replace(v_team, '\s+', '-', 'g')) || '-' || substr(replace(v_org_id::text,'-',''),1,8);

    INSERT INTO organizations (id, name, slug) VALUES (v_org_id, v_team, v_slug);

    -- owner 멤버십
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (v_org_id, r.user_id, 'owner')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    -- trialing 구독
    INSERT INTO subscriptions (org_id, status, plan, trial_ends_at, current_period_end)
    VALUES (v_org_id, 'trialing', 'trial', now() + interval '14 days', now() + interval '14 days')
    ON CONFLICT (org_id) DO NOTHING;
  END LOOP;
END $$;

-- [복구 보조] 멤버십은 있으나 subscription 만 없는 org 보충 (005 와 동일, 재실행 안전)
INSERT INTO subscriptions (org_id, status, plan, trial_ends_at, current_period_end)
SELECT o.id, 'trialing', 'trial',
       o.created_at + interval '14 days',
       o.created_at + interval '14 days'
FROM organizations o
LEFT JOIN subscriptions s ON s.org_id = o.id
WHERE s.id IS NULL
ON CONFLICT (org_id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 4. 검증 (적용 후 실행 — 모두 0 row 면 정상)
-- ────────────────────────────────────────────────────────────
-- SELECT count(*) AS users_without_membership
-- FROM auth.users au
-- LEFT JOIN organization_members m ON m.user_id = au.id
-- WHERE m.id IS NULL;
--
-- SELECT count(*) AS orgs_without_subscription
-- FROM organizations o
-- LEFT JOIN subscriptions s ON s.org_id = o.id
-- WHERE s.id IS NULL;
