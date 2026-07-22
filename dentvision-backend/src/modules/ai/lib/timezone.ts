/** Clinic-aware wall-clock helpers (default Asia/Almaty for KZ). */

export const DEFAULT_CLINIC_TZ = 'Asia/Almaty';

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset of `timeZone` at `date`: wallClockAsUTC - instant. */
function timezoneOffsetMs(timeZone: string, date: Date): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. */
export function zonedLocalToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  // First guess: treat wall time as UTC, then subtract the zone offset.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  utcMs -= timezoneOffsetMs(timeZone, new Date(utcMs));
  // Second pass handles DST edges.
  utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  utcMs -= timezoneOffsetMs(timeZone, new Date(utcMs));
  return new Date(utcMs);
}

export function hourInTimeZone(date = new Date(), timeZone = DEFAULT_CLINIC_TZ): number {
  return zonedParts(date, timeZone).hour;
}

export function timeGreetingInTz(date = new Date(), timeZone = DEFAULT_CLINIC_TZ): string {
  const h = hourInTimeZone(date, timeZone);
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function formatDateInTz(
  date = new Date(),
  timeZone = DEFAULT_CLINIC_TZ,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' },
): string {
  return date.toLocaleDateString('ru-RU', { ...options, timeZone });
}

/** Inclusive calendar day bounds in `timeZone`, returned as UTC instants. */
export function zonedDayRange(timeZone = DEFAULT_CLINIC_TZ, now = new Date()): {
  start: Date;
  end: Date;
  dateLabel: string;
} {
  const p = zonedParts(now, timeZone);
  const start = zonedLocalToUtc(timeZone, p.year, p.month, p.day, 0, 0, 0);
  const end = zonedLocalToUtc(timeZone, p.year, p.month, p.day, 23, 59, 59);
  // include last ms of the second
  end.setMilliseconds(999);
  return {
    start,
    end,
    dateLabel: formatDateInTz(now, timeZone),
  };
}

export function resolveClinicTimeZone(raw?: string | null): string {
  const tz = String(raw || '').trim();
  if (!tz) return DEFAULT_CLINIC_TZ;
  try {
    // Throws RangeError for invalid IANA zones in modern Node.
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_CLINIC_TZ;
  }
}
