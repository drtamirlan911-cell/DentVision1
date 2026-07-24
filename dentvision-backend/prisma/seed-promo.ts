/**
 * Promo seed — realistic KZ dental marketplace / CRM / School data for videos.
 * Run: npm run db:seed:promo  (from dentvision-backend)
 *
 * Does a full wipe + base demo users/clinic, then enriches CRM, Shop, School.
 */
import { PrismaClient, type AppointmentStatus, type InvoiceStatus, type SupplierStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { wipeApplicationData } from './lib/reset-database.js';
import {
  seedDemoEnvironment,
  TEST_USER_PASSWORD,
  TEST_USERS,
} from './lib/seed-test-users.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const uid = () => randomUUID();

function dayOffset(days: number, hours = 0, minutes = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function enrichCrm(
  clinicId: string,
  doctorId: string,
  surgeonId: string | undefined,
  ownerId: string,
  existingPatients: { id: string }[],
) {
  // Extra patients for a fuller CRM look
  const extra = [
    { firstName: 'Данияр', lastName: 'Омаров', phone: '+77017770001', gender: 'male', year: 1983, notes: 'Имплантация планируется' },
    { firstName: 'Жанар', lastName: 'Бектурова', phone: '+77017770002', gender: 'female', year: 1991, notes: 'Брекеты' },
    { firstName: 'Руслан', lastName: 'Алиев', phone: '+77017770003', gender: 'male', year: 1975, notes: 'Пародонтит' },
    { firstName: 'Камила', lastName: 'Нургалиева', phone: '+77017770004', gender: 'female', year: 1998, notes: 'Эстетика / виниры' },
    { firstName: 'Тимур', lastName: 'Жумабаев', phone: '+77017770005', gender: 'male', year: 1987, notes: 'Эндодонтия' },
    { firstName: 'Айгерим', lastName: 'Сейтжанова', phone: '+77017770006', gender: 'female', year: 1993, notes: 'Профгигиена' },
  ];

  const patients = [...existingPatients];
  for (const p of extra) {
    patients.push(
      await prisma.patient.create({
        data: {
          id: uid(),
          clinicId,
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
          gender: p.gender,
          birthDate: new Date(p.year, 3, 12),
          notes: p.notes,
        },
      }),
    );
  }

  // Chairs
  const chairs = await Promise.all(
    ['Кресло 1 · Терапия', 'Кресло 2 · Хирургия', 'Кресло 3 · Ортопедия'].map((name, i) =>
      prisma.chair.create({
        data: { id: uid(), clinicId, name, active: true, sortOrder: i + 1 },
      }).catch(() => null),
    ),
  );

  // Dense schedule: today + tomorrow for both doctors
  const schedule: Array<{
    patientIdx: number;
    doctorId: string;
    day: number;
    time: string;
    duration: number;
    status: AppointmentStatus;
    type: string;
    notes: string;
  }> = [
    { patientIdx: 0, doctorId, day: 0, time: '09:00', duration: 45, status: 'CONFIRMED', type: 'Терапия', notes: 'Кариес 26 — пациент в клинике' },
    { patientIdx: 1, doctorId, day: 0, time: '10:00', duration: 60, status: 'CONFIRMED', type: 'Гигиена', notes: 'Профчистка AirFlow' },
    { patientIdx: 2, doctorId, day: 0, time: '11:30', duration: 30, status: 'CONFIRMED', type: 'Консультация', notes: 'План лечения' },
    { patientIdx: 3, doctorId, day: 0, time: '14:00', duration: 90, status: 'CONFIRMED', type: 'Эндодонтия', notes: 'Пульпит 36' },
    { patientIdx: 4, doctorId, day: 0, time: '16:00', duration: 45, status: 'PENDING', type: 'Контроль', notes: 'После пломбы' },
    { patientIdx: 5, doctorId: surgeonId || doctorId, day: 0, time: '09:30', duration: 60, status: 'CONFIRMED', type: 'Хирургия', notes: 'Удаление 48' },
    { patientIdx: 6, doctorId: surgeonId || doctorId, day: 0, time: '12:00', duration: 90, status: 'CONFIRMED', type: 'Имплантация', notes: 'Nobel Biocare 46' },
    { patientIdx: 7, doctorId, day: 1, time: '10:00', duration: 60, status: 'CONFIRMED', type: 'Ортопедия', notes: 'Слепки под коронку' },
    { patientIdx: 8, doctorId: surgeonId || doctorId, day: 1, time: '11:00', duration: 45, status: 'PENDING', type: 'Консультация', notes: 'Имплант vs мост' },
    { patientIdx: 9, doctorId, day: 1, time: '15:00', duration: 30, status: 'CONFIRMED', type: 'Гигиена', notes: 'Поддерживающая' },
    { patientIdx: 0, doctorId, day: -1, time: '15:00', duration: 45, status: 'COMPLETED', type: 'Терапия', notes: 'Пломба выполнена' },
  ];

  for (const s of schedule) {
    const patient = patients[s.patientIdx];
    if (!patient) continue;
    await prisma.appointment.create({
      data: {
        id: uid(),
        clinicId,
        patientId: patient.id,
        doctorId: s.doctorId,
        date: dayOffset(s.day),
        time: s.time,
        duration: s.duration,
        status: s.status,
        type: s.type,
        notes: s.notes,
        meta: chairs[0] ? { chairId: chairs[0].id, chairName: chairs[0].name } : undefined,
      },
    });
  }

  // Invoices — paid + debts for cashier / AI
  const invoiceSpecs: Array<{
    patientIdx: number;
    amount: number;
    status: InvoiceStatus;
    items: { description: string; amount: number }[];
    notes?: string;
    paidDaysAgo?: number;
  }> = [
    {
      patientIdx: 0,
      amount: 28500,
      status: 'PAID',
      items: [
        { description: 'Консультация терапевта', amount: 8500 },
        { description: 'Пломба Filtek Z350', amount: 20000 },
      ],
      paidDaysAgo: 1,
    },
    {
      patientIdx: 1,
      amount: 18000,
      status: 'PAID',
      items: [{ description: 'Профессиональная гигиена', amount: 18000 }],
      paidDaysAgo: 0,
    },
    {
      patientIdx: 2,
      amount: 45000,
      status: 'UNPAID',
      items: [{ description: 'Лечение кариеса 36 (глубокий)', amount: 45000 }],
      notes: 'Ожидает оплату Kaspi',
    },
    {
      patientIdx: 3,
      amount: 120000,
      status: 'PARTIAL',
      items: [
        { description: 'Эндодонтия 3 канала', amount: 75000 },
        { description: 'Временная коронка', amount: 45000 },
      ],
      notes: 'Внесено 60 000 ₸',
      paidDaysAgo: 2,
    },
    {
      patientIdx: 5,
      amount: 35000,
      status: 'UNPAID',
      items: [{ description: 'Удаление зуба мудрости', amount: 35000 }],
    },
    {
      patientIdx: 6,
      amount: 280000,
      status: 'PAID',
      items: [
        { description: 'Имплант Nobel Biocare', amount: 180000 },
        { description: 'Формирователь десны', amount: 35000 },
        { description: 'Хирургический шаблон', amount: 65000 },
      ],
      paidDaysAgo: 3,
    },
  ];

  for (const inv of invoiceSpecs) {
    const patient = patients[inv.patientIdx];
    if (!patient) continue;
    await prisma.invoice.create({
      data: {
        id: uid(),
        clinicId,
        patientId: patient.id,
        amount: inv.amount,
        status: inv.status,
        items: inv.items,
        notes: inv.notes,
        paidAt: inv.paidDaysAgo != null ? dayOffset(-inv.paidDaysAgo, 12) : null,
      },
    });
  }

  // Inventory with realistic low-stock alerts
  const stock = [
    { name: 'Композит Filtek Ultimate A2', category: 'materials', quantity: 4, minimum: 8, price: 12500, unit: 'шт', supplier: 'DentaTrade KZ' },
    { name: 'Анестетик Ubistesin Forte', category: 'medicines', quantity: 12, minimum: 30, price: 1450, unit: 'карп', supplier: 'MedSupply Almaty' },
    { name: 'Перчатки нитриловые M', category: 'consumables', quantity: 85, minimum: 100, price: 28, unit: 'шт', supplier: 'ClinicBox' },
    { name: 'Имплант Nobel Parallel CC 4.3', category: 'implants', quantity: 2, minimum: 3, price: 95000, unit: 'шт', supplier: 'Nobel Partner KZ' },
    { name: 'Гуттаперча Reciproc Blue', category: 'materials', quantity: 18, minimum: 10, price: 3200, unit: 'уп', supplier: 'DentaTrade KZ' },
    { name: 'Маски 3-слойные', category: 'consumables', quantity: 240, minimum: 50, price: 15, unit: 'шт', supplier: 'ClinicBox' },
    { name: 'Слюноотсосы одноразовые', category: 'consumables', quantity: 40, minimum: 80, price: 12, unit: 'шт', supplier: 'ClinicBox' },
    { name: 'Цемент RelyX Unicem', category: 'materials', quantity: 6, minimum: 4, price: 18500, unit: 'шт', supplier: 'DentaTrade KZ' },
  ];
  for (const item of stock) {
    await prisma.inventoryItem.create({ data: { id: uid(), clinicId, ...item } });
  }

  // Price list
  const services = [
    { code: 'CONS', name: 'Консультация врача', price: 8500 },
    { code: 'HYG', name: 'Профессиональная гигиена', price: 18000 },
    { code: 'FILL1', name: 'Лечение кариеса 1 поверхность', price: 20000 },
    { code: 'ENDO', name: 'Эндодонтия (1 канал)', price: 35000 },
    { code: 'IMPL', name: 'Установка импланта', price: 180000 },
    { code: 'CROWN', name: 'Коронка цирконий', price: 95000 },
  ];
  for (const s of services) {
    await prisma.priceListItem.create({
      data: { id: uid(), clinicId, serviceCode: s.code, name: s.name, price: s.price },
    });
  }

  // Odontogram sample for first patient
  const p0 = patients[0];
  if (p0) {
    await prisma.tooth.createMany({
      data: [
        { id: uid(), patientId: p0.id, number: 16, condition: 'healthy' },
        { id: uid(), patientId: p0.id, number: 26, condition: 'caries', diagnosis: 'Кариес средний', notes: 'Сегодня в плане' },
        { id: uid(), patientId: p0.id, number: 36, condition: 'filled', diagnosis: 'Пломба', notes: '2025' },
        { id: uid(), patientId: p0.id, number: 46, condition: 'crown', diagnosis: 'Коронка Zr', notes: '2024' },
        { id: uid(), patientId: p0.id, number: 47, condition: 'missing', diagnosis: 'Отсутствует', notes: 'Имплант в плане' },
      ],
    });
    await prisma.treatmentPlan.create({
      data: {
        id: uid(),
        patientId: p0.id,
        title: 'План лечения — Петров И.',
        status: 'active',
        price: 275000,
        items: [
          { tooth: 26, treatment: 'Лечение кариеса + Filtek', price: 20000, status: 'in_progress' },
          { tooth: 47, treatment: 'Имплантация + коронка', price: 255000, status: 'planned' },
        ],
        notes: 'Приоритет: 26 сегодня, имплант через 2 недели',
      },
    });
  }

  return { patientCount: patients.length };
}

async function seedShop(ownerUserId: string) {
  // Dedicated supplier owner account (for /supplier workspace demos)
  const password = await bcrypt.hash(TEST_USER_PASSWORD, 10);
  let supplierUser = await prisma.user.findUnique({ where: { email: 'supplier@dentvision.kz' } });
  if (!supplierUser) {
    supplierUser = await prisma.user.create({
      data: {
        id: uid(),
        email: 'supplier@dentvision.kz',
        password,
        firstName: 'Ерлан',
        lastName: 'Мусаев',
        role: 'OWNER',
        phone: '+77015550101',
      },
    });
  }

  const suppliersData: Array<{
    name: string;
    status: SupplierStatus;
    bin: string;
    city: string;
    phone: string;
    email: string;
    contact: string;
    products: Array<{
      name: string;
      brand: string;
      category: string;
      price: number;
      stock: number;
      rating: number;
      description: string;
      country: string;
    }>;
  }> = [
    {
      name: 'DentaTrade KZ',
      status: 'OFFICIAL_PARTNER',
      bin: '180540012345',
      city: 'Алматы',
      phone: '+7 727 355 10 20',
      email: 'sales@dentatrade.kz',
      contact: 'Ерлан Мусаев',
      products: [
        { name: 'Filtek Ultimate A2 Syringe', brand: '3M ESPE', category: 'Реставрация', price: 14500, stock: 48, rating: 4.9, description: 'Универсальный нанокомпозит для прямых реставраций', country: 'США' },
        { name: 'Scotchbond Universal Plus', brand: '3M ESPE', category: 'Реставрация', price: 28900, stock: 22, rating: 4.8, description: 'Адгезив 8-го поколения', country: 'США' },
        { name: 'RelyX Unicem 2 Automix', brand: '3M ESPE', category: 'Цементы', price: 31200, stock: 15, rating: 4.7, description: 'Самоадгезивный композитный цемент', country: 'Германия' },
        { name: 'ProTaper Gold F2', brand: 'Dentsply', category: 'Эндодонтия', price: 9800, stock: 60, rating: 4.6, description: 'Машинные файлы NiTi', country: 'Швейцария' },
        { name: 'AH Plus Jet', brand: 'Dentsply', category: 'Эндодонтия', price: 17600, stock: 30, rating: 4.8, description: 'Силер для обтурации каналов', country: 'Германия' },
      ],
    },
    {
      name: 'MedSupply Almaty',
      status: 'VERIFIED',
      bin: '150840098765',
      city: 'Алматы',
      phone: '+7 727 250 88 11',
      email: 'order@medsupply.kz',
      contact: 'Айгуль Нурpeисова',
      products: [
        { name: 'Ubistesin Forte 1:100000', brand: '3M ESPE', category: 'Анестезия', price: 1450, stock: 200, rating: 4.9, description: 'Артикаин 4% с эпинефрином', country: 'Германия' },
        { name: 'Septanest 1:100000', brand: 'Septodont', category: 'Анестезия', price: 1380, stock: 160, rating: 4.7, description: 'Карпулы анестетика', country: 'Франция' },
        { name: 'Иглы карпульные 27G', brand: 'Septodont', category: 'Расходники', price: 95, stock: 500, rating: 4.5, description: 'Стерильные иглы для карпульного шприца', country: 'Франция' },
        { name: 'Аспирационный наконечник', brand: 'Dürr', category: 'Оборудование', price: 4200, stock: 40, rating: 4.4, description: 'Слюноотсос многоразовый', country: 'Германия' },
      ],
    },
    {
      name: 'Nobel Partner KZ',
      status: 'OFFICIAL_PARTNER',
      bin: '200140055512',
      city: 'Астана',
      phone: '+7 7172 55 40 40',
      email: 'kz@nobelpartner.kz',
      contact: 'Марат Касымов',
      products: [
        { name: 'Nobel Parallel CC 4.3×10', brand: 'Nobel Biocare', category: 'Имплантология', price: 125000, stock: 12, rating: 5.0, description: 'Имплант с коническим соединением', country: 'Швейцария' },
        { name: 'Healing Abutment 5mm', brand: 'Nobel Biocare', category: 'Имплантология', price: 28500, stock: 24, rating: 4.8, description: 'Формирователь десны', country: 'Швейцария' },
        { name: 'Multi-unit Abutment', brand: 'Nobel Biocare', category: 'Имплантология', price: 52000, stock: 8, rating: 4.9, description: 'Абатмент для All-on-4', country: 'Швейцария' },
      ],
    },
  ];

  const createdSuppliers = [];
  for (const [idx, s] of suppliersData.entries()) {
    const supplier = await prisma.supplier.create({
      data: {
        id: uid(),
        name: s.name,
        kind: 'SUPPLIER',
        bin: s.bin,
        legalAddress: `${s.city}, Казахстан`,
        contactPerson: s.contact,
        phone: s.phone,
        email: s.email,
        status: s.status,
      },
    });
    createdSuppliers.push(supplier);

    if (idx === 0) {
      await prisma.supplierMember.create({
        data: { id: uid(), userId: supplierUser.id, supplierId: supplier.id, role: 'owner' },
      });
      // Also give clinic owner a view into second supplier? Skip — one membership enough
    }

    for (const p of s.products) {
      await prisma.product.create({
        data: {
          id: uid(),
          name: p.name,
          brand: p.brand,
          category: p.category,
          price: p.price,
          stock: p.stock,
          rating: p.rating,
          description: p.description,
          manufacturer: p.brand,
          country: p.country,
          supplierId: supplier.id,
        },
      });
    }
  }

  // Sample order from clinic
  const sampleProducts = await prisma.product.findMany({ take: 2, orderBy: { rating: 'desc' } });
  if (sampleProducts.length) {
    await prisma.order.create({
      data: {
        id: uid(),
        clinicId: (await prisma.clinic.findFirst())!.id,
        userId: ownerUserId,
        status: 'processing',
        total: sampleProducts.reduce((s, p) => s + p.price, 0),
        items: sampleProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          price: p.price,
          qty: 1,
        })),
      },
    });
  }

  return { suppliers: createdSuppliers.length, supplierEmail: supplierUser.email };
}

