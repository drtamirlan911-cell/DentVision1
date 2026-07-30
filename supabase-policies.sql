-- Supabase RLS policies for new unified tables (run in Supabase SQL editor)

-- ============================================================
-- organizations
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read organizations they belong to
CREATE POLICY "Users can read their own organizations"
  ON organizations FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM persons WHERE organization_id = organizations.id
    )
    OR
    auth.uid() IN (
      SELECT user_id FROM clinic_members WHERE clinic_id = organizations.original_id
      AND organizations.original_type = 'Clinic'
    )
  );

-- SUPERADMIN can read all
CREATE POLICY "Superadmins can read all organizations"
  ON organizations FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

-- Only SUPERADMIN can write organizations
CREATE POLICY "Only superadmins can insert organizations"
  ON organizations FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

CREATE POLICY "Only superadmins can update organizations"
  ON organizations FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

CREATE POLICY "Only superadmins can delete organizations"
  ON organizations FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

-- ============================================================
-- persons
-- ============================================================
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

-- Users can read their own person record
CREATE POLICY "Users can read own person record"
  ON persons FOR SELECT
  USING (user_id = auth.uid());

-- Users from same organization can read each other
CREATE POLICY "Org members can read persons in same org"
  ON persons FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM persons WHERE user_id = auth.uid()
    )
  );

-- SUPERADMIN can read all
CREATE POLICY "Superadmins can read all persons"
  ON persons FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

-- Users can update their own person record
CREATE POLICY "Users can update own person record"
  ON persons FOR UPDATE
  USING (user_id = auth.uid());

-- SUPERADMIN can manage all persons
CREATE POLICY "Superadmins can manage all persons"
  ON persons FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

CREATE POLICY "Superadmins can update all persons"
  ON persons FOR UPDATE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

CREATE POLICY "Superadmins can delete all persons"
  ON persons FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

-- ============================================================
-- permissions & roles (read-only for most, manage by superadmin)
-- ============================================================
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read permissions and roles
CREATE POLICY "Authenticated users can read permissions"
  ON permissions FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read roles"
  ON roles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read role_permissions"
  ON role_permissions FOR SELECT USING (auth.role() = 'authenticated');

-- Users can read their own person_roles
CREATE POLICY "Users can read own person_roles"
  ON person_roles FOR SELECT
  USING (
    person_id IN (SELECT id FROM persons WHERE user_id = auth.uid())
  );

-- SUPERADMIN can manage all
CREATE POLICY "Superadmins can manage permissions"
  ON permissions FOR ALL USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

CREATE POLICY "Superadmins can manage roles"
  ON roles FOR ALL USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

CREATE POLICY "Superadmins can manage role_permissions"
  ON role_permissions FOR ALL USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );

CREATE POLICY "Superadmins can manage person_roles"
  ON person_roles FOR ALL USING (
    auth.uid() IN (SELECT id FROM users WHERE role = 'SUPERADMIN')
  );
