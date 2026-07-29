import prisma from '../../../lib/prisma.js';
import { mergeClinicSettings } from '../../clinics/clinicSettings.js';

const SYMBOL_BY_CODE: Record<string, string> = {
  KZT: '₸',
  RUB: '₽',
  USD: '$',
  EUR: '€',
  KGS: 'сом',
  UZS: "so'm",
  TJS: 'смн',
  AZN: '₼',
  AMD: '֏',
  BYN: 'Br',
  MDL: 'L',
};

const NAME_BY_CODE: Record<string, string> = {
  KZT: 'тенге',
  RUB: 'рублях',
  USD: 'долларах',
  EUR: 'евро',
  KGS: 'сомах',
  UZS: 'сумах',
  TJS: 'сомони',
  AZN: 'манатах',
  AMD: 'драмах',
  BYN: 'белорусских рублях',
  MDL: 'леях',
};

const LOCALE_BY_CODE: Record<string, string> = {
  KZT: 'ru-KZ',
  RUB: 'ru-RU',
  USD: 'en-US',
  EUR: 'de-DE',
  KGS: 'ru-KG',
  UZS: 'uz-UZ',
  TJS: 'ru-RU',
  AZN: 'az-AZ',
  AMD: 'hy-AM',
  BYN: 'ru-BY',
  MDL: 'ro-MD',
};

export function normalizeCurrencyCode(raw?: string | null): string {
  const code = String(raw || 'KZT').trim().toUpperCase();
  return SYMBOL_BY_CODE[code] ? code : 'KZT';
}

export function currencySymbol(code?: string | null): string {
  return SYMBOL_BY_CODE[normalizeCurrencyCode(code)] || '₸';
}

export function currencyDisplayName(code?: string | null): string {
  return NAME_BY_CODE[normalizeCurrencyCode(code)] || 'тенге';
}

export async function resolveClinicCurrency(clinicId?: string | null): Promise<string> {
  if (!clinicId) return 'KZT';
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { settings: true },
    });
    const settings = mergeClinicSettings(clinic?.settings);
    return normalizeCurrencyCode(settings.currency);
  } catch {
    return 'KZT';
  }
}

/** Format major units for AI copy (clinic invoices store major currency units). */
export function formatClinicMoney(amount: number, currencyCode?: string | null): string {
  const code = normalizeCurrencyCode(currencyCode);
  const locale = LOCALE_BY_CODE[code] || 'ru-RU';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `${Math.round(Number(amount) || 0).toLocaleString('ru-RU')} ${currencySymbol(code)}`;
  }
}

/**
 * Soft-correct LLM currency slips to the clinic's configured currency.
 * Does not convert amounts — only replaces currency markers.
 */
export function preferClinicCurrency(text: string, currencyCode?: string | null): string {
  if (!text) return text;
  const code = normalizeCurrencyCode(currencyCode);
  const symbol = currencySymbol(code);
  const name = currencyDisplayName(code);
  const amount = String.raw`(\d+(?:[\s.,]\d+)*(?:[KkКкMmМм])?)`;

  let out = text
    .replace(new RegExp(`${amount}\\s*[₸₽$€]`, 'g'), `$1 ${symbol}`)
    .replace(new RegExp(`${amount}\\s*(?:KZT|RUB|USD|EUR|KGS|UZS)\\b`, 'gi'), `$1 ${symbol}`)
    // Avoid \\b with Cyrillic — JS word boundaries are ASCII-only.
    .replace(new RegExp(`${amount}\\s*руб(?:л(?:ей|я|ь))?\\.?`, 'gi'), `$1 ${symbol}`)
    .replace(new RegExp(`${amount}\\s*тенге\\.?`, 'gi'), `$1 ${symbol}`)
    .replace(/в рублях/gi, `в ${name}`)
    .replace(/в тенге/gi, `в ${name}`);

  if (code !== 'RUB') {
    out = out.replace(/рубл(?:ей|я|ь)/gi, name === 'рублях' ? 'рублей' : name);
  }
  if (code !== 'KZT') {
    out = out.replace(/\bтенге\b/gi, name === 'тенге' ? 'тенге' : name);
  }
  return out;
}

/** @deprecated use preferClinicCurrency */
export function preferTengeCurrency(text: string): string {
  return preferClinicCurrency(text, 'KZT');
}

export function clinicCurrencyPromptRule(currencyCode?: string | null): string {
  const code = normalizeCurrencyCode(currencyCode);
  const symbol = currencySymbol(code);
  const name = currencyDisplayName(code);
  return `Валюта этой клиники — ${code} (символ ${symbol}, ${name}). Все суммы пиши только в этой валюте. Не подставляй другую валюту (тенге/рубли/доллары), если она не выбрана в настройках клиники.`;
}
