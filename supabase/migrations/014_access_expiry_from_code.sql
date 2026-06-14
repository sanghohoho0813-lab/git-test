-- ============================================================
-- 014_access_expiry_from_code.sql
-- 목적: 초대코드에 만료일(expires_at)이 설정된 경우, 그 코드로 부여/활성화되는
--       user_product_access 의 expires_at 에도 동일 만료일을 적용한다.
--       (= 코드 만료일이 곧 그 사용자의 이용 가능 기간이 된다)
--
-- 안전성: 함수 CREATE OR REPLACE 만 포함. 테이블/RLS/데이터 변경 없음.
--         기존 011 의 handle_new_user / redeem_invite_code 를 확장 갱신.
-- ============================================================

-- (1) 신규 가입 트리거 — 접근권한 부여 시 expires_at 반영
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
  -- (A) 초대코드 검증
  v_code_text := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'invite_code','')), '');
  IF v_code_text IS NULL THEN
    RAISE EXCEPTION '초대코드가 필요합니다. 관리자에게 초대코드를 요청해 주세요.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_code FROM public.invite_codes WHERE code = v_code_text;
  IF NOT FOUND THEN RAISE EXCEPTION '존재하지 않는 초대코드입니다.' USING ERRCODE = 'check_violation'; END IF;
  IF NOT v_code.is_active THEN RAISE EXCEPTION '사용할 수 없는(비활성) 초대코드입니다.' USING ERRCODE = 'check_violation'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION '만료된 초대코드입니다.' USING ERRCODE = 'check_violation'; END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
    RAISE EXCEPTION '사용 횟수가 모두 소진된 초대코드입니다.' USING ERRCODE = 'check_violation'; END IF;

  -- (B) 이름/팀명
  v_display_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), split_part(NEW.email,'@',1));
  v_team_name    := COALESCE(NULLIF(NEW.raw_user_meta_data->>'team_name',''), v_display_name || ' 워크스페이스');

  -- (C) profile
  INSERT INTO public.profiles (user_id, display_name, title, email)
  VALUES (NEW.id, v_display_name, '담당자', NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET email = COALESCE(public.profiles.email, EXCLUDED.email);

  -- (D) 워크스페이스
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

  -- (E) 제품 접근권한 부여 — 코드의 expires_at 을 이용권 만료일로 반영
  INSERT INTO public.user_product_access (user_id, product_key, role, status, expires_at, granted_by)
  VALUES (NEW.id, v_code.product_key, COALESCE(v_code.role,'user'), 'approved', v_code.expires_at, v_code.created_by)
  ON CONFLICT (user_id, product_key) DO NOTHING;

  -- (F) 사용 수 증가 + 기록
  UPDATE public.invite_codes SET used_count = used_count + 1 WHERE id = v_code.id;
  INSERT INTO public.invite_code_redemptions (invite_code_id, user_id, product_key)
  VALUES (v_code.id, NEW.id, v_code.product_key);

  RETURN NEW;
END;
$$;

-- (2) 기존 사용자 자가 활성화 RPC — expires_at 반영
CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_code public.invite_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;

  SELECT * INTO v_code FROM public.invite_codes WHERE code = trim(p_code);
  IF NOT FOUND        THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT v_code.is_active THEN RETURN jsonb_build_object('ok', false, 'reason', 'inactive'); END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;
  IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exhausted'); END IF;

  INSERT INTO public.user_product_access (user_id, product_key, role, status, expires_at, granted_by)
  VALUES (v_uid, v_code.product_key, COALESCE(v_code.role,'user'), 'approved', v_code.expires_at, v_code.created_by)
  ON CONFLICT (user_id, product_key) DO UPDATE
    SET status = 'approved',
        role = CASE WHEN public.user_product_access.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

  UPDATE public.invite_codes SET used_count = used_count + 1 WHERE id = v_code.id;
  INSERT INTO public.invite_code_redemptions (invite_code_id, user_id, product_key)
  VALUES (v_code.id, v_uid, v_code.product_key);

  RETURN jsonb_build_object('ok', true, 'product_key', v_code.product_key, 'role', COALESCE(v_code.role,'user'));
END;
$$;