async function seedSchool(doctorUserId: string, studentUserId: string | undefined) {
  const academy = await prisma.academy.create({
    data: {
      id: uid(),
      name: 'DentVision Academy Almaty',
      ownerId: doctorUserId,
      city: 'Алматы',
    },
  });

  const lecturer = await prisma.lecturer.create({
    data: {
      id: uid(),
      userId: doctorUserId,
      level: 'VERIFIED',
      bio: 'К.м.н., имплантолог. 12 лет практики, 40+ курсов, спикер ITI Kazakhstan.',
      academyId: academy.id,
    },
  });

  await prisma.expertVerification.create({
    data: {
      id: uid(),
      lecturerId: lecturer.id,
      type: 'diploma',
      url: 'https://example.com/diploma.pdf',
      verified: true,
    },
  });

  // Second lecturer profile if we have surgeon
  const surgeon = await prisma.user.findUnique({ where: { email: 'surgeon@dentvision.kz' } });
  let lecturer2Id: string | null = null;
  if (surgeon) {
    const lec2 = await prisma.lecturer.create({
      data: {
        id: uid(),
        userId: surgeon.id,
        level: 'EXPERT',
        bio: 'Хирург-имплантолог, All-on-4, костная пластика. Клиника «Дентал Плюс».',
        academyId: academy.id,
      },
    });
    lecturer2Id = lec2.id;
  }

  const coursesSpec = [
    {
      title: 'Имплантация с нуля до All-on-4',
      description: 'Полный цикл: планирование, хирургия, протезирование. Разбор 12 клинических кейсов.',
      author: 'Др. Иванов · DentVision Academy',
      category: 'Имплантация',
      price: 89000,
      duration: '12 ч',
      lecturerId: lecturer2Id || lecturer.id,
      lessons: [
        'Анатомия и планирование на CBCT',
        'Хирургический протокол Nobel Parallel',
        'Немедленная нагрузка: когда можно',
        'All-on-4: шаблон и мульти-юнит',
        'Осложнения и как их избежать',
      ],
    },
    {
      title: 'Эндодонтия под микроскопом',
      description: 'Современные протоколы обработки и обтурации. NiTi, ирригация, 3D-обтурация.',
      author: 'Др. Иванов · DentVision Academy',
      category: 'Эндодонтия',
      price: 65000,
      duration: '8 ч',
      lecturerId: lecturer.id,
      lessons: [
        'Диагностика и доступ',
        'Машинная обработка Reciproc / ProTaper',
        'Ирригация и активация',
        'Обтурация и контроль',
      ],
    },
    {
      title: 'AI в стоматологической клинике',
      description: 'Как внедрить AI-ассистента: запись, долги, закупки, обучение команды.',
      author: 'DentVision Product Team',
      category: 'AI',
      price: 0,
      duration: '3 ч',
      lecturerId: lecturer.id,
      lessons: [
        'Зачем AI клинике',
        'Сценарии дня владельца и врача',
        'Безопасность данных и подтверждение действий',
      ],
    },
    {
      title: 'Прямые реставрации: анатомия и цвет',
      description: 'Filtek Ultimate, стратификация, полировка до «невидимой» пломбы.',
      author: 'Др. Иванова · Терапевт',
      category: 'Терапия',
      price: 45000,
      duration: '6 ч',
      lecturerId: lecturer.id,
      lessons: [
        'Цветоведение и фотопротокол',
        'Стратификация по слоям',
        'Финишная обработка и полировка',
      ],
    },
  ];

  let courseCount = 0;
  for (const c of coursesSpec) {
    const courseId = uid();
    await prisma.course.create({
      data: {
        id: courseId,
        title: c.title,
        description: c.description,
        author: c.author,
        category: c.category,
        price: c.price,
        duration: c.duration,
        lecturerId: c.lecturerId,
        academyId: academy.id,
        imageUrl: null,
      },
    });
    for (const [i, title] of c.lessons.entries()) {
      await prisma.lesson.create({
        data: {
          id: uid(),
          courseId,
          title,
          order: i + 1,
          duration: 25 + i * 5,
          content: `Материалы урока «${title}»: презентация, чек-лист, видеоразбор.`,
        },
      });
    }
    if (studentUserId) {
      await prisma.schoolEnrollment.create({
        data: {
          id: uid(),
          userId: studentUserId,
          courseId,
          progress: iProgress(iSeed(courseId)),
        },
      }).catch(() => undefined);
    }
    courseCount++;
  }

  return { academy: academy.name, courses: courseCount, lecturerId: lecturer.id };
}

