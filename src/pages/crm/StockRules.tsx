import React, { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PackageMinus, Plus, Trash2, Stethoscope, Repeat, ClipboardList, Eye } from 'lucide-react'
import { Button } from '@/components/ui/ds/Button'
import { Card } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Input, Select } from '@/components/ui/ds/Input'
import { Modal } from '@/components/ui/ds/Modal'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { useToast } from '@/components/ui/ds/Toast'
import { useDataQuery } from '@/queries/useDataQuery'
import { useClinicPriceList } from '@/queries/priceList.query'
import { queryKeys } from '@/queries/keys'
import { DENTAL_ICD10 } from '@/lib/icd10-data'
import { cn } from '@/lib/utils'
import * as api from '@/utils/api'
import type { StockRule } from '@/utils/api'
import type { Clinic, User, RoleInfo, InventoryItem } from '@/types'

type Scope = 'always' | 'service' | 'diagnosis'

const SECTIONS: Array<{
  scope: Scope
  title: string
  hint: string
  icon: React.ReactNode
}> = [
  {
    scope: 'always',
    title: 'Каждый приём',
    hint: 'Расходники, которые уходят независимо от того, что делали: перчатки, маска, слюноотсос.',
    icon: <Repeat size={18} />,
  },
  {
    scope: 'service',
    title: 'По услугам',
    hint: 'Материалы под конкретную услугу из прайса. Сработает, если эта услуга есть в закрытом приёме.',
    icon: <ClipboardList size={18} />,
  },
  {
    scope: 'diagnosis',
    title: 'По диагнозам',
    hint: 'Материалы под диагноз МКБ-10. Код рубрики («K02») охватывает всю рубрику, точный код («K02.1») — только себя.',
    icon: <Stethoscope size={18} />,
  },
]

interface DraftLine {
  itemId: string
  quantity: number
}

/**
 * Настройка списания расходников после приёма.
 *
 * Заменила единственное поле в настройках клиники, куда вписывали названия
 * через запятую. Экран отдельный, потому что настройка перестала быть
 * строкой: у правила есть область действия, позиции склада и количества,
 * а результат можно проверить предпросмотром до первого приёма.
 */
