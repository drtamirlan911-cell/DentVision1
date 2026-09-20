import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

function patchModel(
  modelName: string,
  fieldAnchor: string,
  field: string,
  relationAnchor: string,
  relation: string,
) {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start < 0) throw new Error(`TreatmentCase model anchor not found: ${modelName}`);
  const end = schema.indexOf('\n}\n', start);
  if (end < 0) throw new Error(`TreatmentCase model end not found: ${modelName}`);

  let block = schema.slice(start, end + 3);
  const fieldName = field.trim().split(/\s+/)[0];
  const relationName = relation.trim().split(/\s+/)[0];
  if (!new RegExp(`^\\s*${fieldName}\\b`, 'm').test(block)) {
    const fieldIndex = block.indexOf(fieldAnchor);
    if (fieldIndex < 0) throw new Error(`TreatmentCase field anchor not found: ${modelName}: ${fieldAnchor}`);
    block = `${block.slice(0, fieldIndex + fieldAnchor.length)}${field}${block.slice(fieldIndex + fieldAnchor.length)}`;
  }
  if (!new RegExp(`^\\s*${relationName}\\b`, 'm').test(block)) {
    const relationIndex = block.indexOf(relationAnchor);
    if (relationIndex < 0) throw new Error(`TreatmentCase relation anchor not found: ${modelName}: ${relationAnchor}`);
    block = `${block.slice(0, relationIndex + relationAnchor.length)}${relation}${block.slice(relationIndex + relationAnchor.length)}`;
  }
  schema = `${schema.slice(0, start)}${block}${schema.slice(end + 3)}`;
}

patchModel(
  'Appointment',
  '  treatmentPlanId String?\n',
  '  treatmentCaseId String?\n',
  '  treatmentPlan TreatmentPlan? @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)\n',
  '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n',
);
patchModel(
  'Visit',
  '  doctorId   String\n',
  '  treatmentCaseId String?\n',
  '  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)\n',
  '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n',
);
patchModel(
  'TreatmentPlan',
  '  clinicId  String?\n',
  '  treatmentCaseId String?\n',
  '  clinic       Clinic?                @relation(fields: [clinicId], references: [id], onDelete: SetNull)\n',
  '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n',
);
patchModel(
  'Referral',
  '  labId            String?\n',
  '  treatmentCaseId String?\n',
  '  settlement  Settlement?       @relation("SettlementReferrals", fields: [settlementId], references: [id], onDelete: SetNull)\n',
  '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n',
);
patchModel(
  'LabOrder',
  '  doctorId String?\n',
  '  treatmentCaseId String?\n',
  '  doctor  User?    @relation("LabOrderDoctor", fields: [doctorId], references: [id], onDelete: SetNull)\n',
  '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n',
);
patchModel(
  'Invoice',
  '  treatmentPlanId String?\n',
  '  treatmentCaseId String?\n',
  '  treatmentPlan TreatmentPlan? @relation(fields: [treatmentPlanId], references: [id], onDelete: SetNull)\n',
  '  treatmentCase TreatmentCase? @relation(fields: [treatmentCaseId], references: [id], onDelete: SetNull)\n',
);

// Reverse collections on the canonical case. Clinic and Patient already have
// TreatmentCase[] relations in the current schema.
const caseStart = schema.indexOf('model TreatmentCase {');
if (caseStart < 0) throw new Error('Canonical TreatmentCase model not found');
const caseEnd = schema.indexOf('\n}\n', caseStart);
if (caseEnd < 0) throw new Error('Canonical TreatmentCase model end not found');
let caseBlock = schema.slice(caseStart, caseEnd + 3);
const reverseAnchor = '  patient   Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)\n';
const reverseRelations = [
  '  appointments   Appointment[]\n',
  '  visits         Visit[]\n',
  '  treatmentPlans TreatmentPlan[]\n',
  '  referrals      Referral[]\n',
  '  labOrders      LabOrder[]\n',
  '  invoices       Invoice[]\n',
].join('');
if (!caseBlock.includes('  appointments   Appointment[]')) {
  const index = caseBlock.indexOf(reverseAnchor);
  if (index < 0) throw new Error('TreatmentCase patient relation not found');
  caseBlock = `${caseBlock.slice(0, index + reverseAnchor.length)}${reverseRelations}${caseBlock.slice(index + reverseAnchor.length)}`;
  schema = `${schema.slice(0, caseStart)}${caseBlock}${schema.slice(caseEnd + 3)}`;
}

fs.writeFileSync(schemaPath, schema);
console.log(`[prisma] synchronized TreatmentCase relations in ${schemaPath}`);
