import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

// Transitional bootstrap for the single-file Prisma schema. Branches are an
// IAM/business boundary owned by Organization. Clinic linkage is retained as
// an optional compatibility field until operational data is migrated fully.
const organizationRelationMarker = '  invitations OrganizationInvitation[]\n';
if (!schema.includes('  branches Branch[]') && !schema.includes('  branches            Branch[]')) {
  if (!schema.includes(organizationRelationMarker)) {
    throw new Error('Organization relation marker not found in schema.prisma');
  }
  schema = schema.replace(
    organizationRelationMarker,
    `${organizationRelationMarker}  branches     Branch[]\n`,
  );
}

const clinicRelationMarker = '  members             ClinicMember[]\n';
if (!schema.includes('  branches            Branch[]')) {
  if (!schema.includes(clinicRelationMarker)) {
    throw new Error('Clinic relation marker not found in schema.prisma');
  }
  schema = schema.replace(clinicRelationMarker, `${clinicRelationMarker}  branches            Branch[]\n`);
}

const memberRoleMarker = '  role              UserRole @default(DOCTOR)\n';
if (schema.includes(memberRoleMarker) && !schema.includes('  branchId           String?\n')) {
  schema = schema.replace(memberRoleMarker, `${memberRoleMarker}  branchId           String?\n`);
}

const memberRelationMarker = '  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)\n';
if (schema.includes(memberRelationMarker) && !schema.includes('  branch Branch? @relation(fields: [branchId,')) {
  schema = schema.replace(
    memberRelationMarker,
    `${memberRelationMarker}  branch Branch? @relation(fields: [branchId], references: [id], onDelete: SetNull)\n`,
  );
}

// Patient branch scope is intentionally introduced as a scalar first. The
// operational migration keeps the existing clinicId contract intact and
// allows branch-aware SQL filtering before a full relational rollout.
const patientClinicMarker = '  clinicId       String\n';
if (schema.includes('model Patient {') && schema.includes(patientClinicMarker)) {
  const patientStart = schema.indexOf('model Patient {');
  const patientEnd = schema.indexOf('\n}\n', patientStart);
  const patientBlock = patientEnd > patientStart ? schema.slice(patientStart, patientEnd) : '';
  if (patientBlock && !patientBlock.includes('  branchId')) {
    const patientClinicIndex = schema.indexOf(patientClinicMarker, patientStart);
    if (patientClinicIndex >= 0 && patientClinicIndex < patientEnd) {
      schema = schema.slice(0, patientClinicIndex + patientClinicMarker.length)
        + '  branchId       String?\n'
        + schema.slice(patientClinicIndex + patientClinicMarker.length);
    }
  }
}

if (!schema.includes('model Branch {')) {
  const insertBeforeBooking = 'model Booking {\n';
  if (!schema.includes(insertBeforeBooking)) throw new Error('Booking marker not found in schema.prisma');

  const branchModel = `model Branch {\n  id             String       @id @default(uuid())\n  organizationId  String?      @map("organization_id")\n  // Transitional clinic linkage; remove after operational data is branch-scoped.\n  clinicId       String?      @map("clinic_id")\n  code           String\n  name           String\n  city           String?\n  address        String?\n  phone          String?\n  active         Boolean      @default(true)\n  isDefault      Boolean      @default(false)\n  settings       Json?\n  createdAt      DateTime     @default(now())\n  updatedAt      DateTime     @updatedAt\n\n  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n  clinic       Clinic?       @relation(fields: [clinicId], references: [id], onDelete: SetNull)\n  members      ClinicMember[]\n\n  @@unique([organizationId, code])\n  @@index([organizationId])\n  @@index([organizationId, active])\n  @@index([clinicId])\n  @@map("branches")\n}\n\n`;
  schema = schema.replace(insertBeforeBooking, branchModel + insertBeforeBooking);
} else {
  // Upgrade the earlier clinic-owned bootstrap to organization-owned Branch.
  if (!schema.includes('organizationId  String?      @map("organization_id")')) {
    schema = schema.replace(
      'model Branch {\n  id         String   @id @default(uuid())\n',
      'model Branch {\n  id             String       @id @default(uuid())\n  organizationId  String?      @map("organization_id")\n',
    );
  }

  // A legacy Branch used a required clinicId. Keep it nullable while the
  // organization migration is phased; existing rows can therefore survive.
  schema = schema.replace(
    'model Branch {\n  id             String       @id @default(uuid())\n  organizationId  String?      @map("organization_id")\n  clinicId       String\n',
    'model Branch {\n  id             String       @id @default(uuid())\n  organizationId  String?      @map("organization_id")\n  clinicId       String?      @map("clinic_id")\n',
  );
  schema = schema.replace('  clinicId   String\n', '  clinicId       String?      @map("clinic_id")\n');

  if (!schema.includes('organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)')) {
    const clinicRelation = '  clinic  Clinic         @relation(fields: [clinicId], references: [id], onDelete: Cascade)\n';
    if (schema.includes(clinicRelation)) {
      schema = schema.replace(
        clinicRelation,
        '  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n' +
          '  clinic       Clinic?       @relation(fields: [clinicId], references: [id], onDelete: SetNull)\n',
      );
    }
  }
  schema = schema.replace('  @@unique([clinicId, code])\n', '  @@unique([organizationId, code])\n');
  if (!schema.includes('  @@index([organizationId])\n')) {
    schema = schema.replace('  @@index([clinicId])\n', '  @@index([organizationId])\n  @@index([clinicId])\n');
  }
  if (!schema.includes('  @@index([organizationId, active])\n')) {
    schema = schema.replace('  @@index([organizationId])\n', '  @@index([organizationId])\n  @@index([organizationId, active])\n');
  }
}

writeFileSync(schemaPath, schema);
console.log('[prisma] organization-scoped branch model and patient branch scope ensured');