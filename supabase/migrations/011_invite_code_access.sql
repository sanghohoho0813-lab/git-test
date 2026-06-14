-- ============================================================
-- 011_invite_code_access.sql
-- 목적: 초대코드 기반 회원가입 + 제품별(product_key) 접근권한 관리.
--       3개 SaaS(employment / labcare / consulting)가 공유할 공통 권한 구조.
--
-- 이 앱의 product_key = 'employment'
--
-- 안전성:
--   * 전부 additive: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
--     CREATE OR REPLACE / INSERT ... ON CONFLICT DO NOTHING.
--   * DROP TABLE / TRUNCATE / DELETE / 기존행 파괴 UPDATE 없음.
--   * 최고 관리자(ksh90813@naver.com)만 employment admin/approved 자동 부여.
--   * 그 외 기존 가입자는 'pending' 으로만 기록 → 관리자 승인 전까지 앱 이용 차단.
--   * 신규 가입은 handle_new_user 트리거에서 유효한 초대코드가 없으면 거부(가입 자체 실패).
--
-- ⚠️ 적용 순서: 이 파일(011)을 먼저 적용·검증한 뒤,
--    앱 데이터 테이블(companies/employees 등) RLS 강화는 012 를 별도로 적용하세요.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. 테이블
-- ────────────────────────────────────────────────────────────

-- 기존 profiles 에 관리자/추가정보 컬럼 보강 (additive)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin     BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email        TEXT;

-- 초대코드
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  label       TEXT,
  product_key TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',
  max_uses    INTEGER,
  used_count  INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 사용자별 제품 접근권한 (공통)
CREATE TABLE IF NOT EXISTS public.user_product_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',     -- admin | user | trial | viewer
  status      TEXT NOT NULL DEFAULT 'approved', -- approved | pending | blocked
  expires_at  TIMESTAMPTZ,
  granted_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_key)
);

-- 초대코드 사용 기록
CREATE TABLE IF NOT EXISTS public.invite_code_redemptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID REFERENCES public.invite_codes(id) ON DELETE SET NULL,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_key    TEXT,
  redeemed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upa_user        ON public.user_product_access(user_id);
CREATE INDEX IF NOT EXISTS idx_upa_product     ON public.user_product_access(product_key);
CREATE INDEX IF NOT EXISTS idx_invite_code     ON public.invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_redemption_user ON public.invite_code_redemptions(user_id);


-- ────────────────────────────────────────────────────────────
-- 2. 헬퍼 함수 (SECURITY DEFINER · auth.uid() 기준)
-- ────────────────────────────────────────────────────────────

-- 현재 사용자가 특정 제품에 대해 유효한(approved·미만료) 접근권한을 가졌는가
CREATE OR REPLACE FUNCTION public.has_product_access(p_product TEXT)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_product_access
    WHERE user_id = auth.uid()
      AND product_key = p_product
      AND status = 'approved'
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- 현재 사용자가 해당 제품의 관리자인가 (profiles.is_admin 전역 관리자 포함)
CREATE OR REPLACE FUNCTION public.is_product_admin(p_product TEXT)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
      OR EXISTS (
        SELECT 1 FROM public.user_product_access
        WHERE user_id = auth.uid() AND product_key = p_product
          AND role = 'admin' AND status = 'approved'
      );
$$;

-- 초대코드 유효성 검사 (회원가입 화면에서 가입 전 미리 확인 · anon 호출 허용)
-- 코드 테이블 전체를 노출하지 않고 결과만 반환한다.
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v public.invite_codes%ROWTYPE;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'empty');
  END IF;
  SELECT * INTO v FROM public.invite_codes WHERE code = trim(p_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'reason', 'not_found'); END IF;
  IF NOT v.is_active THEN RETURN jsonb_build_object('valid', false, 'reason', 'inactive'); END IF;
  IF v.expires_at IS NOT NULL AND v.expires_at < now() THEN RETURN jsonb_build_object('valid', false, 'reason', 'expired'); END IF;
  IF v.max_uses IS NOT NULL AND v.used_count >= v.max_uses THEN RETURN jsonb_build_object('valid', false, 'reason', 'exhausted'); END IF;
  RETURN jsonb_build_object('valid', true, 'product_key', v.product_key, 'role', v.role, 'label', v.label);
