/** Kazakhstan city helpers for shop/jobs APIs (mirrors frontend catalog). */

export const KZ_CITIES = [
  'Абай', 'Аксай', 'Актау', 'Актобе', 'Алматы', 'Алтай', 'Аральск', 'Аркалык',
  'Астана', 'Атырау', 'Аягоз', 'Байконур', 'Балхаш', 'Жанаозен', 'Жаркент',
  'Жезказган', 'Жетысай', 'Караганда', 'Каскелен', 'Кентау', 'Кокшетау',
  'Конаев', 'Костанай', 'Кульсары', 'Кызылорда', 'Лисаковск', 'Павлодар',
  'Петропавловск', 'Риддер', 'Рудный', 'Сарань', 'Сарыагаш', 'Сатпаев',
  'Семей', 'Степногорск', 'Талдыкорган', 'Тараз', 'Текели', 'Темиртау',
  'Туркестан', 'Уральск', 'Усть-Каменогорск', 'Форт-Шевченко', 'Шахтинск',
  'Шымкент', 'Щучинск', 'Экибастуз',
] as const;

export function inferKzCity(raw?: string | null): string | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const city of KZ_CITIES) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  const first = text.split(',')[0]?.trim();
  if (first && (KZ_CITIES as readonly string[]).includes(first)) return first;
  return null;
}

export function resolveSupplierCity(supplier: {
  city?: string | null;
  legalAddress?: string | null;
}): string | null {
  if (supplier.city && String(supplier.city).trim()) return String(supplier.city).trim();
  return inferKzCity(supplier.legalAddress);
}
