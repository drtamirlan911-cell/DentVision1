import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
let schema = readFileSync(schemaPath, 'utf8');

const organizationRelationMarker = '  invitations OrganizationInvitation[]\n';
if (!schema.includes('  branches Branch[]') && !schema.includes('  branches            Branch[]')) {
  if (!schema.includes(organizationRelationMarker)) throw new Error('Organization relation marker not found in schema.prisma');
  schema = schema.replace(organizationRelationMarker, `${organizationRelationMarker}  branches     Branch[]\n`);
}
const clinicRelationMarker = '  members             ClinicMember[]\n';
if (!schema.includes('  branches            Branch[]')) {
  if (!schema.includes(clinicRelationMarker)) throw new Error('Clinic relation marker not found in schema.prisma');
  schema = schema.replace(clinicRelationMarker, `${clinicRelationMarker}  branches            Branch[]\n`);
}
const memberRoleMarker = '  role              UserRole @default(DOCTOR)\n';
if (schema.includes(memberRoleMarker) && !schema.includes('  branchId           String?')) schema = schema.replace(memberRoleMarker, `${memberRoleMarker}  branchId           String?   @map("branch_id")\n`);
else if (schema.includes('  branchId           String?\n')) schema = schema.replace('  branchId           String?\n', '  branchId           String?   @map("branch_id")\n');
const memberRelationMarker = '  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)\n';
if (schema.includes(memberRelationMarker) && !schema.includes('  branch Branch? @relation(fields: [branchId,')) schema = schema.replace(memberRelationMarker, `${memberRelationMarker}  branch Branch? @relation(fields: [branchId], references: [id], onDelete: SetNull)\n`);

function ensureScalarField(modelName: string, marker: string, field: string) {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start < 0) return;
  const end = schema.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`${modelName} model boundary not found`);
  const block = schema.slice(start, end);
  if (block.includes('  branchId')) {
    schema = schema.replace(/  branchId\s+String\?(?:\s+@map\("branch_id"\))?/g, '  branchId        String?   @map("branch_id")');
    return;
  }
  const markerIndex = schema.indexOf(marker, start);
  if (markerIndex >= start && markerIndex < end) {
    schema = schema.slice(0, markerIndex + marker.length) + field + schema.slice(markerIndex + marker.length);
    return;
  }
  const clinicField = /(^|\n)\s*clinicId\s+String(?:\s+[^\n]*)?\n/.exec(block);
  if (clinicField && clinicField.index !== undefined) {
    const absoluteClinicEnd = start + clinicField.index + clinicField[0].length;
    schema = schema.slice(0, absoluteClinicEnd) + field + schema.slice(absoluteClinicEnd);
    return;
  }
  throw new Error(`${modelName} clinicId marker not found`);
}

ensureScalarField('Patient', '  clinicId       String\n', '  branchId       String?   @map("branch_id")\n');
ensureScalarField('Appointment', '  clinicId        String\n', '  branchId        String?   @map("branch_id")\n');
ensureScalarField('InventoryItem', '  clinicId        String\n', '  branchId        String?   @map("branch_id")\n');
ensureScalarField('Invoice', '  clinicId        String\n', '  branchId        String?   @map("branch_id")\n');
ensureScalarField('Expense', '  clinicId    String\n', '  branchId    String?   @map("branch_id")\n');
ensureScalarField('Referral', '  clinicId         String\n', '  branchId         String?            @map("branch_id")\n');

// Appointment creation is intentionally idempotent for the same patient/slot.
// The route performs the normal conflict check, but that check alone is racy:
// two concurrent POSTs can both observe an empty slot and then INSERT. Prisma's
// unique constraint gives PostgreSQL the final atomic guarantee.
const appointmentStart = schema.indexOf('model Appointment {');
if (appointmentStart >= 0) {
  const appointmentEnd = schema.indexOf('\n}\n', appointmentStart);
  if (appointmentEnd < 0) throw new Error('Appointment model boundary not found');
  const appointmentBlock = schema.slice(appointmentStart, appointmentEnd);
  if (!appointmentBlock.includes('@@unique([clinicId, patientId, date, time])')) {
    const mapIndex = schema.indexOf('  @@map("appointments")', appointmentStart);
    if (mapIndex < appointmentStart || mapIndex > appointmentEnd) throw new Error('Appointment map marker not found');
    schema = schema.slice(0, mapIndex) + '  @@unique([clinicId, patientId, date, time])\n' + schema.slice(mapIndex);
  }
}

if (!schema.includes('model Branch {')) {
  const insertBeforeBooking = 'model Booking {\n';
  if (!schema.includes(insertBeforeBooking)) throw new Error('Booking marker not found in schema.prisma');
  const branchModel = `model Branch {\n  id             String       @id @default(uuid())\n  organizationId  String?      @map("organization_id")\n  clinicId       String?      @map("clinic_id")\n  code           String\n  name           String\n  city           String?\n  address        String?\n  phone          String?\n  active         Boolean      @default(true)\n  isDefault      Boolean      @default(false)\n  settings       Json?\n  createdAt      DateTime     @default(now())\n  updatedAt      DateTime     @updatedAt\n\n  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n  clinic       Clinic?       @relation(fields: [clinicId], references: [id], onDelete: SetNull)\n  members      ClinicMember[]\n\n  @@unique([organizationId, code])\n  @@index([organizationId])\n  @@index([organizationId, active])\n  @@index([clinicId])\n  @@map("branches")\n}\n\n`;
  schema = schema.replace(insertBeforeBooking, branchModel + insertBeforeBooking);
} else {
  if (!schema.includes('organizationId  String?      @map("organization_id")')) schema = schema.replace('model Branch {\n  id         String   @id @default(uuid())\n', 'model Branch {\n  id             String       @id @default(uuid())\n  organizationId  String?      @map("organization_id")\n');
  schema = schema.replace('model Branch {\n  id             String       @id @default(uuid())\n  organizationId  String?      @map("organization_id")\n  clinicId       String\n', 'model Branch {\n  id             String       @id @default(uuid())\n  organizationId  String?      @map("organization_id")\n  clinicId       String?      @map("clinic_id")\n');
  schema = schema.replace('  clinicId   String\n', '  clinicId       String?      @map("clinic_id")\n');
  if (!schema.includes('organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)')) {
    const clinicRelation = '  clinic  Clinic         @relation(fields: [clinicId], references: [id], onDelete: Cascade)\n';
    if (schema.includes(clinicRelation)) schema = schema.replace(clinicRelation, '  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n' + '  clinic       Clinic?       @relation(fields: [clinicId], references: [id], onDelete: SetNull)\n');
  }
  schema = schema.replace('  @@unique([clinicId, code])\n', '  @@unique([organizationId, code])\n');
  if (!schema.includes('  @@index([organizationId])\n')) schema = schema.replace('  @@index([clinicId])\n', '  @@index([organizationId])\n  @@index([clinicId])\n');
  if (!schema.includes('  @@index([organizationId, active])\n')) schema = schema.replace('  @@index([organizationId])\n', '  @@index([organizationId])\n  @@index([organizationId, active])\n');
}

writeFileSync(schemaPath, schema);
console.log('[prisma] organization-scoped branch model and patient/appointment/inventory/finance/diagnostics branch scope ensured');