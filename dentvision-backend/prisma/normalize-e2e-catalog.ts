import { PrismaClient } from '@prisma/client';

/**
 * The real catalog endpoint paginates before the response-level audience guard
 * runs. Keep the deterministic GENERAL fixture at the head of the public
 * catalogue so existing unauthenticated marketplace workflows continue to
 * exercise a sellable public item without weakening the audience boundary.
 *
 * This is test-only data normalization; production catalog ordering is not
 * modified by this script.
 */
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { name: 'E2E Oral Care Starter Kit' },
    select: { id: true },
  });

  if (!product) {
    throw new Error('E2E GENERAL marketplace fixture was not seeded');
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { createdAt: new Date('2099-01-01T00:00:00.000Z') },
  });

  console.log('[SEED:E2E] GENERAL marketplace fixture promoted to the deterministic first page');
}

main()
  .catch((error) => {
    console.error('[SEED:E2E] Catalog normalization failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
