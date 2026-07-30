# Deprecation Plan: Old Tables → Unified Schema

## Order of migration

### Phase A — No code changes (data sync only)
1. Run `prisma migrate dev` (creates organizations, persons, permissions, roles)
2. Run `tsx prisma/seed-permissions.ts` (fills permissions + roles)
3. Run `tsx prisma/migrate-unified-schema.ts` (copies data: Clinic → Organization, ClinicMember → Person, etc.)
4. Run `supabase-policies.sql` in Supabase SQL editor

### Phase B — Read from new, write to both (backward compat)
1. All `clinic.create` → also upserts Organization ✅ already done
2. All `clinicMember.create` → also upserts Person (TODO)
3. Auth reads Person first, falls back to ClinicMember ✅ already done
4. Switch-context tries Organization first, falls back to legacy ✅ already done

### Phase C — Migrate each module to read from new tables

| Module | Old table | New table | Action |
|--------|-----------|-----------|--------|
| appointments | `clinicId` → `Clinic` | `organizationId` → `Organization` | Add org FK, keep clinicId as alias |
| billing/invoices | `Clinic` | `Organization` | Add `orgId` column, migrate |
| patients | `Clinic` | `Organization` | Add `orgId`, link patients to org |
| analytics | `req.user.clinicId` | `req.user.organizationId` | Use orgContext helper |
| CRM staff | `ClinicMember` | `Person` + `PersonRole` | Write adapter |
| supplier members | `SupplierMember` | `Person` | Migrate during sync |
| diagnostic center members | `DiagnosticCenterMember` | `Person` | Migrate during sync |
| lecturers | `Lecturer` | `Person` | Migrate during sync |

### Phase D — Drop old tables (after full migration)
```sql
-- Run ONLY after ALL modules read from new tables
DROP TABLE IF EXISTS clinic_members CASCADE;
DROP TABLE IF EXISTS clinic_invitations CASCADE;
DROP TABLE IF EXISTS supplier_members CASCADE;
DROP TABLE IF EXISTS diagnostic_center_members CASCADE;
DROP TABLE IF EXISTS laboratory_members CASCADE;
DROP TABLE IF EXISTS lecturers CASCADE;
-- Keep clinics, suppliers, academies, etc. as materialized views if needed
```

## Adding a new org type (e.g. INSURANCE_COMPANY)
1. Add `'INSURANCE_COMPANY'` to the Organization model's type field (no schema change)
2. Create persons with `personType = 'INSURANCE_AGENT'` linked to the org
3. Assign roles via `PersonRole` → `Role`
4. Frontend shows it in the OrganizationsPage filter automatically
