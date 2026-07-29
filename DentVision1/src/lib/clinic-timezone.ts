/** Client wall-clock helpers — prefer the user's browser timezone. */

export const DEFAULT_CLINIC_TZ = 'Asia/Almaty'

export function isValidTimeZone(raw?: string | null): boolean {
  const tz = String(raw || '').trim()
  if (!tz) return false
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}

/** IANA zone from the user's device/browser (e.g. Asia/Almaty, Europe/Moscow). */
export function detectUserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (isValidTimeZone(tz)) return tz
  } catch {
    /* ignore */
  }
  return DEFAULT_CLINIC_TZ
}

/** First valid zone wins: user → clinic → default. */
export function resolveTimeZone(...candidates: Array<string | null | undefined>): string {
  for (const raw of candidates) {
    const tz = String(raw || '').trim()
    if (tz && isValidTimeZone(tz)) return tz
  }
  return detectUserTimeZone()
}

/** @deprecated use resolveTimeZone / detectUserTimeZone */
export function resolveClinicTimeZone(raw?: string | null): string {
  return resolveTimeZone(raw, detectUserTimeZone())
}

export function hourInTimeZone(date = new Date(), timeZone = detectUserTimeZone()): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  })
  const hour = dtf.formatToParts(date).find((p) => p.type === 'hour')?.value
  return Number(hour || 0)
}

export function timeGreetingInTz(date = new Date(), timeZone = detectUserTimeZone()): string {
  const h = hourInTimeZone(date, timeZone)
  if (h < 6) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}