END;
$$;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_product_access(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_product_admin(TEXT)     TO authenticated;

-- 이미 로그인한 사용자가 초대코드로 직접 접근권한을 활성화 (권한 없음 화면용).
-- 코드 검증 → user_product_access 부여(approved) → used_count++ → 사용기록.
-- SECURITY DEFINER · auth.uid() 기준이라 본인 권한만 부여 가능.
CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_code public.invite_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;

  SELECT * INTO v_code FROM public.invite_codes WHERE code = trim(p_code);
  IF NOT FOUND        THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT v_code.is_active THEN RETURN jsonb_build_object('ok', false, 'reason', 'inactive'); END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exhausted'); END IF;

  -- 권한 부여 (이미 approved 면 그대로 두고, pending/blocked 면 approved 로 승격)
  INSERT INTO public.user_product_access (user_id, product_key, role, status, granted_by)
  VALUES (v_uid, v_code.product_key, COALESCE(v_code.role,'user'), 'approved', v_code.created_by)
  ON CONFLICT (user_id, product_key) DO UPDATE
    SET status = 'approved',
        role = CASE WHEN public.user_product_access.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END,
        updated_at = now();

  UPDATE public.invite_codes SET used_count = used_count + 1 WHERE id = v_code.id;
  INSERT INTO public.invite_code_redemptions (invite_code_id, user_id, product_key)
  VALUES (v_code.id, v_uid, v_code.product_key);

  RETURN jsonb_build_object('ok', true, 'product_key', v_code.product_key, 'role', COALESCE(v_code.role,'user'));
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. 신규 가입 트리거 — 초대코드 검증 + 접근권한 부여
--    (007 의 handle_new_user 를 확장 · 워크스페이스 생성 로직은 그대로 유지)
--    유효한 초대코드가 없으면 RAISE EXCEPTION → auth.users INSERT 자체가 롤백되어
--    가입이 실패한다(= UI 우회 불가, DB 레벨 강제).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_display_name TEXT;
  v_team_name    TEXT;
  v_org_id       UUID;
  v_slug         TEXT;
  v_code_text    TEXT;
  v_code         public.invite_codes%ROWTYPE;
BEGIN
  -- (A) 초대코드 검증 — 메타데이터의 invite_code 사용
  v_code_text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'invite_code','')), '');

  IF v_code_text IS NULL THEN
    RAISE EXCEPTION '초대코드가 필요합니다. 관리자에게 초대코드를 요청해 주세요.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_code FROM public.invite_codes WHERE code = v_code_text;
  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 초대코드입니다.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT v_code.is_active THEN
    RAISE EXCEPTION '사용할 수 없는(비활성) 초대코드입니다.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION '만료된 초대코드입니다.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
    RAISE EXCEPTION '사용 횟수가 모두 소진된 초대코드입니다.' USING ERRCODE = 'check_violation';
  END IF;

  -- (B) 메타데이터에서 이름/팀명 추출
  v_display_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), split_part(NEW.email,'@',1));
  v_team_name    := COALESCE(NULLIF(NEW.raw_user_meta_data->>'team_name',''), v_display_name || ' 워크스페이스');

  -- (C) profile (이메일/이름 포함)
  INSERT INTO public.profiles (user_id, display_name, title, email)
  VALUES (NEW.id, v_display_name, '담당자', NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET email = COALESCE(public.profiles.email, EXCLUDED.email);

  -- (D) 워크스페이스(org/member/subscription) — 기존 로직 유지
  IF COALESCE(NEW.raw_user_meta_data->>'skip_auto_workspace','') <> 'true'
     AND NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = NEW.id) THEN
    v_org_id := gen_random_uuid();
    v_slug := lower(regexp_replace(v_team_name, '\s+', '-', 'g')) || '-' || substr(replace(v_org_id::text,'-',''),1,8);
    INSERT INTO public.organizations (id, name, slug) VALUES (v_org_id, v_team_name, v_slug);
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (v_org_id, NEW.id, 'owner') ON CONFLICT (org_id, user_id) DO NOTHING;
    INSERT INTO public.subscriptions (org_id, status, plan, trial_ends_at, current_period_end)
    VALUES (v_org_id, 'trialing', 'trial', now() + interval '14 days', now() + interval '14 days')
    ON CONFLICT (org_id) DO NOTHING;
  END IF;

  -- (E) 제품 접근권한 부여 (초대코드의 product_key·role 기준)
  INSERT INTO public.user_product_access (user_id, product_key, role, status, granted_by)
  VALUES (NEW.id, v_code.product_key, COALESCE(v_code.role,'user'), 'approved', v_code.created_by)
  ON CONFLICT (user_id, product_key) DO NOTHING;

  -- (F) 초대코드 사용 수 증가 + 사용 기록
  UPDATE public.invite_codes SET used_count = used_count + 1 WHERE id = v_code.id;
  INSERT INTO public.invite_code_redemptions (invite_code_id, user_id, product_key)
  VALUES (v_code.id, NEW.id, v_code.product_key);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- 4. RLS — 새 테이블
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.invite_codes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_product_access     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_code_redemptions ENABLE ROW LEVEL SECURITY;

