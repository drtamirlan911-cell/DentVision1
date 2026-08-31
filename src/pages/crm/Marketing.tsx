import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Megaphone, Sparkles, RefreshCw, TrendingDown, Tag, Stethoscope, Info, Trash2, History,
} from 'lucide-react'
import { Button } from '@/components/ui/ds/Button'
import { Card } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Select } from '@/components/ui/ds/Input'
import { Skeleton, ListSkeleton } from '@/components/ui/ds/Skeleton'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader, StatCard } from '@/components/ui/ds/StatCard'
import { ConfirmModal } from '@/components/ui/ds/Modal'
import { useToast } from '@/components/ui/ds/Toast'
import { ContentIdeaCard } from '@/components/crm/ContentIdeaCard'
import { queryKeys } from '@/queries/keys'
import { cn } from '@/lib/utils'
import * as api from '@/utils/api'
import type { StoredIdea, StoredPlan, PlanSummary } from '@/utils/api'
import type { Clinic, User, RoleInfo } from '@/types'

const TONES = [
  { value: 'спокойная, профессиональная, без давления', label: 'Спокойная и профессиональная' },
  { value: 'тёплая и человечная, от первого лица', label: 'Тёплая, от первого лица' },
  { value: 'короткая и энергичная, без воды', label: 'Короткая и энергичная' },
  { value: 'экспертная, с опорой на цифры', label: 'Экспертная, с цифрами' },
]

/**
 * Контент и продвижение.
 *
 * Идеи строятся на данных, которые в системе уже есть, и каждая показывает,
 * на какой факт опирается. Планы сохраняются: до этого работа исчезала вместе
 * с вкладкой.
 */
