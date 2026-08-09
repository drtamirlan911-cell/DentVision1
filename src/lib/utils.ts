import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { detectUserTimeZone, timeGreetingInTz } from '@/lib/clinic-timezone'
import i18n from '@/lib/i18n';

const t = (key: string, fallback: string) => {
  try { const v = i18n.t(key); return v && v !== key ? v : fallback; } catch { return fallback; }
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * An accent chosen by data (a clinic's own colour, a difficulty band) with the
 * brand token as the fallback, rendered as coloured text on a tint of itself.
 *
 * Inline is right here — the colour is a value, not a design decision — but the
 * fallback still has to be the theme token rather than a frozen hex. The tint
 * is mixed rather than built by string-concatenating an alpha suffix, which is
 * what the call sites used to do: appending `'22'` to `var(--dv-gold)` produces
 * invalid CSS and the whole declaration is dropped.
 */
export function tintedAccent(colour: string | null | undefined, tintPercent = 13) {
  const accent = colour || 'var(--dv-gold)'
  return {
    background: `color-mix(in srgb, ${accent} ${tintPercent}%, transparent)`,
    color: accent,
  }
}

export function formatMoney(amount: number, currency = '₸'): string {
  return new Intl.NumberFormat('ru-KZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + ' ' + currency
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getInitials(name: string): string {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getGreeting(timeZone?: string | null): string {
  // Prefer the user's device timezone (auto from browser).
  return timeGreetingInTz(new Date(), timeZone || detectUserTimeZone())
}

export function timeAgo(date: string | Date): string {
  const d = new Date(date).getTime()
  const diff = Math.max(0, Date.now() - d)
  const min = Math.floor(diff / 60000)
  if (min < 1) return t('timeAgo.just_now', 'только что')
  if (min < 60) return `${min} ${t('timeAgo.min_ago', 'мин назад')}`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} ${t('timeAgo.hour_ago', 'ч назад')}`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ${t('timeAgo.day_ago', 'дн назад')}`
  return formatDate(date)
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
  debounced.cancel = () => clearTimeout(timer)
  return debounced as T & { cancel: () => void }
}