-- user_product_access: 본인 행만 조회. 관리는 employment 관리자만.
DROP POLICY IF EXISTS upa_select_own ON public.user_product_access;
CREATE POLICY upa_select_own ON public.user_product_access
  FOR SELECT USING (user_id = auth.uid() OR public.is_product_admin(product_key));
DROP POLICY IF EXISTS upa_admin_write ON public.user_product_access;
CREATE POLICY upa_admin_write ON public.user_product_access
  FOR ALL USING (public.is_product_admin(product_key)) WITH CHECK (public.is_product_admin(product_key));

-- invite_codes: 일반 사용자는 목록 조회 불가(검증은 RPC 로). 관리자만 전체 관리.
DROP POLICY IF EXISTS invite_admin_all ON public.invite_codes;
CREATE POLICY invite_admin_all ON public.invite_codes
  FOR ALL USING (public.is_product_admin(product_key)) WITH CHECK (public.is_product_admin(product_key));

-- redemptions: 본인 기록만 조회. 관리자는 전체.
DROP POLICY IF EXISTS redemption_select ON public.invite_code_redemptions;
CREATE POLICY redemption_select ON public.invite_code_redemptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_product_admin(product_key));


-- ────────────────────────────────────────────────────────────
-- 5. 관리자용 RPC (employment 관리자만 실행 가능)
-- ────────────────────────────────────────────────────────────

