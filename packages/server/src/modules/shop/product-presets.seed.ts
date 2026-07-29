import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';

export const PRODUCT_PRESETS = [
  // ─── Composite Materials ───
  { name: 'Filtek Supreme XTE', brand: '3M ESPE', categoryQuery: 'Композиты', avgPrice: 25000, unit: 'шт', manufacturer: 'США', description: 'Универсальный наногибридный композит для реставрации всех групп зубов. Квартальные шприцы 4 г.', specs: { type: 'наногибрид', shade_count: 'A1-A4, B1-B3, C2-C3', quantity_g: 4, application: 'передние/жевательные' } },
  { name: 'Estelite Sigma Quick', brand: 'Tokuyama', categoryQuery: 'Композиты', avgPrice: 22000, unit: 'шт', manufacturer: 'Япония', description: 'Светоотверждаемый супра-нано композит с высокой полируемостью.', specs: { type: 'супра-нано', quantity_g: 4.5, application: 'передние/жевательные', translucency: 'высокая' } },
  { name: 'Charisma Diamond', brand: 'Kulzer', categoryQuery: 'Композиты', avgPrice: 18000, unit: 'шт', manufacturer: 'Германия', description: 'Наполненный композит с алмазными частицами для высокой износостойкости.', specs: { type: 'гибридный', quantity_g: 4, application: 'жевательные' } },
  { name: 'G-ænial Posterior', brand: 'GC', categoryQuery: 'Композиты', avgPrice: 20000, unit: 'шт', manufacturer: 'Япония', description: 'Композит для жевательных зубов с низкой усадкой.', specs: { type: 'микро-нано', quantity_g: 4, application: 'жевательные', shrinkage: '1.6%' } },
  // ─── Adhesives ───
  { name: 'Adper Single Bond 2', brand: '3M ESPE', categoryQuery: 'Адгезивы', avgPrice: 15000, unit: 'флакон', manufacturer: 'США', description: 'Однокомпонентный адгезив 5-го поколения. Флакон 5 мл.', specs: { volume_ml: 5, generation: 5, type: 'total-etch', light_cure: true } },
  { name: 'OptiBond FL', brand: 'Kerr', categoryQuery: 'Адгезивы', avgPrice: 18000, unit: 'набор', manufacturer: 'США', description: 'Золотой стандарт адгезивов 4-го поколения. Набор праймер + бонд.', specs: { generation: 4, type: 'total-etch', kit: 'праймер+бонд', volume_ml: 6 } },
  { name: 'Futurabond U', brand: 'VOCO', categoryQuery: 'Адгезивы', avgPrice: 14000, unit: 'флакон', manufacturer: 'Германия', description: 'Универсальный адгезив 7-го поколения для всех техник травления.', specs: { generation: 7, type: 'universal', volume_ml: 5, dual_cure: true } },
  { name: 'Clearfil SE Bond 2', brand: 'Kuraray', categoryQuery: 'Адгезивы', avgPrice: 17000, unit: 'набор', manufacturer: 'Япония', description: 'Самопротравливающий адгезив 2-го поколения. Набор.', specs: { generation: 2, type: 'self-etch', kit: 'праймер+бонд', volume_ml: 5 } },
  // ─── Cements ───
  { name: 'Ketac CEM Easymix', brand: '3M ESPE', categoryQuery: 'Цементы', avgPrice: 12000, unit: 'набор', manufacturer: 'Германия', description: 'Стеклоиономерный цемент для фиксации коронок и мостов.', specs: { type: 'стеклоиономерный', application: 'фиксация', mixing: 'капсулы', quantity: '50 капсул' } },
  { name: 'RelyX Ultimate', brand: '3M ESPE', categoryQuery: 'Цементы', avgPrice: 25000, unit: 'шприц', manufacturer: 'США', description: 'Адгезивный композитный цемент двойного отверждения.', specs: { type: 'композитный', curing: 'двойной', application: 'фиксация', quantity_ml: 5 } },
  { name: 'Fuji CEM 2', brand: 'GC', categoryQuery: 'Цементы', avgPrice: 10000, unit: 'набор', manufacturer: 'Япония', description: 'Стеклоиономерный цемент для фиксации с фтор-выделением.', specs: { type: 'стеклоиономерный', fluorine_release: true, quantity: 'порошок 15г + жидкость 10мл' } },
  { name: 'MaxCEM Elite', brand: 'Kerr', categoryQuery: 'Цементы', avgPrice: 22000, unit: 'шприц', manufacturer: 'США', description: 'Самоадгезивный композитный цемент для всех видов фиксации.', specs: { type: 'самоадгезивный', quantity_ml: 5, curing: 'двойной', shades: ['A1', 'A2', 'A3', 'translucent'] } },
  // ─── Impression Materials ───
  { name: 'Aquasil Ultra+', brand: 'Dentsply Sirona', categoryQuery: 'Слепочные массы', avgPrice: 28000, unit: 'набор', manufacturer: 'США', description: 'A-силикон для двухфазного двухэтапного метода. Набор 4 картриджа.', specs: { type: 'A-силикон', viscosity: 'medium+heavy', quantity_ml: 4*50, mixing: 'автомат', set_time_min: 3.5 } },
  { name: 'Honigum Heavy', brand: 'DMG', categoryQuery: 'Слепочные массы', avgPrice: 12000, unit: 'картридж', manufacturer: 'Германия', description: 'Высоковязкий A-силикон для базового слоя.', specs: { type: 'A-силикон', viscosity: 'heavy', quantity_ml: 50, mixing: 'автомат' } },
  { name: 'Silagum Ultra', brand: 'DMG', categoryQuery: 'Слепочные массы', avgPrice: 15000, unit: 'картридж', manufacturer: 'Германия', description: 'Монофазный A-силикон для одноэтапных слепков.', specs: { type: 'A-силикон', viscosity: 'monophase', quantity_ml: 50, mixing: 'автомат' } },
  { name: 'Speedex Putty', brand: 'Coltène', categoryQuery: 'Слепочные массы', avgPrice: 8000, unit: 'набор', manufacturer: 'Швейцария', description: 'C-силикон для базового слоя. Банка 500 мл + катализатор.', specs: { type: 'C-силикон', viscosity: 'putty', quantity_ml: 500, mixing: 'ручной' } },
  // ─── Rotary Instruments ───
  { name: 'ProTaper Universal', brand: 'Dentsply Sirona', categoryQuery: 'Эндодонтия', avgPrice: 35000, unit: 'набор', manufacturer: 'Швейцария', description: 'NiTi файлы для машинной обработки корневых каналов. Набор 6 шт.', specs: { type: 'NiTi ротационные', quantity: 6, system: 'ProTaper', material: 'NiTi', sterilization: true } },
  { name: 'WaveOne Gold', brand: 'Dentsply Sirona', categoryQuery: 'Эндодонтия', avgPrice: 40000, unit: 'набор', manufacturer: 'Швейцария', description: 'Gold-wire реципрокные файлы. Набор первичных/финишных.', specs: { type: 'реципрокные', material: 'Gold-wire', quantity: 4, system: 'WaveOne Gold' } },
  { name: 'Mani Peeso Reamer', brand: 'Mani', categoryQuery: 'Эндодонтия', avgPrice: 3000, unit: 'шт', manufacturer: 'Япония', description: 'Peeso сверло для формирования устья канала. Длина 28 мм.', specs: { type: 'сверло', length_mm: 28, application: 'формирование устья', material: 'нерж. сталь', sizes: ['1', '2', '3', '4', '5', '6'] } },
  { name: 'VDW Gutta Percha', brand: 'VDW', categoryQuery: 'Эндодонтия', avgPrice: 5000, unit: 'упаковка', manufacturer: 'Германия', description: 'Гуттаперчевые штифты для пломбирования каналов. Упаковка 60 шт.', specs: { type: 'гуттаперчевые штифты', quantity: 60, taper: '0.04/0.06', sizes: ['15-40'] } },
  // ─── Handpieces ───
  { name: 'NSK S-Max M500', brand: 'NSK', categoryQuery: 'Наконечники', avgPrice: 250000, unit: 'шт', manufacturer: 'Япония', description: 'Микромотор с наконечником 1:5 для всех видов препарирования.', specs: { type: 'микромотор', ratio: '1:5', max_rpm: 40000, cooling: 'воздушный/водяной', autoclave: true } },
  { name: 'W&H Synea TA-98', brand: 'W&H', categoryQuery: 'Наконечники', avgPrice: 180000, unit: 'шт', manufacturer: 'Австрия', description: 'Турбинный наконечник с LED-подсветкой и керамическими подшипниками.', specs: { type: 'турбинный', lighting: 'LED', bearings: 'керамические', max_rpm: 350000, autoclave: true } },
  { name: 'KaVo MULTIflex Lux', brand: 'KaVo', categoryQuery: 'Наконечники', avgPrice: 160000, unit: 'шт', manufacturer: 'Германия', description: 'Турбинный наконечник с системой push-button и LED.', specs: { type: 'турбинный', connection: 'push-button', lighting: 'LED', max_rpm: 300000, autoclave: true } },
  { name: 'Bien Air Chiropro L', brand: 'Bien Air', categoryQuery: 'Наконечники', avgPrice: 220000, unit: 'шт', manufacturer: 'Швейцария', description: 'Хирургический наконечник с LED для имплантологии.', specs: { type: 'хирургический', ratio: '20:1', lighting: 'LED', torque: 'высокий', irrigation: true, autoclave: true } },
  // ─── Curing Lights ───
  { name: 'Valo Cordless', brand: 'Ultradent', categoryQuery: 'Фотополимеризаторы', avgPrice: 280000, unit: 'шт', manufacturer: 'США', description: 'Беспроводная LED-лампа с мощностью до 3200 мВт/см².', specs: { type: 'LED', power_mwcm2: 3200, wireless: true, modes: ['стандарт', 'мягкий', 'пульс', 'Xtra'], battery: 'Li-ion' } },
  { name: 'Bluephase Style M8', brand: 'Ivoclar', categoryQuery: 'Фотополимеризаторы', avgPrice: 320000, unit: 'шт', manufacturer: 'Лихтенштейн', description: 'Профессиональная LED-лампа с полимеризацией за 5 секунд.', specs: { type: 'LED', power_mwcm2: 3000, wireless: true, curing_time_sec: 5, battery: 'Li-ion 2000mAh' } },
  // ─── Surgical Instruments ───
  { name: 'Scalpel BP Handle #3', brand: 'Hu-Friedy', categoryQuery: 'Хирургия', avgPrice: 4000, unit: 'шт', manufacturer: 'США', description: 'Рукоятка скальпеля стандарт #3 для лезвий 10/11/15.', specs: { type: 'рукоятка', size: 3, material: 'нерж. сталь', sterilization: true, reusable: true } },
  { name: 'Periosteal Elevator Molt 9', brand: 'Hu-Friedy', categoryQuery: 'Хирургия', avgPrice: 6000, unit: 'шт', manufacturer: 'США', description: 'Распатор для отделения надкостницы, двусторонний.', specs: { type: 'распатор', size: 'Molt 9', material: 'нерж. сталь', sterilization: true } },
  { name: 'Tissue Forceps Adson', brand: 'Hu-Friedy', categoryQuery: 'Хирургия', avgPrice: 5500, unit: 'шт', manufacturer: 'США', description: 'Хирургический пинцет с зубцами для захвата тканей.', specs: { type: 'пинцет', tooth_count: '1x2', material: 'нерж. сталь', length_cm: 12, sterilization: true } },
  // ─── Hygiene / Preventive ───
  { name: 'Nupro Prophy Paste', brand: 'Dentsply Sirona', categoryQuery: 'Гигиена', avgPrice: 3500, unit: 'шприц', manufacturer: 'США', description: 'Профессиональная паста для полировки зубов с фтором.', specs: { type: 'полировочная', fluoride_ppm: 4000, grit: ['medium', 'fine', 'coarse'], quantity_g: 50 } },
  { name: 'Clinpro Prophy Powder', brand: '3M ESPE', categoryQuery: 'Гигиена', avgPrice: 8000, unit: 'банка', manufacturer: 'США', description: 'Порошок для Air-flow с приятным вкусом. Банка 200 г.', specs: { type: 'Air-flow', quantity_g: 200, flavor: 'mint', particle_size_micron: 30 } },
  { name: 'Elmex Professional Gel', brand: 'GABA', categoryQuery: 'Гигиена', avgPrice: 2500, unit: 'тюбик', manufacturer: 'Германия', description: 'Фтор-гель для профессиональной фторизации. Тюбик 100 мл.', specs: { type: 'фтор-гель', fluoride_ppm: 12500, volume_ml: 100, application: 'каппы/кисточка' } },
  // ─── Local Anesthesia ───
  { name: 'Septanest 1:200000', brand: 'Septodont', categoryQuery: 'Анестезия', avgPrice: 1500, unit: 'карпула', manufacturer: 'Франция', description: 'Артикаин 4% с адреналином 1:200000. Карпула 1.7 мл.', specs: { anesthetic: 'артикаин 4%', vasoconstrictor: 'адреналин 1:200000', volume_ml: 1.7, quantity_per_pack: 50 } },
  { name: 'Ubistesin 1:200000', brand: '3M ESPE', categoryQuery: 'Анестезия', avgPrice: 1400, unit: 'карпула', manufacturer: 'Германия', description: 'Артикаин 4% с адреналином для рутинных процедур.', specs: { anesthetic: 'артикаин 4%', vasoconstrictor: 'адреналин 1:200000', volume_ml: 1.7 } },
  { name: 'Lidocaine 2%', brand: 'EGIS', categoryQuery: 'Анестезия', avgPrice: 300, unit: 'ампула', manufacturer: 'Венгрия', description: 'Лидокаин 2% для местной анестезии. Ампула 2 мл.', specs: { anesthetic: 'лидокаин 2%', volume_ml: 2, quantity_per_pack: 10 } },
  // ─── X-Ray / Diagnostics ───
  { name: 'Kodak RVG 6100', brand: 'Carestream', categoryQuery: 'Диагностика', avgPrice: 1500000, unit: 'шт', manufacturer: 'США', description: 'Радиовизиограф с сенсором размера 2. Высокое разрешение.', specs: { type: 'радиовизиограф', sensor_size: 2, resolution_dpi: 1600, interface: 'USB 3.0', software: 'CS Imaging' } },
  { name: 'VistaScan Mini+', brand: 'Dürr Dental', categoryQuery: 'Диагностика', avgPrice: 1200000, unit: 'шт', manufacturer: 'Германия', description: 'Компактный сканер для phosphor-пластин. Сканирование до 8 пластин/час.', specs: { type: 'сканер', plates_per_hour: 8, plate_sizes: ['0', '1', '2', '3'], resolution_micron: 10 } },
  { name: 'Retrackers Dental Set', brand: 'Hu-Friedy', categoryQuery: 'Диагностика', avgPrice: 7000, unit: 'набор', manufacturer: 'США', description: 'Набор ретракторов для внутриротовой съемки. 3 шт.', specs: { type: 'ретракторы', quantity: 3, material: 'пластик', sterilization: true, application: 'фото/рентген' } },
];

export async function seedProductPresets() {
  const count = await prisma.productPreset.count();
  if (count > 0) {
    console.log(`[seed] ProductPresets already seeded (${count} items), skipping`);
    return { skipped: true, count };
  }

  const created = [];
  for (const preset of PRODUCT_PRESETS) {
    // Find matching category by name (case-insensitive)
    const category = await prisma.shopCategory.findFirst({
      where: { name: { contains: preset.categoryQuery, mode: 'insensitive' } },
    });

    const record = await prisma.productPreset.create({
      data: {
        id: uid(),
        name: preset.name,
        brand: preset.brand,
        categoryId: category?.id || null,
        description: preset.description,
        avgPrice: preset.avgPrice,
        unit: preset.unit,
        manufacturer: preset.manufacturer,
        specs: preset.specs || null,
        tags: [preset.categoryQuery],
        sortOrder: 0,
      },
    });
    created.push(record);
  }

  console.log(`[seed] Seeded ${created.length} ProductPresets`);
  return { created: created.length };
}