export default function Marketing() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [count, setCount] = useState('6')
  const [tone, setTone] = useState(TONES[0].value)
  const [openPlanId, setOpenPlanId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<PlanSummary | null>(null)
  const [busyIdeaId, setBusyIdeaId] = useState<string | null>(null)

  const contextQ = useQuery({
    queryKey: [...queryKeys.marketing, 'context', clinic?.id ?? ''],
    queryFn: () => api.getMarketingContext(),
    enabled: !!clinic?.id,
  })

  const plansQ = useQuery({
    queryKey: [...queryKeys.contentPlans, clinic?.id ?? ''],
    queryFn: () => api.listContentPlans(),
    enabled: !!clinic?.id,
  })

  const planQ = useQuery({
    queryKey: [...queryKeys.contentPlans, 'one', openPlanId ?? ''],
    queryFn: () => api.getContentPlan(openPlanId as string),
    enabled: !!openPlanId,
  })

  const quotaQ = useQuery({
    queryKey: [...queryKeys.marketing, 'image-quota', clinic?.id ?? ''],
    queryFn: () => api.getImageQuota(),
    enabled: !!clinic?.id,
  })

  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: queryKeys.contentPlans })
  const refreshQuota = () => queryClient.invalidateQueries({ queryKey: queryKeys.marketing })

  const generate = useMutation({
    mutationFn: () => api.generateContentPlan(Number(count), tone),
    onSuccess: (plan) => {
      setOpenPlanId(plan.id)
      refreshPlans()
      showToast(
        plan.deterministic ? 'План собран из данных клиники, без модели' : `Готово: ${plan.ideas.length} идей`,
        plan.deterministic ? 'info' : 'success',
      )
    },
    onError: (e: Error) => showToast(e.message || 'Не удалось собрать план', 'error'),
  })

  const removePlan = useMutation({
    mutationFn: (id: string) => api.deleteContentPlan(id),
    onSuccess: (_r, id) => {
      if (openPlanId === id) setOpenPlanId(null)
      refreshPlans()
      showToast('План удалён', 'success')
    },
    onError: (e: Error) => showToast(e.message || 'Не удалось удалить', 'error'),
  })

  const patchIdea = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateContentIdea>[1] }) =>
      api.updateContentIdea(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contentPlans })
      showToast('Правка сохранена', 'success')
    },
    onError: (e: Error) => showToast(e.message || 'Не удалось сохранить', 'error'),
  })

  const makeImages = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'cover' | 'carousel' }) =>
      kind === 'cover' ? api.generateIdeaCover(id) : api.generateIdeaCarousel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contentPlans })
      refreshQuota()
      showToast('Готово', 'success')
    },
    onError: (e: Error) => showToast(e.message || 'Не удалось сгенерировать', 'error'),
    onSettled: () => setBusyIdeaId(null),
  })

  const ctx = contextQ.data
  const plans = plansQ.data || []
  const plan: StoredPlan | undefined = planQ.data
  const quota = quotaQ.data
  const canGenerateImages = Boolean(quota?.configured && (quota?.remaining ?? 0) > 0)

  const copyIdea = async (idea: StoredIdea) => {
    const text = [idea.hook, '', idea.caption, '', idea.hashtags.join(' '), '', idea.callToAction].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      showToast('Текст скопирован', 'success')
    } catch {
      showToast('Браузер не дал доступ к буферу обмена', 'warning')
    }
  }

  const runImages = (id: string, kind: 'cover' | 'carousel') => {
    setBusyIdeaId(id)
    makeImages.mutate({ id, kind })
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
                      {ctx.quietestMonth.month} ({ctx.quietestMonth.appointments})
                    </span>
                  </p>
                )}
                {ctx.neglectedServices.length > 0 && (
                  <p className="m-0 text-txt-secondary">
                    <span className="text-txt-muted">В прайсе есть, но не делают: </span>
                    {ctx.neglectedServices.slice(0, 4).join(', ')}
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

      {/* ── Сборка ── */}
      <Card padding="md" className="mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-full sm:w-56">
            <Select label="Тональность" value={tone} options={TONES} className="min-h-11"
              onChange={(e) => setTone(e.target.value)} />
          </div>
          <div className="w-full sm:w-36">
            <Select label="Сколько идей" value={count} className="min-h-11"
              options={['3', '6', '9', '12'].map((v) => ({ value: v, label: v }))}
              onChange={(e) => setCount(e.target.value)} />
          </div>
          <Button className="min-h-11" icon={<Sparkles size={16} />}
            loading={generate.isPending} onClick={() => generate.mutate()}>
            Собрать контент-план
          </Button>
          {quota && (
            <p className="text-2xs text-txt-muted m-0 pb-3">
              {quota.configured
                ? `Картинок сегодня: ${quota.remaining} из ${quota.limit}`
                : 'Генерация картинок не настроена'}
            </p>
          )}
        </div>
      </Card>

      {/* ── История планов ── */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-txt-primary mb-2">Сохранённые планы</h2>
        {plansQ.isLoading ? (
          <ListSkeleton count={3} />
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<History size={28} />}
            title="Планов пока нет"
            description="Соберите первый — он сохранится и будет доступен завтра."
          />
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <Card key={p.id} padding="md"
                className={cn('cursor-pointer transition-colors', openPlanId === p.id && 'border-dv-gold/40')}
                onClick={() => setOpenPlanId(openPlanId === p.id ? null : p.id)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-txt-primary m-0">{p.title}</p>
                    <p className="text-2xs text-txt-muted m-0 mt-0.5">
                      {new Date(p.createdAt).toLocaleDateString('ru-RU')} · идей: {p.ideaCount}
                      {p.deterministic && ' · без модели'}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm"
                    className="min-h-11 min-w-11 text-error/70 hover:text-error"
                    icon={<Trash2 size={14} />} aria-label={`Удалить план: ${p.title}`}
                    onClick={(e) => { e.stopPropagation(); setToDelete(p) }} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Открытый план ── */}
      {openPlanId && (
        <section>
          <h2 className="text-sm font-bold text-txt-primary mb-2">
            {plan?.title || 'План'}
          </h2>
          {planQ.isLoading ? (
            <ListSkeleton count={4} />
          ) : !plan ? (
            <Card padding="md">
              <p className="text-sm text-txt-muted m-0">План не найден.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {plan.deterministic && (
                <div className="rounded-xl border border-bdr-subtle bg-surface-1 px-4 py-3">
                  <p className="text-sm text-txt-secondary m-0">
                    План собран без языковой модели — только из фактов клиники. Формулировки
                    суше, но ничего не выдумано.
                  </p>
                </div>
              )}
              {plan.ideas.map((idea) => (
                <ContentIdeaCard
                  key={idea.id}
                  idea={idea}
                  canGenerateImages={canGenerateImages}
                  busyImage={busyIdeaId === idea.id}
                  onCopy={() => copyIdea(idea)}
                  onSave={(patch) => patchIdea.mutate({ id: idea.id, patch })}
                  onCover={() => runImages(idea.id, 'cover')}
                  onCarousel={() => runImages(idea.id, 'carousel')}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) removePlan.mutate(toDelete.id) }}
        title="Удалить план?"
        message={toDelete ? `«${toDelete.title}» и все ${toDelete.ideaCount} идей будут удалены безвозвратно.` : ''}
        confirmLabel="Удалить"
      />
    </div>
  )
}
