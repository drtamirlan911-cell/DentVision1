import { PrismaClient, UserRole, ClinicPlan, AppointmentStatus, InvoiceStatus, ImageType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function uid(): string {
  return crypto.randomUUID();
}

async function main() {
  console.log('[SEED] Starting database seed...');

  // Clean
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "audit_logs" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "notifications" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ai_alerts" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ai_actions" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ai_sessions" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "school_enrollments" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "lessons" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "courses" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "orders" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "products" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "inventory" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "invoices" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "lab_orders" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "documents" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "patient_images" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "treatment_plans" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "teeth" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "visits" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "appointments" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "patients" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "clinic_members" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "clinics" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');

  const password = await bcrypt.hash('Demo1234!', 12);

  // ─── Users ───
  const owner = await prisma.user.create({ data: { id: uid(), email: 'owner@dentvision.kz', password, firstName: 'Арман', lastName: 'Касымов', role: 'OWNER', spec: 'Владелец клиники' } });
  const doctor1 = await prisma.user.create({ data: { id: uid(), email: 'doctor@dentvision.kz', password, firstName: 'Доктор', lastName: 'Иванов', role: 'DOCTOR', spec: 'Терапевт' } });
  const doctor2 = await prisma.user.create({ data: { id: uid(), email: 'surgeon@dentvision.kz', password, firstName: 'Айдар', lastName: 'Нурланов', role: 'DOCTOR', spec: 'Хирург-имплантолог' } });
  const assistant = await prisma.user.create({ data: { id: uid(), email: 'assistant@dentvision.kz', password, firstName: 'Алина', lastName: 'Серикова', role: 'ASSISTANT' } });
  const admin = await prisma.user.create({ data: { id: uid(), email: 'admin@dentvision.kz', password, firstName: 'Мария', lastName: 'Петрова', role: 'ADMIN' } });
  const cashier = await prisma.user.create({ data: { id: uid(), email: 'cashier@dentvision.kz', password, firstName: 'Ольга', lastName: 'Сидорова', role: 'CASHIER' } });
  const labUser = await prisma.user.create({ data: { id: uid(), email: 'lab@dentvision.kz', password, firstName: 'Сергей', lastName: 'Козлов', role: 'LAB' } });
  const student = await prisma.user.create({ data: { id: uid(), email: 'student@dentvision.kz', password, firstName: 'Жанель', lastName: 'Абдраимова', role: 'STUDENT' } });
  const superadmin = await prisma.user.create({ data: { id: uid(), email: 'super@dentvision.kz', password, firstName: 'Super', lastName: 'Admin', role: 'SUPERADMIN' } });

  console.log('[SEED] Users created');

  // ─── Clinics ───
  const clinic1 = await prisma.clinic.create({ data: { id: uid(), name: 'KazDent Almaty', city: 'Алматы', address: 'пр. Достык 45', phone: '+77001234567', plan: 'PRO' } });
  const clinic2 = await prisma.clinic.create({ data: { id: uid(), name: 'Smile Clinic Astana', city: 'Астана', address: 'пр. Мәңгілік Ел 62', phone: '+77009876543', plan: 'STANDARD' } });

  // Memberships
  const membershipData = [
    { userId: owner.id, clinicId: clinic1.id, role: 'OWNER' as UserRole },
    { userId: doctor1.id, clinicId: clinic1.id, role: 'DOCTOR' as UserRole },
    { userId: doctor2.id, clinicId: clinic1.id, role: 'DOCTOR' as UserRole },
    { userId: assistant.id, clinicId: clinic1.id, role: 'ASSISTANT' as UserRole },
    { userId: admin.id, clinicId: clinic1.id, role: 'ADMIN' as UserRole },
    { userId: cashier.id, clinicId: clinic1.id, role: 'CASHIER' as UserRole },
    { userId: labUser.id, clinicId: clinic1.id, role: 'LAB' as UserRole },
    { userId: student.id, clinicId: clinic1.id, role: 'STUDENT' as UserRole },
    { userId: owner.id, clinicId: clinic2.id, role: 'OWNER' as UserRole },
  ];
  for (const m of membershipData) {
    await prisma.clinicMember.create({ data: { id: uid(), ...m } });
  }

  console.log('[SEED] Clinics + memberships created');

  // ─── Patients ───
  const patientNames = [
    { firstName: 'Иван', lastName: 'Петров', phone: '+77001111111', gender: 'male' },
    { firstName: 'Мария', lastName: 'Иванова', phone: '+77002222222', gender: 'female' },
    { firstName: 'Алексей', lastName: 'Смирнов', phone: '+77003333333', gender: 'male' },
    { firstName: 'Елена', lastName: 'Козлова', phone: '+77004444444', gender: 'female' },
    { firstName: 'Дмитрий', lastName: 'Новиков', phone: '+77005555555', gender: 'male' },
    { firstName: 'Анна', lastName: 'Морозова', phone: '+77006666666', gender: 'female' },
    { firstName: 'Сергей', lastName: 'Волков', phone: '+77007777777', gender: 'male' },
    { firstName: 'Ольга', lastName: 'Соколова', phone: '+77008888888', gender: 'female' },
    { firstName: 'Нурлан', lastName: 'Сатпаев', phone: '+77009999999', gender: 'male' },
    { firstName: 'Гульнара', lastName: 'Абдуллина', phone: '+77001001001', gender: 'female' },
    { firstName: 'Тимур', lastName: 'Кайдаров', phone: '+77002002002', gender: 'male' },
    { firstName: 'Асель', lastName: 'Турсунова', phone: '+77003003003', gender: 'female' },
  ];

  const patients = [];
  for (const p of patientNames) {
    const patient = await prisma.patient.create({
      data: {
        id: uid(),
        clinicId: clinic1.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        gender: p.gender,
        birthDate: new Date(1980 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      },
    });
    patients.push(patient);
  }

  console.log('[SEED] Patients created');

  // ─── Appointments ───
  const today = new Date();
  const statuses: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  const services = ['Терапия', 'Хирургия', 'Протезирование', 'Чистка', 'Имплантация', 'Ортодонтия'];

  for (let i = 0; i < 20; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + Math.floor(Math.random() * 14) - 3);
    const hour = 9 + Math.floor(Math.random() * 9);
    const minute = Math.random() > 0.5 ? '00' : '30';

    await prisma.appointment.create({
      data: {
        id: uid(),
        clinicId: clinic1.id,
        patientId: patients[i % patients.length].id,
        doctorId: i % 2 === 0 ? doctor1.id : doctor2.id,
        date: day,
        time: `${hour}:${minute}`,
        duration: [30, 45, 60][Math.floor(Math.random() * 3)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        type: services[Math.floor(Math.random() * services.length)],
      },
    });
  }

  console.log('[SEED] Appointments created');

  // ─── Visits ───
  for (let i = 0; i < 10; i++) {
    await prisma.visit.create({
      data: {
        id: uid(),
        patientId: patients[i % patients.length].id,
        doctorId: i % 2 === 0 ? doctor1.id : doctor2.id,
        date: new Date(Date.now() - Math.random() * 30 * 86400000),
        diagnosis: ['Кариес', 'Пульпит', 'Гингивит', 'Пародонтит'][Math.floor(Math.random() * 4)],
        complaints: 'Болезненность при жевании',
      },
    });
  }

  console.log('[SEED] Visits created');

  // ─── Invoices ───
  const invoiceStatuses: InvoiceStatus[] = ['PAID', 'UNPAID', 'PARTIAL'];
  for (let i = 0; i < 15; i++) {
    await prisma.invoice.create({
      data: {
        id: uid(),
        clinicId: clinic1.id,
        patientId: patients[i % patients.length].id,
        amount: Math.floor(Math.random() * 500000) + 50000,
        status: invoiceStatuses[Math.floor(Math.random() * invoiceStatuses.length)],
        items: JSON.stringify([{ name: services[i % services.length], price: Math.floor(Math.random() * 200000) + 30000 }]),
      },
    });
  }

  console.log('[SEED] Invoices created');

  // ─── Products (Shop) ───
  const productData = [
    { name: 'Filtek Supreme', brand: '3M', category: 'Композиты', price: 45000, stock: 25 },
    { name: 'Tetric N-Ceram', brand: 'Ivoclar', category: 'Керамика', price: 38000, stock: 15 },
    { name: 'Straumann BLT', brand: 'Straumann', category: 'Импланты', price: 280000, stock: 8 },
    { name: 'Osstem TS III', brand: 'Osstem', category: 'Импланты', price: 120000, stock: 12 },
    { name: 'Omnichroma', brand: 'Tokuyama', category: 'Композиты', price: 52000, stock: 20 },
    { name: 'Lidocaine 2%', brand: 'Septodont', category: 'Анестетики', price: 3500, stock: 100 },
    { name: 'Artisan Composite', brand: 'Heraeus', category: 'Композиты', price: 41000, stock: 18 },
    { name: 'Bio-Oss', brand: 'Geistlich', category: 'Мембраны', price: 95000, stock: 5 },
    { name: 'CURASEPT ADS 705', brand: 'Curaden', category: 'Гигиена', price: 8500, stock: 40 },
    { name: 'PSA Dental Scanner', brand: '3Shape', category: 'Оборудование', price: 4500000, stock: 1 },
  ];

  const products = [];
  for (const p of productData) {
    const product = await prisma.product.create({ data: { id: uid(), ...p, rating: +(Math.random() * 2 + 3).toFixed(1) } });
    products.push(product);
  }

  console.log('[SEED] Products created');

  // ─── Courses (School) ───
  const course1 = await prisma.course.create({
    data: {
      id: uid(),
      title: 'Основы дентальной имплантации',
      description: 'Полный курс по хирургической имплантации: от планирования до протезирования',
      author: 'Доктор Нурланов А.К.',
      category: 'Хирургия',
      price: 150000,
      duration: '40 часов',
    },
  });
  const course2 = await prisma.course.create({
    data: {
      id: uid(),
      title: 'Эстетическая реставрация',
      description: 'Современные композитные материалы и техники реставрации передних зубов',
      author: 'Доктор Иванов Д.С.',
      category: 'Терапия',
      price: 85000,
      duration: '24 часа',
    },
  });
  const course3 = await prisma.course.create({
    data: {
      id: uid(),
      title: 'Цифровой стоматологический workflow',
      description: 'CAD/CAM, внутриротовые сканеры, CEREC и цифровое планирование',
      author: 'DentVision Academy',
      category: 'Технологии',
      price: 120000,
      duration: '32 часа',
    },
  });

  // Lessons
  const lessonTitles = ['Введение', 'Анатомия', 'Диагностика', 'Планирование', 'Техника', 'Практика', 'Осложнения', 'Итоги'];
  for (const course of [course1, course2, course3]) {
    for (let i = 0; i < lessonTitles.length; i++) {
      await prisma.lesson.create({
        data: {
          id: uid(),
          courseId: course.id,
          title: `${i + 1}. ${lessonTitles[i]}`,
          content: `Содержание урока: ${lessonTitles[i]}`,
          order: i,
          duration: 30 + Math.floor(Math.random() * 30),
        },
      });
    }
  }

  console.log('[SEED] Courses + lessons created');

  // ─── Notifications ───
  const notificationTypes = ['appointment', 'payment', 'lab', 'system', 'ai'];
  for (const user of [owner, doctor1, assistant]) {
    for (let i = 0; i < 5; i++) {
      await prisma.notification.create({
        data: {
          id: uid(),
          userId: user.id,
          type: notificationTypes[i % notificationTypes.length],
          title: ['Новая запись', 'Оплата получен', 'Лаборатория', 'Система', 'AI оповещение'][i],
          message: `Тестовое уведомление #${i + 1}`,
          read: i > 2,
        },
      });
    }
  }

  console.log('[SEED] Notifications created');

  // ─── Inventory ───
  const inventoryData = [
    { name: 'Композит Filtek Supreme', category: 'Материалы', quantity: 25, minimum: 10, price: 45000 },
    { name: 'Анестетик Lidocaine', category: 'Анестетики', quantity: 100, minimum: 30, price: 3500 },
    { name: 'Перчатки (M)', category: 'Расходники', quantity: 500, minimum: 200, price: 150 },
    { name: 'Маски одноразовые', category: 'Расходники', quantity: 300, minimum: 100, price: 50 },
    { name: 'Стерилизационные кассеты', category: 'Стерилизация', quantity: 15, minimum: 20, price: 12000 },
  ];
  for (const item of inventoryData) {
    await prisma.inventoryItem.create({ data: { id: uid(), clinicId: clinic1.id, ...item } });
  }

  console.log('[SEED] Inventory created');
  console.log('[SEED] ✅ Seed complete!');
  console.log('[SEED] Login: owner@dentvision.kz / Demo1234!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
