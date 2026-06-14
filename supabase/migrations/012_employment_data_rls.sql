-- ============================================================
-- 012_employment_data_rls.sql  (선택 · 011 적용·검증 후에 적용)
-- 목적: 앱 데이터(companies/employees/calendar_memos)를 employment 접근권한이
--       있는 사용자만 읽고 쓸 수 있도록 RLS 를 한 단계 강화한다.
--       (UI 숨김이 아니라 DB 레벨 강제)
--
-- ⚠️ 반드시 011 의 7절 backfill 이 끝나 모든 기존 사용자가 employment 'approved'
--    권한을 가진 것을 확인한 뒤 적용하세요. 그렇지 않으면 기존 사용자가
--    자기 데이터에 접근하지 못할 수 있습니다.
--    검증 쿼리(0 row 여야 함):
--      SELECT au.email FROM auth.users au
--        LEFT JOIN user_product_access a
--          ON a.user_id=au.id AND a.product_key='employment' AND a.status='approved'
--        WHERE a.id IS NULL;
--
-- 안전성: 기존 정책을 DROP 후 동일 조건 + has_product_access('employment') 로
--         재생성한다. 테이블/데이터는 변경하지 않는다.
-- ============================================================

-- companies
DROP POLICY IF EXISTS "comp_select" ON public.companies;
DROP POLICY IF EXISTS "comp_insert" ON public.companies;
DROP POLICY IF EXISTS "comp_update" ON public.companies;
DROP POLICY IF EXISTS "comp_delete" ON public.companies;
CREATE POLICY "comp_select" ON public.companies FOR SELECT
  USING (is_org_member(org_id) AND public.has_product_access('employment'));
CREATE POLICY "comp_insert" ON public.companies FOR INSERT
  WITH CHECK (is_org_member(org_id) AND public.has_product_access('employment'));
CREATE POLICY "comp_update" ON public.companies FOR UPDATE
  USING (is_org_member(org_id) AND public.has_product_access('employment'));
CREATE POLICY "comp_delete" ON public.companies FOR DELETE
  USING (is_org_admin(org_id) AND public.has_product_access('employment'));

-- employees
DROP POLICY IF EXISTS "emp_select" ON public.employees;
DROP POLICY IF EXISTS "emp_insert" ON public.employees;
DROP POLICY IF EXISTS "emp_update" ON public.employees;
DROP POLICY IF EXISTS "emp_delete" ON public.employees;
CREATE POLICY "emp_select" ON public.employees FOR SELECT
  USING (is_org_member(org_id) AND public.has_product_access('employment'));
CREATE POLICY "emp_insert" ON public.employees FOR INSERT
  WITH CHECK (is_org_member(org_id) AND public.has_product_access('employment'));
CREATE POLICY "emp_update" ON public.employees FOR UPDATE
  USING (is_org_member(org_id) AND public.has_product_access('employment'));
CREATE POLICY "emp_delete" ON public.employees FOR DELETE
  USING (is_org_member(org_id) AND public.has_product_access('employment'));

-- calendar_memos
DROP POLICY IF EXISTS "cal_all" ON public.calendar_memos;
CREATE POLICY "cal_all" ON public.calendar_memos FOR ALL
  USING (is_org_member(org_id) AND public.has_product_access('employment'));
