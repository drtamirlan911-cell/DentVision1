/** Client-side clinic wall-clock helpers (default Asia/Almaty). */

export const DEFAULT_CLINIC_TZ = 'Asia/Almaty'

export function resolveClinicTimeZone(raw?: string | null): string {
  const tz = String(raw || '').trim()
  if (!tz) return DEFAULT_CLINIC_TZ
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return tz
  } catch {
    return DEFAULT_CLINIC_TZ
  }
}

export function hourInTimeZone(date = new Date(), timeZone = DEFAULT_CLINIC_TZ): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  })
  const hour = dtf.formatToParts(date).find((p) => p.type === 'hour')?.value
  return Number(hour || 0)
}

export function timeGreetingInTz(date = new Date(), timeZone = DEFAULT_CLINIC_TZ): string {
  const h = hourInTimeZone(date, timeZone)
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
