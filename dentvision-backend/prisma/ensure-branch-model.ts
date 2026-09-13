import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

// The repository currently keeps a single large Prisma schema. This small
// idempotent bootstrap keeps the branch model in the generated Prisma schema
// during the IAM v2 transition without duplicating the whole schema file.
if (schema.includes('model Branch {')) process.exit(0);

let next = schema;

const clinicMarker = '  members             ClinicMember[]\n';
if (!next.includes(clinicMarker)) throw new Error('Clinic relation marker not found in schema.prisma');
next = next.replace(clinicMarker, `${clinicMarker}  branches            Branch[]\n`);

const memberRoleMarker = '  role              UserRole @default(DOCTOR)\n';
if (!next.includes(memberRoleMarker)) throw new Error('ClinicMember role marker not found in schema.prisma');
next = next.replace(memberRoleMarker, `${memberRoleMarker}  branchId           String?\n`);

const memberRelationMarker = '  clinic Clinic @relation(fields: [clinicId], references: [id], onDelete: Cascade)\n';
if (!next.includes(memberRelationMarker)) throw new Error('ClinicMember relation marker not found in schema.prisma');
next = next.replace(
  memberRelationMarker,
  `${memberRelationMarker}  branch Branch? @relation(fields: [branchId], references: [id], onDelete: SetNull)\n`,
);

const insertBeforeBooking = 'model Booking {\n';
if (!next.includes(insertBeforeBooking)) throw new Error('Booking marker not found in schema.prisma');

const branchModel = `model Branch {\n  id         String   @id @default(uuid())\n  clinicId   String\n  code       String\n  name       String\n  city       String?\n  address    String?\n  phone      String?\n  active     Boolean  @default(true)\n  isDefault  Boolean  @default(false)\n  settings   Json?\n  createdAt  DateTime @default(now())\n  updatedAt  DateTime @updatedAt\n\n  clinic  Clinic         @relation(fields: [clinicId], references: [id], onDelete: Cascade)\n  members ClinicMember[]\n\n  @@unique([clinicId, code])\n  @@index([clinicId])\n  @@index([clinicId, active])\n  @@map("branches")\n}\n\n`;

next = next.replace(insertBeforeBooking, branchModel + insertBeforeBooking);
writeFileSync(schemaPath, next);
console.log('[prisma] branch model ensured');
