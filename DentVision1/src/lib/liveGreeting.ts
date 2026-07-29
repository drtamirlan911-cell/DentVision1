import * as api from '@/utils/api'
import { detectUserTimeZone, timeGreetingInTz } from '@/lib/clinic-timezone'

export type LiveGreetingResult = {
  reply: string
  suggestions: string[]
  stats: {
    apptsToday: number
    pendingConfirm: number
    upcomingSoon: number
    unpaid: number
    lowStock: number
  }
}

function isLowStock(item: { quantity?: number; minQuantity?: number; min?: number; minimum?: number }) {
  const min = Number(item.minQuantity ?? item.min ?? item.minimum ?? 0) || 0
  return min > 0 && Number(item.quantity ?? 0) <= min
}

function startOfLocalDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfLocalDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function apptTime(a: { date?: string | Date; startTime?: string; time?: string }): Date | null {
  if (a.date) {
    const d = new Date(a.date)
    if (!Number.isNaN(d.getTime())) return d
  }
  const t = a.startTime || a.time
  if (t && /^\d{1,2}:\d{2}/.test(String(t))) {
    const [hh, mm] = String(t).split(':').map(Number)
    const d = new Date()
    d.setHours(hh || 0, mm || 0, 0, 0)
    return d
  }
  return null
}

/** True when greeting is the static role fluff (no live CRM numbers). */
export function isStaticRadarGreeting(content: string): boolean {
  return /На радаре:\s*(подтверждения записей|выручка, долги|остатки склада|ваше расписание)/i.test(content)
    && !/\*\*\d+\*\*/.test(content)
}

/**
 * Build a Jarvis-style greeting from live CRM APIs when /api/ai/briefing is unavailable.
 */
