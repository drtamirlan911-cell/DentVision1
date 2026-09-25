-- Progressive branch isolation for finance and clinic-originated diagnostics.
-- Existing rows are assigned to the clinic's default active branch; if a clinic
-- has no branch yet they remain NULL until branch bootstrap creates one.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS branch_id TEXT;

UPDATE invoices i
SET branch_id = b.id
FROM branches b
WHERE i.branch_id IS NULL
  AND b.clinic_id = i."clinicId"
  AND b.active = true
  AND b.is_default = true;

UPDATE expenses e
SET branch_id = b.id
FROM branches b
WHERE e.branch_id IS NULL
  AND b.clinic_id = e."clinicId"
  AND b.active = true
  AND b.is_default = true;

UPDATE referrals r
SET branch_id = b.id
FROM branches b
WHERE r.branch_id IS NULL
  AND b.clinic_id = r."clinicId"
  AND b.active = true
  AND b.is_default = true;

CREATE INDEX IF NOT EXISTS invoices_clinic_branch_idx ON invoices ("clinicId", branch_id);
CREATE INDEX IF NOT EXISTS expenses_clinic_branch_idx ON expenses ("clinicId", branch_id);
CREATE INDEX IF NOT EXISTS referrals_clinic_branch_idx ON referrals ("clinicId", branch_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_branch_id_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_branch_id_fkey') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_branch_id_fkey') THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
END $$;
