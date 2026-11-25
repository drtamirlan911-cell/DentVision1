import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRANCH_FILTERED_CLINIC_AI_TOOLS } from './aiToolBranchScope.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'tools.ts'), 'utf8');

function toolBlock(name: string): string {
  const marker = `  ${name}: {`;
  const start = SOURCE.indexOf(marker);
  if (start < 0) throw new Error(`Missing tool definition: ${name}`);
  const end = SOURCE.indexOf('\n  },', start);
  if (end < 0) throw new Error(`Cannot locate end of tool definition: ${name}`);
  return SOURCE.slice(start, end);
}

describe('AI clinic tools — branch filtering allow-list', () => {
  const requiredPredicates: Array<[string, string]> = [
    ['searchPatients', 'patientBranchWhere(ctx)'],
    ['getPatientCard', 'patientBranchWhere(ctx)'],
    ['getVisits', 'patientBranchWhere(ctx)'],
    ['getSchedule', 'appointmentBranchWhere(ctx)'],
    ['createAppointment', 'patientBranchWhere(ctx)'],
    ['updateAppointmentStatus', 'appointmentBranchWhere(ctx)'],
    ['cancelAppointment', 'appointmentBranchWhere(ctx)'],
    ['rescheduleAppointment', 'appointmentBranchWhere(ctx)'],
    ['getTreatmentPlans', 'patientBranchWhere(ctx)'],
    ['createTreatmentPlan', 'patientBranchWhere(ctx)'],
    ['getRevenue', 'invoiceBranchWhere(ctx)'],
    ['getDebtors', 'invoiceBranchWhere(ctx)'],
    ['createInvoice', 'patientBranchWhere(ctx)'],
    ['getInventory', 'inventoryBranchWhere(ctx)'],
    ['getLabOrders', 'labOrderBranchWhere(ctx)'],
    ['updateLabOrderStatus', 'labOrderBranchWhere(ctx)'],
  ];

  it('keeps every allow-listed query/write paired with its explicit branch predicate', () => {
    for (const [tool, predicate] of requiredPredicates) {
      expect(BRANCH_FILTERED_CLINIC_AI_TOOLS.has(tool), tool).toBe(true);
      expect(toolBlock(tool), tool).toContain(predicate);
    }
  });

  it('persists branchId from the verified scope for appointment and invoice creation', () => {
    expect(toolBlock('createAppointment')).toContain('branchId: ctx.branchScope?.branchId || patient.branchId || null');
    expect(toolBlock('createInvoice')).toContain('branchId: ctx.branchScope?.branchId || patient.branchId || null');
  });


  it('filters createAppointment conflict candidates to the caller branch', () => {
    const block = toolBlock('createAppointment');
    const candidateLookup = block.slice(block.indexOf('const candidates = await prisma.appointment.findMany'));
    expect(candidateLookup).toContain('...appointmentBranchWhere(ctx)');
  });

  it('filters rescheduleAppointment conflict candidates to the caller branch', () => {
    const block = toolBlock('rescheduleAppointment');
    const candidateLookup = block.slice(block.indexOf('const candidates = await prisma.appointment.findMany'));
    expect(candidateLookup).toContain('...appointmentBranchWhere(ctx)');
  });

  it('validates both creation and rescheduling doctors against the resolved appointment branch', () => {
    expect(toolBlock('createAppointment')).toContain('resolveAppointmentDoctor(doctorId, clinicId, appointmentBranchId)');
    expect(toolBlock('rescheduleAppointment')).toContain('resolveAppointmentDoctor(doctorId, clinicId, appointmentBranchId)');
  });

  it('does not allow unfiltered clinic-wide tools for narrow branch contexts', () => {
    for (const tool of [
      'getPromotions',
      'getDashboardStats',
      'getClinicLoadPlan',
      'getRecallList',
      'createDiagnosticReferral',
      'createLabOrder',
      'searchClinicalNotes',
      'analyzeRadiograph',
      'applyToothFindings',
      'getDoctorUtilization',
    ]) {
      expect(BRANCH_FILTERED_CLINIC_AI_TOOLS.has(tool), tool).toBe(false);
    }
  });
});
