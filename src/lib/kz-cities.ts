/**
 * Kazakhstan cities — shared catalog for Marketplace + Jobs filters/forms.
 * Includes republican cities, regional centers, and major towns.
 */

export const KZ_POPULAR_CITIES = [
  'Алматы',
  'Астана',
  'Шымкент',
  'Караганда',
  'Актобе',
  'Тараз',
  'Павлодар',
  'Усть-Каменогорск',
  'Семей',
  'Атырау',
  'Костанай',
  'Кызылорда',
  'Уральск',
  'Петропавловск',
  'Актау',
  'Туркестан',
  'Кокшетау',
  'Талдыкорган',
] as const

/** Full catalog used in selects (sorted RU locale). */
export const KZ_CITIES = [
  'Абай',
  'Аксай',
  'Актау',
  'Актобе',
  'Алматы',
  'Алтай',
  'Аральск',
  'Аркалык',
  'Астана',
  'Атырау',
  'Аягоз',
  'Байконур',
  'Балхаш',
  'Жанаозен',
  'Жаркент',
  'Жезказган',
  'Жетысай',
  'Караганда',
  'Каскелен',
  'Кентау',
  'Кокшетау',
  'Конаев',
  'Костанай',
  'Кульсары',
  'Кызылорда',
  'Лисаковск',
  'Павлодар',
  'Петропавловск',
  'Риддер',
  'Рудный',
  'Сарань',
  'Сарыагаш',
  'Сатпаев',
  'Семей',
  'Степногорск',
  'Талдыкорган',
  'Тараз',
  'Текели',
  'Темиртау',
  'Туркестан',
  'Уральск',
  'Усть-Каменогорск',
  'Форт-Шевченко',
  'Шахтинск',
  'Шымкент',
  'Щучинск',
  'Экибастуз',
] as const

export type KzCity = (typeof KZ_CITIES)[number]

export const KZ_CITY_OPTIONS = [
  { value: '', label: 'Все города Казахстана' },
  ...KZ_CITIES.map((c) => ({ value: c, label: c })),
]

export const KZ_CITY_FORM_OPTIONS = [
  { value: '', label: 'Выберите город' },
  ...KZ_CITIES.map((c) => ({ value: c, label: c })),
]

/** Infer city from free-text address / legacy fields. */
export function inferKzCity(raw?: string | null): string | null {
  const text = String(raw || '').trim()
  if (!text) return null
  const lower = text.toLowerCase()
  for (const city of KZ_CITIES) {
    if (lower.includes(city.toLowerCase())) return city
  }
  // First comma segment often is the city in legal addresses
  const first = text.split(',')[0]?.trim()
  if (first && (KZ_CITIES as readonly string[]).includes(first)) return first
  return null
}

export function isKzCity(value?: string | null): value is KzCity {
  return !!value && (KZ_CITIES as readonly string[]).includes(value)
}
