import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Megaphone, Sparkles, Copy, RefreshCw, TrendingDown, Tag, Stethoscope, Info } from 'lucide-react'
import { Button } from '@/components/ui/ds/Button'
import { Card } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Select } from '@/components/ui/ds/Input'
import { Skeleton, ListSkeleton } from '@/components/ui/ds/Skeleton'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader, StatCard } from '@/components/ui/ds/StatCard'
import { useToast } from '@/components/ui/ds/Toast'
import { queryKeys } from '@/queries/keys'
import * as api from '@/utils/api'
import type { ContentIdea, ContentPlan } from '@/utils/api'
import type { Clinic, User, RoleInfo } from '@/types'

const FORMAT_LABEL: Record<ContentIdea['format'], string> = {
  post: 'Пост',
  reels: 'Reels',
  story: 'Сторис',
  carousel: 'Карусель',
}

const TONES = [
  { value: 'спокойная, профессиональная, без давления', label: 'Спокойная и профессиональная' },
  { value: 'тёплая и человечная, от первого лица', label: 'Тёплая, от первого лица' },
  { value: 'короткая и энергичная, без воды', label: 'Короткая и энергичная' },
  { value: 'экспертная, с опорой на цифры', label: 'Экспертная, с цифрами' },
]

/**
 * Контент и продвижение.
 *
 * Идеи строятся на данных, которые в системе уже есть: что в клинике реально
 * делают, по каким ценам, какие акции идут, в каком месяце проседает запись.
 * Каждая идея показывает, на какой факт она опирается — без этого её нельзя
 * отличить от текста, который подошёл бы любой клинике.
 */