export async function buildLiveClinicGreeting(opts: {
  user: any
  clinic: any
  proactiveAlerts?: Array<{ text?: string; message?: string }>
}): Promise<LiveGreetingResult> {
  const user = opts.user
  const clinic = opts.clinic
  const clinicId = clinic?.id || user?.clinicId || ''
  const role = String(user?.role || '').toLowerCase()
  const name = user?.name?.split(' ')[0] || user?.firstName || user?.login || 'коллега'
  const tz = detectUserTimeZone()
  const greet = timeGreetingInTz(new Date(), tz)
  const clinicName = clinic?.name || ''

  const empty = {
    apptsToday: 0,
    pendingConfirm: 0,
    upcomingSoon: 0,
    unpaid: 0,
    lowStock: 0,
  }

  if (!clinicId) {
    return {
      reply: [
        `${greet}, ${name}. Системы на связи.`,
        'Клиника не выбрана — переключите контекст в профиле.',
        '',
        'С чего начнём?',
      ].join('\n'),
      suggestions: ['Открыть профиль', 'Показать расписание'],
      stats: empty,
    }
  }

  const dayStart = startOfLocalDay()
  const dayEnd = endOfLocalDay()
  const in2h = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const now = new Date()

  const [appointments, receipts, inventory] = await Promise.all([
    api.getAppointments(clinicId).catch(() => []),
    api.getReceipts(clinicId).catch(() => []),
    api.getInventory(clinicId).catch(() => []),
  ])

  const apptsToday = appointments.filter((a) => {
    const t = apptTime(a as any)
    return t && t >= dayStart && t <= dayEnd && !['CANCELLED', 'NO_SHOW', 'cancelled'].includes(String(a.status || ''))
  })
  const pendingConfirm = apptsToday.filter((a) => {
    const s = String(a.status || '').toUpperCase()
    return s === 'PENDING' || s === 'ОЖИДАНИЕ'
  }).length
  const upcomingSoon = appointments.filter((a) => {
    const t = apptTime(a as any)
    const s = String(a.status || '').toUpperCase()
    return t && t >= now && t <= in2h && (s === 'CONFIRMED' || s === 'PENDING' || s === 'ПОДТВЕРЖДЕНО' || s === 'ОЖИДАНИЕ')
  }).length
  const unpaid = receipts.filter((r) => {
    const s = String((r as any).status || '').toLowerCase()
    return s === 'unpaid' || s === 'partial' || s === 'overdue' || s === 'pending' || s === 'неоплачен'
  }).length
  const lowStock = inventory.filter((i) => isLowStock(i)).length

  const lines: string[] = [
    `${greet}, ${name}. Системы на связи.`,
    clinicName ? `**${clinicName}**` : '',
    '',
  ]

  const suggestions: string[] = []

  if (role === 'owner' || role === 'директор' || role === 'руководитель' || role === 'director' || role === 'manager') {
    lines.push(`• Записей сегодня: **${apptsToday.length}**`)
    if (upcomingSoon > 0) lines.push(`• В ближайшие 2 часа: **${upcomingSoon}**`)
    if (pendingConfirm > 0) lines.push(`• Ждут подтверждения: **${pendingConfirm}**`)
    lines.push(unpaid > 0 ? `• Неоплаченных счетов: **${unpaid}**` : '• Касса: просрочек в выборке нет')
    if (lowStock > 0) lines.push(`• Склад клиники: **${lowStock}** ниже минимума — можно подобрать в маркете`)
    suggestions.push(
      unpaid > 0 ? 'Проверить долги' : 'Показать выручку',
      'Показать расписание',
      lowStock > 0 ? 'Открыть маркетплейс' : 'Что важно сегодня?',
    )
  } else if (role === 'admin' || role === 'администратор' || role === 'reception') {
    lines.push(`• Записей сегодня: **${apptsToday.length}**`)
    if (pendingConfirm > 0) {
      lines.push(`• ⚠ Неподтверждённых: **${pendingConfirm}** — лучше закрыть до обеда`)
      suggestions.push('Показать расписание')
    } else {
      lines.push('• Все записи на сегодня подтверждены — порядок')
      suggestions.push('Записать пациента')
    }
    if (upcomingSoon > 0) lines.push(`• Через ≤2 часа: **${upcomingSoon}** приёмов`)
    if (unpaid > 0) lines.push(`• Касса: **${unpaid}** неоплаченных`)
    if (lowStock > 0) lines.push(`• Склад клиники заканчивается (**${lowStock}**) — подберём в маркете`)
    suggestions.push('Открыть кассу', lowStock > 0 ? 'Открыть маркетплейс' : 'Показать расписание')
  } else if (role === 'buyer') {
    lines.push(lowStock > 0
      ? `• Склад клиники: **${lowStock}** ниже минимума — откройте маркет`
      : '• Склад в норме — критичных остатков нет')
    suggestions.push('Что на складе', 'Открыть маркетплейс')
  } else {
    lines.push(`• Записей сегодня: **${apptsToday.length}**`)
    if (upcomingSoon > 0) lines.push(`• Ближайшие 2 часа: **${upcomingSoon}**`)
    suggestions.push('Показать расписание', 'Открыть зубную карту')
  }

  // Extra proactive lines not already covered (e.g. unread notifications).
  const covered = new Set(lines.map((l) => l.toLowerCase()))
  for (const a of (opts.proactiveAlerts || []).slice(0, 3)) {
    const text = String(a.text || a.message || '').trim()
    if (!text) continue
    const key = text.toLowerCase()
    if ([...covered].some((c) => c.includes(key.slice(0, 18)) || key.includes('склад') && c.includes('склад'))) {
      continue
    }
    if (/непрочитан/i.test(text) || /подписк/i.test(text) || /academy|курс/i.test(text)) {
      lines.push(`• ${text}`)
    }
  }

  lines.push('')
  lines.push(
    pendingConfirm > 0 || unpaid > 0 || lowStock > 0
      ? 'Уже нашёл точки внимания в CRM — можно сразу открыть раздел ниже.'
      : 'Готов выполнить команду. С чего начнём?',
  )

  return {
    reply: lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n'),
    suggestions: [...new Set(suggestions)].slice(0, 3),
    stats: {
      apptsToday: apptsToday.length,
      pendingConfirm,
      upcomingSoon,
      unpaid,
      lowStock,
    },
  }
}