-- 초대코드 생성
CREATE OR REPLACE FUNCTION public.admin_create_invite_code(
  p_product_key TEXT, p_label TEXT DEFAULT NULL, p_role TEXT DEFAULT 'user',
  p_max_uses INTEGER DEFAULT NULL, p_expires_at TIMESTAMPTZ DEFAULT NULL, p_code TEXT DEFAULT NULL
) RETURNS public.invite_codes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.invite_codes%ROWTYPE; v_code TEXT;
BEGIN
  IF NOT public.is_product_admin(p_product_key) THEN
    RAISE EXCEPTION '관리자만 초대코드를 생성할 수 있습니다.';
  END IF;
  v_code := COALESCE(NULLIF(trim(p_code),''), upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
  INSERT INTO public.invite_codes (code, label, product_key, role, max_uses, expires_at, created_by)
  VALUES (v_code, p_label, p_product_key, COALESCE(p_role,'user'), p_max_uses, p_expires_at, auth.uid())
  RETURNING * INTO v;
  RETURN v;
END;
$$;

-- 사용자 접근권한 부여/변경 (upsert)
CREATE OR REPLACE FUNCTION public.admin_set_product_access(
  p_user_id UUID, p_product_key TEXT, p_role TEXT DEFAULT 'user',
  p_status TEXT DEFAULT 'approved', p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS public.user_product_access LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.user_product_access%ROWTYPE;
BEGIN
  IF NOT public.is_product_admin(p_product_key) THEN
    RAISE EXCEPTION '관리자만 권한을 변경할 수 있습니다.';
  END IF;
  INSERT INTO public.user_product_access (user_id, product_key, role, status, expires_at, granted_by, updated_at)
  VALUES (p_user_id, p_product_key, COALESCE(p_role,'user'), COALESCE(p_status,'approved'), p_expires_at, auth.uid(), now())
  ON CONFLICT (user_id, product_key) DO UPDATE
    SET role = EXCLUDED.role, status = EXCLUDED.status,
        expires_at = EXCLUDED.expires_at, granted_by = auth.uid(), updated_at = now()
  RETURNING * INTO v;
  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_invite_code(TEXT,TEXT,TEXT,INTEGER,TIMESTAMPTZ,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_access(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. 최고 관리자 지정 — ksh90813@naver.com (이미 가입된 경우에만)
--    이 계정만 관리자입니다. auth.users 는 직접 insert 하지 않고
--    profiles/access 에만 연결한다.
-- ────────────────────────────────────────────────────────────

UPDATE public.profiles p
   SET is_admin = true
  FROM auth.users au
 WHERE au.id = p.user_id AND lower(au.email) = 'ksh90813@naver.com';

-- employment 관리자 권한 (admin/approved)
INSERT INTO public.user_product_access (user_id, product_key, role, status)
SELECT au.id, 'employment', 'admin', 'approved'
FROM auth.users au
WHERE lower(au.email) = 'ksh90813@naver.com'
ON CONFLICT (user_id, product_key) DO UPDATE SET role = 'admin', status = 'approved', updated_at = now();

-- (선택) 향후 다른 SaaS 권한도 동일 계정에 부여 가능 — 해당 앱 도입 시 주석 해제.
-- INSERT INTO public.user_product_access (user_id, product_key, role, status)
-- SELECT au.id, 'labcare', 'admin', 'approved' FROM auth.users au
-- WHERE lower(au.email) = 'ksh90813@naver.com'
-- ON CONFLICT (user_id, product_key) DO UPDATE SET role='admin', status='approved', updated_at=now();
-- INSERT INTO public.user_product_access (user_id, product_key, role, status)
-- SELECT au.id, 'consulting', 'admin', 'approved' FROM auth.users au
-- WHERE lower(au.email) = 'ksh90813@naver.com'
-- ON CONFLICT (user_id, product_key) DO UPDATE SET role='admin', status='approved', updated_at=now();


-- ────────────────────────────────────────────────────────────
-- 7. 기존 가입자 처리 — 자동 승인하지 않는다.
--    최고 관리자(6절)를 제외한 기존 사용자는 'pending' 으로 기록만 하고
--    실제 이용은 관리자가 승인(approved)하기 전까지 차단된다.
--    (AccessGate 는 approved 가 아니면 진입을 막는다)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.user_product_access (user_id, product_key, role, status)
SELECT au.id, 'employment', 'user', 'pending'
FROM auth.users au
ON CONFLICT (user_id, product_key) DO NOTHING;  -- 관리자(6절 approved)는 유지

-- profiles.email 보강 (비어있는 경우만)
UPDATE public.profiles p
   SET email = au.email
  FROM auth.users au
 WHERE au.id = p.user_id AND (p.email IS NULL OR p.email = '');


-- ────────────────────────────────────────────────────────────
-- 8. 검증 (적용 후 실행)
-- ────────────────────────────────────────────────────────────
-- SELECT email, is_admin FROM profiles p JOIN auth.users au ON au.id=p.user_id WHERE is_admin;
-- SELECT count(*) FROM user_product_access WHERE product_key='employment' AND status='approved';
-- SELECT au.email FROM auth.users au
--   LEFT JOIN user_product_access a ON a.user_id=au.id AND a.product_key='employment'
--   WHERE a.id IS NULL;  -- 0 row 면 모든 기존 사용자에게 권한 부여 완료
