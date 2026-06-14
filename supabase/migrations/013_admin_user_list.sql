-- ============================================================
-- 013_admin_user_list.sql
-- 목적: 관리자 화면(/admin/access)에서 가입자 목록을 조회하기 위한 RPC.
--       profiles RLS 는 본인/같은 팀만 허용하므로, 관리자가 전체 사용자를
--       보려면 admin-gated SECURITY DEFINER 함수가 필요하다.
--
-- 안전성: 함수 CREATE OR REPLACE 만 포함. 테이블/데이터 변경 없음.
--         is_product_admin 가드로 employment 관리자만 실행 가능.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_users(p_product TEXT DEFAULT 'employment')
RETURNS TABLE (
  user_id          UUID,
  email            TEXT,
  display_name     TEXT,
  role             TEXT,
  status           TEXT,
  expires_at       TIMESTAMPTZ,
  access_created_at TIMESTAMPTZ,
  user_created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  IF NOT public.is_product_admin(p_product) THEN
    RAISE EXCEPTION '관리자만 사용자 목록을 조회할 수 있습니다.';
  END IF;
  RETURN QUERY
    SELECT au.id,
           au.email::TEXT,
           COALESCE(p.display_name, split_part(au.email,'@',1))::TEXT,
           a.role,
           a.status,
           a.expires_at,
           a.created_at,
           au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p             ON p.user_id = au.id
    LEFT JOIN public.user_product_access a  ON a.user_id = au.id AND a.product_key = p_product
    ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT) TO authenticated;
