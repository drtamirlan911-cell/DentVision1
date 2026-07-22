import { getJobs } from '@/utils/api'
import type { AIChatResponse } from '@/utils/api'

/** Detect vacancy / jobs search intents that should not depend on paid AI. */
export function parseJobsSearchQuery(text: string): { q: string } | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  const isJobs =
    /ваканс/i.test(lower) ||
    /найд[иь].{0,24}(ортодонт|терапевт|хирург|гигиенист|ассистент|врач|сотрудник)/i.test(lower) ||
    /ищ(у|ем).{0,24}(ортодонт|терапевт|хирург|гигиенист|ассистент|врач)/i.test(lower) ||
    /jobs?\b/i.test(lower)

  if (!isJobs) return null

  // Prefer specialty / role keywords after "вакансии|найди|ищем"
  let q = ''
  const m =
    raw.match(/ваканси[яи]\s+(.+)$/i) ||
    raw.match(/найд[иь]\s+(?:ваканси[яи]\s+)?(.+)$/i) ||
    raw.match(/ищ(?:у|ем)\s+(.+)$/i) ||
    raw.match(/поиск\s+(?:ваканси[яй]\s+)?(.+)$/i)

  if (m?.[1]) {
    q = m[1]
      .replace(/^(ваканси[яи]|для|по|на)\s+/i, '')
      .replace(/[?.!]+$/g, '')
      .trim()
  }

  // Fallback: extract known specialties from free text
  if (!q) {
    const specs = ['ортодонт', 'терапевт', 'хирург', 'гигиенист', 'ассистент', 'имплантолог', 'пародонтолог']
    q = specs.find((s) => lower.includes(s)) || ''
  }

  return { q }
}

export async function answerJobsSearchQuery(text: string): Promise<AIChatResponse | null> {
  const parsed = parseJobsSearchQuery(text)
  if (!parsed) return null

  const list = await getJobs({ q: parsed.q || '' }).catch(() => [])
  const jobs = Array.isArray(list) ? list : []
  const path = parsed.q ? `/jobs?q=${encodeURIComponent(parsed.q)}` : '/jobs'

  if (!jobs.length) {
    return {
      reply: parsed.q
        ? `По запросу «${parsed.q}» открытых вакансий пока нет. Могу открыть раздел Вакансии — там можно расширить поиск или разместить объявление.`
        : 'Сейчас нет открытых вакансий. Откройте раздел Вакансии, чтобы разместить объявление или обновить поиск.',
      skill: 'jobs',
      source: 'jobs',
      actions: [{
        type: 'OpenJobs',
        label: 'Открыть вакансии',
        confidence: 1,
        params: { path },
        requiresConfirmation: false,
      }],
      suggestions: ['Открыть вакансии', 'Разместить вакансию', 'Показать расписание'],
      proactive: [],
      conversationContext: { turnCount: 0, entities: { jobsQuery: parsed.q } },
    }
  }

  const lines = jobs.slice(0, 5).map((j: any, i: number) => {
    const title = j.title || 'Вакансия'
    const clinic = j.clinicName ? ` · ${j.clinicName}` : ''
    const city = j.city ? ` · ${j.city}` : ''
    const salary = j.salary ? ` — ${j.salary}` : ''
    return `${i + 1}. **${title}**${clinic}${city}${salary}`
  })

  const more = jobs.length > 5 ? `\n…и ещё ${jobs.length - 5}` : ''

  return {
    reply: [
      parsed.q
        ? `Нашёл **${jobs.length}** ваканси${jobs.length === 1 ? 'ю' : jobs.length < 5 ? 'и' : 'й'} по запросу «${parsed.q}»:`
        : `Сейчас открыто **${jobs.length}** ваканси${jobs.length === 1 ? 'я' : jobs.length < 5 ? 'и' : 'й'}:`,
      '',
      ...lines,
      more,
      '',
      'Могу открыть раздел Вакансии для деталей и отклика.',
    ].filter(Boolean).join('\n'),
    skill: 'jobs',
    source: 'jobs',
    data: { jobs: jobs.slice(0, 10), query: parsed.q },
    actions: [{
      type: 'OpenJobs',
      label: 'Открыть вакансии',
      confidence: 1,
      params: { path },
      requiresConfirmation: false,
    }],
    suggestions: ['Открыть вакансии', 'Показать расписание', 'Открыть кассу'],
    proactive: [],
    conversationContext: { turnCount: 0, entities: { jobsQuery: parsed.q } },
  }
}