export default function Marketing() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const { showToast } = useToast()
  const [count, setCount] = useState('6')
  const [tone, setTone] = useState(TONES[0].value)
  const [plan, setPlan] = useState<ContentPlan | null>(null)

  const contextQ = useQuery({
    queryKey: [...queryKeys.marketing, 'context', clinic?.id ?? ''],
    queryFn: () => api.getMarketingContext(),
    enabled: !!clinic?.id,
  })

  const planMutation = useMutation({
    mutationFn: () => api.generateContentPlan(Number(count), tone),
    onSuccess: (res) => {
      setPlan(res)
      showToast(
        res.deterministic
          ? 'План собран из данных клиники, без модели'
          : `Готово: ${res.ideas.length} идей`,
        res.deterministic ? 'info' : 'success',
      )
    },
    onError: (e: Error) => showToast(e.message || 'Не удалось собрать план', 'error'),
  })

  const ctx = contextQ.data

  const copyIdea = async (idea: ContentIdea) => {
    const text = [idea.hook, '', idea.caption, '', idea.hashtags.join(' '), '', idea.callToAction].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      showToast('Текст скопирован', 'success')
    } catch {
      showToast('Браузер не дал доступ к буферу обмена', 'warning')
    }
  }

  return (
    <div className="dv-page py-4 md:py-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Контент и продвижение"
        subtitle={`${clinic?.name} · идеи на данных вашей клиники`}
        icon={<Megaphone size={20} />}
      />

      {/* ── На чём строится контент ── */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-txt-primary mb-2">На чём строятся идеи</h2>
        {contextQ.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : !ctx ? (
          <Card padding="md">
            <p className="text-sm text-txt-muted m-0">Не удалось собрать данные клиники.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <StatCard label="Приёмов за полгода" value={ctx.appointmentsAnalysed} icon={<Info size={18} />} />
              <StatCard label="Услуг в работе" value={ctx.topServices.length} icon={<Sparkles size={18} />} />
              <StatCard label="Действующих акций" value={ctx.activePromotions.length} icon={<Tag size={18} />} />
              <StatCard label="Врачей" value={ctx.doctorCount} icon={<Stethoscope size={18} />} />
            </div>

            <Card padding="md">
              <div className="space-y-2 text-sm">
                {ctx.topServices.length > 0 && (
                  <p className="m-0 text-txt-secondary">
                    <span className="text-txt-muted">Чаще всего делают: </span>
                    {ctx.topServices.slice(0, 4).map((s) => `${s.name} (${s.count})`).join(', ')}
                  </p>
                )}
                {ctx.quietestMonth && (
                  <p className="m-0 text-txt-secondary flex items-center gap-1.5">
                    <TrendingDown size={14} className="text-warning shrink-0" />
                    <span>
                      <span className="text-txt-muted">Спад записи: </span>
                      {ctx.quietestMonth.month} ({ctx.quietestMonth.appointments} приёмов)
                    </span>
                  </p>
                )}
                {ctx.neglectedServices.length > 0 && (
                  <p className="m-0 text-txt-secondary">
                    <span className="text-txt-muted">В прайсе есть, но не делают: </span>
                    {ctx.neglectedServices.slice(0, 4).join(', ')}
                  </p>
                )}
                {ctx.frequentDiagnoses.length > 0 && (
                  <p className="m-0 text-txt-secondary">
                    <span className="text-txt-muted">Частые диагнозы: </span>
                    {ctx.frequentDiagnoses.map((d) => `${d.code} (${d.count})`).join(', ')}
                  </p>
                )}
                {ctx.appointmentsAnalysed === 0 && (
                  <p className="m-0 text-txt-muted">
                    Закрытых приёмов за полгода пока нет — идеи будут опираться на прайс и акции.
                  </p>
                )}
              </div>
            </Card>
          </>
        )}
      </section>

      {/* ── Генерация ── */}
      <Card padding="md" className="mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-full sm:w-56">
            <Select
              label="Тональность"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              options={TONES}
              className="min-h-11"
            />
          </div>
          <div className="w-full sm:w-36">
            <Select
              label="Сколько идей"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              options={['3', '6', '9', '12'].map((v) => ({ value: v, label: v }))}
              className="min-h-11"
            />
          </div>
          <Button
            className="min-h-11"
            icon={plan ? <RefreshCw size={16} /> : <Sparkles size={16} />}
            loading={planMutation.isPending}
            onClick={() => planMutation.mutate()}
          >
            {plan ? 'Собрать заново' : 'Собрать контент-план'}
          </Button>
        </div>
      </Card>

      {/* ── План ── */}
      {planMutation.isPending ? (
        <ListSkeleton count={4} />
      ) : !plan ? (
        <EmptyState
          icon={<Megaphone size={28} />}
          title="Плана пока нет"
          description="Соберите контент-план — идеи возьмутся из услуг, цен, акций и загрузки вашей клиники."
        />
      ) : (
        <div className="space-y-3">
          {plan.deterministic && (
            <div className="rounded-xl border border-bdr-subtle bg-surface-1 px-4 py-3">
              <p className="text-sm text-txt-secondary m-0">
                План собран без языковой модели — только из фактов клиники. Формулировки суше,
                но ничего не выдумано.
              </p>
            </div>
          )}

          {plan.ideas.map((idea, i) => (
            <Card key={`${idea.title}-${i}`} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-txt-primary m-0">{idea.title}</h3>
                    <Badge variant="info" size="sm">{FORMAT_LABEL[idea.format] || idea.format}</Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  icon={<Copy size={14} />}
                  onClick={() => copyIdea(idea)}
                >
                  Копировать
                </Button>
              </div>

              <p className="text-sm font-semibold text-dv-gold m-0 mb-2">{idea.hook}</p>
              <p className="text-sm text-txt-secondary whitespace-pre-wrap m-0 mb-3">{idea.caption}</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {idea.hashtags.map((h) => (
                  <span key={h} className="text-2xs text-txt-muted">{h.startsWith('#') ? h : `#${h}`}</span>
                ))}
              </div>

              <div className="rounded-lg bg-surface-1 border border-bdr-subtle p-3 space-y-1">
                <p className="text-2xs text-txt-muted m-0">
                  <span className="font-bold">Призыв: </span>{idea.callToAction}
                </p>
                {/* Главное поле карточки: без него идея неотличима от текста,
                    который подошёл бы любой клинике. */}
                <p className="text-2xs text-txt-muted m-0">
                  <span className="font-bold">Опирается на: </span>{idea.basedOn}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
