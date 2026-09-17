import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

function insertOnce(anchor: string, addition: string) {
  if (schema.includes(addition.trim())) return;
  const index = schema.indexOf(anchor);
  if (index < 0) throw new Error(`TreatmentCase schema anchor not found: ${anchor}`);
  schema = `${schema.slice(0, index + anchor.length)}${addition}${schema.slice(index + anchor.length)}`;
}

// Scalar FK fields.
insertOnce('  treatmentPlanId String?\n', '  treatmentCaseId String?\n');
insertOnce('  doctorId   String\n', '  treatmentCaseId String?\n');
insertOnce('  clinicId  String?\n  title', '  treatmentCaseId String?\n');
insertOnce('  labId            String?\n', '  treatmentCaseId String?\n');
insertOnce('  treatmentPlanId String?\n', '  treatmentCaseId String?\n');

// Relations in each case-bearing model. Relation names are explicit so Prisma
// has no ambiguity if a model later gains another case-related relation.
const relationBlocks: Array<[string, string]> = [
  ['  treatmentPlan TreatmentPlan? @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)\n', '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n'],
  ['  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)\n', '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n'],
  ['  clinic       Clinic?                @relation(fields: [clinicId], references: [id], onDelete: SetNull)\n', '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n'],
  ['  settlement  Settlement?       @relation("SettlementReferrals", fields: [settlementId], references: [id], onDelete: SetNull)\n', '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n'],
  ['  doctor  User?    @relation("LabOrderDoctor", fields: [doctorId], references: [id], onDelete: SetNull)\n', '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n'],
  ['  treatmentPlan TreatmentPlan? @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)\n', '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n'],
];
for (const [anchor, addition] of relationBlocks) {
  if (schema.includes(anchor) && !schema.includes(addition.trim())) insertOnce(anchor, addition);
}

// Reverse collections.
insertOnce('  treatmentCases      TreatmentCase[]\n', '');
insertOnce('  treatmentCases               TreatmentCase[]\n', '');
insertOnce('  invoices     Invoice[]\n', '  treatmentCases TreatmentCase[]\n');
insertOnce('  invoices     Invoice[]\n', '');
insertOnce('  treatmentPlans               TreatmentPlan[]\n', '');

// The canonical TreatmentCase model is already present. Add reverse links
// immediately after its existing patient relation block.
const casePatientAnchor = '  patient   Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)\n';
if (schema.includes(casePatientAnchor) && !schema.includes('  appointments Appointment[]\n')) {
  insertOnce(casePatientAnchor, [
    '  appointments   Appointment[]\n',
    '  visits         Visit[]\n',
    '  treatmentPlans TreatmentPlan[]\n',
    '  referrals      Referral[]\n',
    '  labOrders      LabOrder[]\n',
    '  invoices       Invoice[]\n',
  ].join(''));
}

fs.writeFileSync(schemaPath, schema);
console.log('[prisma] TreatmentCase relations synchronized:', schemaPath);