export default function StockRules() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { inventory } = useDataQuery(clinic?.id)
  const { services } = useClinicPriceList(clinic?.id)

  const rulesQ = useQuery({
    queryKey: [...queryKeys.stockRules, clinic?.id ?? ''],
    queryFn: () => api.getStockRules(),
    enabled: !!clinic?.id,
  })

  const [addScope, setAddScope] = useState<Scope | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.stockRules })

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.saveStockRule>[0]) => api.saveStockRule(data),
    onSuccess: () => { invalidate(); showToast('Правило сохранено', 'success') },
    onError: (e: Error) => showToast(e.message || 'Не удалось сохранить', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStockRule(id),
    onSuccess: () => { invalidate(); showToast('Правило удалено', 'success') },
    onError: (e: Error) => showToast(e.message || 'Не удалось удалить', 'error'),
  })

  const rules = rulesQ.data || []
  const byScope = (scope: Scope) => rules.filter(r => r.scope === scope)

  const targetLabel = (rule: StockRule): string => {
    if (rule.scope === 'always') return 'Каждый приём'
    if (rule.scope === 'service') {
      return services.find(s => s.id === rule.matchKey)?.name || rule.matchKey
    }
    const dx = DENTAL_ICD10.find(d => d.code === rule.matchKey)
    return dx ? `${dx.code} — ${dx.name}` : rule.matchKey
  }

  /** Коды, на которые правило уже есть: второй раз предлагать их незачем. */
  const takenKeys = (scope: Scope) => new Set(byScope(scope).map(r => r.matchKey))

  return (
    <div className="dv-page py-4 md:py-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Списание после приёма"
        subtitle={`${clinic?.name} · что уходит со склада, когда приём закрыт`}
        icon={<PackageMinus size={20} />}
        actions={
          <Button variant="secondary" className="min-h-11" icon={<Eye size={16} />}
            onClick={() => setPreviewOpen(true)}>
            Проверить на примере
          </Button>
        }
      />

      {rulesQ.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map(section => {
            const sectionRules = byScope(section.scope)
            // «Каждый приём» — правило ровно одно: смысл области в том, что
            // она одна на всю клинику, и второй карточкой её не размножить.
            const canAdd = section.scope !== 'always' || sectionRules.length === 0
            return (
              <section key={section.scope}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2">
                    <span className="text-dv-gold mt-0.5">{section.icon}</span>
                    <div>
                      <h2 className="text-sm font-bold text-txt-primary m-0">{section.title}</h2>
                      <p className="text-2xs text-txt-muted m-0 mt-0.5 max-w-2xl">{section.hint}</p>
                    </div>
                  </div>
                  {canAdd && (
                    <Button size="sm" variant="secondary" className="min-h-11" icon={<Plus size={14} />}
                      onClick={() => setAddScope(section.scope)}>
                      Добавить
                    </Button>
                  )}
                </div>

                {sectionRules.length === 0 ? (
                  <Card padding="md">
                    <p className="text-sm text-txt-muted m-0">
                      Правил нет — по этой области ничего не списывается.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {sectionRules.map(rule => (
                      <RuleCard
                        key={rule.id}
                        rule={rule}
                        title={targetLabel(rule)}
                        inventory={inventory}
                        saving={saveMutation.isPending}
                        onSave={(lines, active) => saveMutation.mutate({
                          scope: rule.scope,
                          matchKey: rule.matchKey,
                          label: rule.label,
                          active,
                          items: lines,
                        })}
                        onDelete={() => deleteMutation.mutate(rule.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <AddRuleModal
        scope={addScope}
        onClose={() => setAddScope(null)}
        inventory={inventory}
        services={services}
        taken={addScope ? takenKeys(addScope) : new Set()}
        saving={saveMutation.isPending}
        onSave={(data) => {
          saveMutation.mutate(data, { onSuccess: () => setAddScope(null) })
        }}
      />

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        services={services}
      />
    </div>
  )
}

// ─── Карточка правила ───

function RuleCard({
  rule, title, inventory, saving, onSave, onDelete,
}: {
  rule: StockRule
  title: string
  inventory: InventoryItem[]
  saving: boolean
  onSave: (lines: DraftLine[], active: boolean) => void
  onDelete: () => void
}) {
  const [lines, setLines] = useState<DraftLine[]>(
    () => rule.items.map(i => ({ itemId: i.itemId, quantity: i.quantity })),
  )
  const [active, setActive] = useState(rule.active)

  const original = useMemo(
    () => JSON.stringify({
      items: rule.items.map(i => ({ itemId: i.itemId, quantity: i.quantity })),
      active: rule.active,
    }),
    [rule],
  )
  const dirty = JSON.stringify({ items: lines, active }) !== original

  const nameOf = (itemId: string) =>
    inventory.find(i => i.id === itemId)?.name
    || rule.items.find(i => i.itemId === itemId)?.item?.name
    || 'Позиция удалена'

  const unitOf = (itemId: string) =>
    inventory.find(i => i.id === itemId)?.unit
    || rule.items.find(i => i.itemId === itemId)?.item?.unit
    || 'шт'

  const availableItems = inventory.filter(i => !lines.some(l => l.itemId === i.id))

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-txt-primary m-0">{title}</p>
          {!active && <Badge variant="warning" size="sm" className="mt-1">Выключено</Badge>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="min-h-11"
            onClick={() => setActive(!active)}>
            {active ? 'Выключить' : 'Включить'}
          </Button>
          <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11 text-error/70 hover:text-error"
            icon={<Trash2 size={14} />} onClick={onDelete} aria-label={`Удалить правило: ${title}`} />
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-txt-muted mb-3">
          Позиций нет — правило ничего не спишет.
        </p>
      ) : (
        <div className="space-y-2 mb-3">
          {lines.map((line, idx) => (
            <div key={line.itemId} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-txt-primary truncate">{nameOf(line.itemId)}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-xs" className="min-h-11 min-w-11"
                  aria-label={`Уменьшить количество: ${nameOf(line.itemId)}`}
                  onClick={() => setLines(ls => ls.map((l, i) =>
                    i === idx ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l))}>
                  −
                </Button>
                <span className="w-14 text-center text-sm font-bold text-txt-primary tabular-nums">
                  {line.quantity} {unitOf(line.itemId)}
                </span>
                <Button variant="ghost" size="icon-xs" className="min-h-11 min-w-11"
                  aria-label={`Увеличить количество: ${nameOf(line.itemId)}`}
                  onClick={() => setLines(ls => ls.map((l, i) =>
                    i === idx ? { ...l, quantity: l.quantity + 1 } : l))}>
                  +
                </Button>
                <Button variant="ghost" size="icon-xs" className="min-h-11 min-w-11 text-error/70 hover:text-error"
                  icon={<Trash2 size={13} />} aria-label={`Убрать из правила: ${nameOf(line.itemId)}`}
                  onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-48">
          <Select
            label="Добавить позицию"
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              setLines(ls => [...ls, { itemId: e.target.value, quantity: 1 }])
            }}
            options={[
              { value: '', label: availableItems.length ? '— выберите со склада —' : '— все позиции уже добавлены —' },
              ...availableItems.map(i => ({ value: i.id, label: `${i.name} · остаток ${i.quantity}` })),
            ]}
            className="min-h-11"
          />
        </div>
        {dirty && (
          <Button className="min-h-11" disabled={saving}
            onClick={() => onSave(lines, active)}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        )}
      </div>
    </Card>
  )
}

// ─── Создание правила ───

function AddRuleModal({
  scope, onClose, inventory, services, taken, saving, onSave,
}: {
  scope: Scope | null
  onClose: () => void
  inventory: InventoryItem[]
  services: Array<{ id: string; name: string; cat: string }>
  taken: Set<string>
  saving: boolean
  onSave: (data: Parameters<typeof api.saveStockRule>[0]) => void
}) {
  const [matchKey, setMatchKey] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])

  React.useEffect(() => {
    if (scope) { setMatchKey(''); setLines([]) }
  }, [scope])

  if (!scope) return null

  const targetOptions = scope === 'service'
    ? [
        { value: '', label: '— выберите услугу —' },
        ...services
          .filter(s => !taken.has(s.id))
          .map(s => ({ value: s.id, label: s.name, group: s.cat })),
      ]
    : [
        { value: '', label: '— выберите диагноз —' },
        ...DENTAL_ICD10
          .filter(d => !taken.has(d.code))
          .map(d => ({ value: d.code, label: `${d.code} — ${d.name}` })),
      ]

  const availableItems = inventory.filter(i => !lines.some(l => l.itemId === i.id))
  const ready = (scope === 'always' || !!matchKey) && lines.length > 0

  return (
    <Modal
      open
      onClose={onClose}
      title={scope === 'service' ? 'Правило на услугу' : scope === 'diagnosis' ? 'Правило на диагноз' : 'Расходники каждого приёма'}
      size="md"
      className="max-w-[95vw] sm:max-w-md"
    >
      <div className="space-y-4">
        {scope !== 'always' && (
          <Select
            label={scope === 'service' ? 'Услуга *' : 'Диагноз *'}
            value={matchKey}
            onChange={(e) => setMatchKey(e.target.value)}
            options={targetOptions}
            className="min-h-11"
          />
        )}

        {scope === 'diagnosis' && (
          <p className="text-2xs text-txt-muted -mt-2">
            Правило сработает и на уточнённые коды той же рубрики: выбрав «K02.1»,
            вы охватите только его, а рубрику целиком — код без точки.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider">Что списывать</p>
          {lines.map((line, idx) => (
            <div key={line.itemId} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-txt-primary truncate">
                {inventory.find(i => i.id === line.itemId)?.name || line.itemId}
              </span>
              <Input
                type="number"
                min="1"
                value={line.quantity}
                onChange={(e) => setLines(ls => ls.map((l, i) =>
                  i === idx ? { ...l, quantity: Math.max(1, Number(e.target.value) || 1) } : l))}
                className="w-20 min-h-11"
                aria-label="Количество"
              />
              <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11 text-error/70 hover:text-error"
                icon={<Trash2 size={14} />} aria-label="Убрать позицию"
                onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))} />
            </div>
          ))}
          <Select
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              setLines(ls => [...ls, { itemId: e.target.value, quantity: 1 }])
            }}
            options={[
              { value: '', label: inventory.length ? '— добавить позицию со склада —' : '— склад пуст —' },
              ...availableItems.map(i => ({ value: i.id, label: `${i.name} · остаток ${i.quantity}` })),
            ]}
            className="min-h-11"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1 min-h-11"
            disabled={!ready || saving}
            onClick={() => onSave({
              scope,
              matchKey: scope === 'always' ? '' : matchKey,
              items: lines,
            })}
          >
            {saving ? 'Сохранение…' : 'Создать правило'}
          </Button>
          <Button variant="ghost" onClick={onClose} className="min-h-11">Отмена</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Предпросмотр ───

function PreviewModal({
  open, onClose, services,
}: {
  open: boolean
  onClose: () => void
  services: Array<{ id: string; name: string; cat: string }>
}) {
  const [serviceId, setServiceId] = useState('')
  const [diagnosis, setDiagnosis] = useState('')

  const previewQ = useQuery({
    queryKey: ['stockRulesPreview', serviceId, diagnosis],
    queryFn: () => api.previewStockDeduction(serviceId ? [serviceId] : [], diagnosis || undefined),
    enabled: open,
  })

  const lines = previewQ.data || []

  return (
    <Modal open={open} onClose={onClose} title="Что спишется" size="md" className="max-w-[95vw] sm:max-w-md">
      <div className="space-y-4">
        <p className="text-2xs text-txt-muted m-0">
          Тот же расчёт, что и при закрытии приёма — не отдельная прикидка.
        </p>
        <Select
          label="Услуга приёма"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          options={[
            { value: '', label: '— без услуги —' },
            ...services.map(s => ({ value: s.id, label: s.name, group: s.cat })),
          ]}
          className="min-h-11"
        />
        <Select
          label="Диагноз"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          options={[
            { value: '', label: '— без диагноза —' },
            ...DENTAL_ICD10.map(d => ({ value: d.code, label: `${d.code} — ${d.name}` })),
          ]}
          className="min-h-11"
        />

        {previewQ.isLoading ? (
          <Skeleton className="h-24" />
        ) : lines.length === 0 ? (
          <EmptyState
            icon={<PackageMinus size={24} />}
            title="Ничего не спишется"
            description="Под такой приём правил нет."
          />
        ) : (
          <div className="space-y-2">
            {lines.map(line => {
              const short = line.available < line.quantity
              return (
                <div key={line.itemId} className="rounded-lg border border-bdr-subtle bg-surface-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-txt-primary truncate">{line.itemName}</span>
                    <span className={cn('shrink-0 text-sm font-bold tabular-nums', short ? 'text-warning' : 'text-txt-primary')}>
                      −{line.quantity} {line.unit || 'шт'}
                    </span>
                  </div>
                  <p className="text-2xs text-txt-muted m-0 mt-1">
                    По правилам: {line.sources.join(', ')} · на складе {line.available}
                  </p>
                  {short && (
                    <p className="text-2xs text-warning m-0 mt-0.5">
                      Не хватит: спишется {line.available} из {line.quantity}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
