import prisma from '../src/lib/prisma.js';
import { randomUUID } from 'node:crypto';
import { PRODUCT_PRESETS } from '../src/modules/shop/product-presets.seed.js';
import { CLINICAL_CASES, LIBRARY_ITEMS } from '../src/modules/school/academyContent.js';

if (process.env.NODE_ENV !== 'production') {
  throw new Error('bootstrap-production-catalog.ts is production-only');
}

const ACADEMY_NAME = 'DentVision Academy OS';

function slugify(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/[^a-z0-9а-я]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

async function ensureMarketplaceCatalog() {
  const categoryNames = [...new Set(PRODUCT_PRESETS.map((p) => p.categoryQuery))];
  const categories = new Map<string, string>();

  for (let index = 0; index < categoryNames.length; index += 1) {
    const name = categoryNames[index]!;
    const slug = slugify(name);
    const existing = await prisma.shopCategory.findUnique({ where: { slug } });
    const row = existing ?? await prisma.shopCategory.create({
      data: { id: randomUUID(), name, slug, sortOrder: index, isActive: true },
    });
    categories.set(name, row.id);
  }

  let created = 0;
  let updated = 0;
  for (const preset of PRODUCT_PRESETS) {
    const categoryId = categories.get(preset.categoryQuery) ?? null;
    const existing = await prisma.product.findFirst({
      where: { name: preset.name, manufacturer: preset.manufacturer },
      select: { id: true },
    });
    const data = {
      name: preset.name,
      brand: preset.brand,
      category: preset.categoryQuery,
      categoryId,
      price: preset.avgPrice,
      stock: 0,
      minStock: 0,
      description: preset.description,
      unit: preset.unit,
      tags: preset.tags,
      specs: preset.specs,
      manufacturer: preset.manufacturer,
      country: preset.manufacturer,
      currency: 'KZT',
      isActive: true,
    };
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.product.create({ data: { id: randomUUID(), ...data } });
      created += 1;
    }
  }
  console.log(`[BOOTSTRAP] Marketplace catalog: +${created}, updated ${updated}, categories ${categories.size}`);
}

async function ensureAcademy() {
  let academy = await prisma.academy.findFirst({ where: { name: ACADEMY_NAME }, select: { id: true } });
  if (!academy) {
    academy = await prisma.academy.create({ data: { id: randomUUID(), name: ACADEMY_NAME, city: 'Казахстан' }, select: { id: true } });
  }

  let organization = await prisma.organization.findFirst({
    where: { originalType: 'Academy', originalId: academy.id },
    select: { id: true },
  });
  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: ACADEMY_NAME,
        type: 'ACADEMY',
        originalType: 'Academy',
        originalId: academy.id,
        contacts: { country: 'KZ' },
      },
      select: { id: true },
    });
  }

  const branch = await prisma.branch.findFirst({
    where: { organizationId: organization.id, code: 'PLATFORM' },
    select: { id: true },
  });
  if (!branch) {
    await prisma.branch.create({
      data: {
        id: randomUUID(),
        organizationId: organization.id,
        code: 'PLATFORM',
        name: 'DentVision Academy',
        city: 'Казахстан',
        active: true,
        isDefault: true,
      },
    });
  }

  let coursesCreated = 0;
  for (const clinicalCase of CLINICAL_CASES) {
    const title = `Кейс: ${clinicalCase.title}`;
    const existing = await prisma.course.findFirst({ where: { academyId: academy.id, title }, select: { id: true } });
    const course = existing
      ? await prisma.course.update({
          where: { id: existing.id },
          data: {
            description: clinicalCase.description,
            author: clinicalCase.author,
            category: clinicalCase.category,
            price: 0,
            format: 'course',
            meta: { source: 'DentVision Academy OS', caseId: clinicalCase.id, tags: clinicalCase.tags },
          },
          select: { id: true },
        })
      : await prisma.course.create({
          data: {
            id: randomUUID(),
            title,
            description: clinicalCase.description,
            author: clinicalCase.author,
            category: clinicalCase.category,
            price: 0,
            format: 'course',
            academyId: academy.id,
            meta: { source: 'DentVision Academy OS', caseId: clinicalCase.id, tags: clinicalCase.tags },
          },
          select: { id: true },
        });

    const lesson = await prisma.lesson.findFirst({ where: { courseId: course.id, title: 'Клинический разбор' }, select: { id: true } });
    if (!lesson) {
      await prisma.lesson.create({
        data: {
          id: randomUUID(),
          courseId: course.id,
          title: 'Клинический разбор',
          content: clinicalCase.description,
          order: 1,
          duration: 30,
        },
      });
    }
    if (!existing) coursesCreated += 1;
  }

  for (const item of LIBRARY_ITEMS) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "school_library_items"
          (id, title, description, author, category, type, url, content, tags)
         SELECT $1,$2,$3,$4,$5,$6,NULL,$7,$8::jsonb
         WHERE NOT EXISTS (SELECT 1 FROM "school_library_items" WHERE title = $2)`,
        randomUUID(), item.title, null, item.author, item.category, item.type, null, JSON.stringify([]),
      );
    } catch {
      break;
    }
  }

  console.log(`[BOOTSTRAP] Academy: ${academy.id}; organization ${organization.id}; courses +${coursesCreated}`);
}

async function main() {
  await ensureMarketplaceCatalog();
  await ensureAcademy();
  console.log('[BOOTSTRAP] Production reference catalog reconciliation complete');
}

main()
  .catch((error) => {
    console.error('[BOOTSTRAP] Production catalog reconciliation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
