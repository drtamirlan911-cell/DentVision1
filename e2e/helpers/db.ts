// `e2e/` sits at the repo root next to a dead legacy `prisma/schema.prisma`
// (frontend-era leftover, 130 models, no `AISession`/`AIAction`) whose
// generated client shadows the real one at the bare specifier `@prisma/client`.
// The backend this suite actually tests is `dentvision-backend`, so import its
// generated client directly rather than the one Node resolves by default.
import { PrismaClient } from '../../dentvision-backend/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

export { prisma };

export async function cleanupTestUser(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  await prisma.clinicMember.deleteMany({ where: { userId: user.id } });
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  // Prisma only lowercases the first letter of a model name: `AISession`
  // becomes `aISession` on the client, not `aiSession`. `AIAction` (its
  // sibling here) was a genuinely dead model — zero references anywhere,
  // confirmed by docs/SYSTEM_MAP.md's self-audit — dropped in Stage 12.
  await prisma.aISession.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

export async function cleanupTestClinic(name: string): Promise<void> {
  const clinic = await prisma.clinic.findFirst({ where: { name } });
  if (!clinic) return;

  await prisma.clinicMember.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.clinicInvitation.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.patient.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.appointment.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.invoice.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.labOrder.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.inventoryItem.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.expense.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.waitingList.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.promotion.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.booking.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.document.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.chair.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.priceListItem.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.reminderLog.deleteMany({ where: { clinicId: clinic.id } });
  await prisma.clinic.delete({ where: { id: clinic.id } });
}

export async function getPaymentCount(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true },
  });
  return order?.paymentStatus === 'paid' ? 1 : 0;
}

export async function getOrderStatus(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  return order?.status ?? null;
}