function iSeed(s: string) {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
}
function iProgress(n: number) {
  return (n % 70) + 10;
}

async function main() {
  console.log('[PROMO SEED] Wipe + base demo…');
  await wipeApplicationData(prisma);
  const { users, clinic, patients } = await seedDemoEnvironment(prisma);

  const owner = users.find((u) => u.email === 'owner@dentvision.kz')!;
  const doctor = users.find((u) => u.email === 'doctor@dentvision.kz')!;
  const surgeon = users.find((u) => u.email === 'surgeon@dentvision.kz');
  const student = users.find((u) => u.email === 'student@dentvision.kz');

  console.log('[PROMO SEED] Enrich CRM…');
  const crm = await enrichCrm(clinic.id, doctor.id, surgeon?.id, owner.id, patients);

  console.log('[PROMO SEED] Shop + suppliers…');
  const shop = await seedShop(owner.id);

  console.log('[PROMO SEED] School + lecturers…');
  const school = await seedSchool(doctor.id, student?.id);

  console.log('[PROMO SEED] Done.');
  console.log(`  Clinic: ${clinic.name}`);
  console.log(`  Patients: ${crm.patientCount}`);
  console.log(`  Suppliers: ${shop.suppliers} · seller login: ${shop.supplierEmail} / ${TEST_USER_PASSWORD}`);
  console.log(`  School: ${school.courses} courses @ ${school.academy}`);
  console.log('  Logins:');
  for (const u of TEST_USERS) console.log(`    • ${u.email} (${u.role}) / ${TEST_USER_PASSWORD}`);
  console.log(`    • supplier@dentvision.kz (SUPPLIER) / ${TEST_USER_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('[PROMO SEED] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
