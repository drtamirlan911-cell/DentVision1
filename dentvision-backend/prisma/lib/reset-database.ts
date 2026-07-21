import type { PrismaClient } from '@prisma/client';

/** Wipe all app data. Keeps icd10_codes reference table. */
export async function wipeApplicationData(prisma: PrismaClient) {
  const tables = [
    'audit_logs',
    'notifications',
    'ai_messages',
    'ai_memories',
    'ai_alerts',
    'ai_actions',
    'ai_sessions',
    'school_enrollments',
    'lessons',
    'courses',
    'expert_verifications',
    'lecturers',
    'academies',
    'favorites',
    'orders',
    'products',
    'supplier_documents',
    'supplier_members',
    'suppliers',
    'inventory',
    'invoices',
    'lab_orders',
    'documents',
    'patient_images',
    'treatment_plans',
    'teeth',
    'visits',
    'appointments',
    'waiting_list',
    'expenses',
    'promotions',
    'price_list',
    'chairs',
    'reminder_logs',
    'patients',
    'clinic_invitations',
    'clinic_members',
    'clinics',
    'users',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    } catch {
      // Table may not exist on older DBs — continue wipe
    }
  }
}
