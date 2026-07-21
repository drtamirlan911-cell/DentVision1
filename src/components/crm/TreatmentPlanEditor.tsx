import React, { useEffect, useMemo, useState } from 'react'
import {
  Plus, Trash2, Save, Printer, Layers, ChevronDown, ChevronUp, GripVertical,
} from 'lucide-react'
import { Modal } from '@/components/ui/ds/Modal'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Badge } from '@/components/ui/ds/Badge'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { ToothMultiPicker } from '@/components/crm/ToothMultiPicker'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'
import { ALL_SERVICES } from '@/utils/constants'
import {
  collectPlanTeeth,
  createEmptyStage,
  createLineItem,
  enrichStagesWithCosts,
  formatTeethList,
  lineItemTotal,
  normalizeStages,
  planTotal,
  stageTotal,
  type TreatmentPlanDraft,
  type TreatmentPlanLineItem,
  type TreatmentPlanStage,
} from '@/lib/treatment-plan'
import { printTreatmentPlan } from '@/lib/treatment-plan-print'
import type { Clinic, Patient } from '@/types'

interface ServiceOption {
  id: string
  name: string
  price: number
  cat: string
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'proposed', label: 'Предложен' },
  { value: 'accepted', label: 'Принят' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершён' },
]

function parseCustomName(raw?: string | null): { cat: string; name: string } {
  if (!raw) return { cat: 'Свои услуги', name: 'Услуга' }
  const sep = raw.indexOf(' · ')
  if (sep > 0) {
    return { cat: raw.slice(0, sep) || 'Свои услуги', name: raw.slice(sep + 3) || raw }
  }
  return { cat: 'Свои услуги', name: raw }
}

interface TreatmentPlanEditorProps {
  open: boolean
  onClose: () => void
  clinicId: string
  clinic?: Clinic | null
  doctorId?: string
  doctorName?: string
  patients: Patient[]
  initialPatientId?: string
  plan?: Record<string, unknown> | null
  onSaved: () => void
}

export function TreatmentPlanEditor({
  open,
  onClose,
  clinicId,
  clinic,
  doctorId,
  doctorName,
  patients,
  initialPatientId,
  plan,
  onSaved,
}: TreatmentPlanEditorProps) {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [services, setServices] = useState<ServiceOption[]>([])
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null)
  const [pickerTeeth, setPickerTeeth] = useState<number[]>([])
  const [editingItem, setEditingItem] = useState<{ stageId: string; itemId: string } | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [draft, setDraft] = useState<TreatmentPlanDraft>({
    patientId: initialPatientId || '',
    title: 'План лечения',
    diagnosis: '',
    status: 'proposed',
    stages: [createEmptyStage(1)],
  })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await api.getPriceList()
        const map = new Map<string, number>()
        const customs: ServiceOption[] = []
        for (const row of rows || []) {
          if (!row.serviceCode) continue
          map.set(row.serviceCode, Number(row.price))
          const isBase = ALL_SERVICES.some((s) => s.id === row.serviceCode)
          if (!isBase) {
            const parsed = parseCustomName(row.name)
            customs.push({
              id: row.serviceCode,
              name: parsed.name,
              price: Number(row.price),
              cat: parsed.cat,
            })
          }
        }
        const merged = [
          ...ALL_SERVICES.map((s) => ({
            ...s,
            price: map.has(s.id) ? map.get(s.id)! : s.price,
          })),
          ...customs,
        ]
        if (!cancelled) setServices(merged)
      } catch {
        if (!cancelled) setServices(ALL_SERVICES.map((s) => ({ ...s })))
      }
    })()
    return () => { cancelled = true }
  }, [open, clinicId])

  useEffect(() => {
    if (!open) return
    if (plan) {
      const stages = normalizeStages((plan.stages as unknown[]) || [])
      setDraft({
        id: String(plan.id || ''),
        patientId: String(plan.patientId || ''),
        title: String(plan.title || 'План лечения'),
        diagnosis: String(plan.diagnosis || plan.notes || ''),
        status: String(plan.status || 'proposed'),
        stages: stages.length ? stages : [createEmptyStage(1)],
      })
      setExpandedStageId(stages[0]?.id || null)
    } else {
      setDraft({
        patientId: initialPatientId || '',
        title: 'План лечения',
        diagnosis: '',
        status: 'proposed',
        stages: [createEmptyStage(1)],
      })
      setExpandedStageId(null)
    }
    setPickerTeeth([])
    setEditingItem(null)
    setSelectedServiceId('')
  }, [open, plan, initialPatientId])

  const enrichedStages = useMemo(
    () => enrichStagesWithCosts(draft.stages),
    [draft.stages],
  )
  const total = useMemo(() => planTotal(enrichedStages), [enrichedStages])

  const patient = patients.find((p) => p.id === draft.patientId)

  const updateStage = (stageId: string, patch: Partial<TreatmentPlanStage>) => {
    setDraft((prev) => ({
      ...prev,
      stages: prev.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)),
    }))
  }

  const removeStage = (stageId: string) => {
    setDraft((prev) => {
      const next = prev.stages.filter((s) => s.id !== stageId)
      return {
        ...prev,
        stages: next.length ? next.map((s, i) => ({ ...s, sortOrder: i + 1 })) : [createEmptyStage(1)],
      }
    })
  }

  const addStage = () => {
    const nextOrder = draft.stages.length + 1
    const stage = createEmptyStage(nextOrder)
    setDraft((prev) => ({ ...prev, stages: [...prev.stages, stage] }))
    setExpandedStageId(stage.id)
  }

  const moveStage = (stageId: string, direction: -1 | 1) => {
    setDraft((prev) => {
      const idx = prev.stages.findIndex((s) => s.id === stageId)
      if (idx < 0) return prev
      const target = idx + direction
      if (target < 0 || target >= prev.stages.length) return prev
      const next = [...prev.stages]
      const [item] = next.splice(idx, 1)
      next.splice(target, 0, item)
      return {
        ...prev,
        stages: next.map((s, i) => ({ ...s, sortOrder: i + 1 })),
      }
    })
  }

  const addItemToStage = (stageId: string) => {
    const service = services.find((s) => s.id === selectedServiceId)
    if (!service) {
      showToast('Выберите услугу из прайса', 'warning')
      return
    }
    const item = createLineItem(service, pickerTeeth)
    updateStage(stageId, {
      items: [
        ...(draft.stages.find((s) => s.id === stageId)?.items || []),
        item,
      ],
    })
    setSelectedServiceId('')
    setPickerTeeth([])
    setEditingItem(null)
    showToast('Услуга добавлена', 'success')
  }

  const updateItem = (
    stageId: string,
    itemId: string,
    patch: Partial<TreatmentPlanLineItem>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => {
        if (stage.id !== stageId) return stage
        return {
          ...stage,
          items: stage.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
        }
      }),
    }))
  }

  const removeItem = (stageId: string, itemId: string) => {
    setDraft((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => {
        if (stage.id !== stageId) return stage
        return { ...stage, items: stage.items.filter((item) => item.id !== itemId) }
      }),
    }))
  }

  const handlePickerChange = (teeth: number[]) => {
    setPickerTeeth(teeth)
    if (!editingItem) return
    setDraft((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => {
        if (stage.id !== editingItem.stageId) return stage
        return {
          ...stage,
          items: stage.items.map((item) => (
            item.id === editingItem.itemId ? { ...item, teeth } : item
          )),
        }
      }),
    }))
  }

  const handleSave = async () => {
    if (!draft.patientId) {
      showToast('Выберите пациента', 'warning')
      return
    }
    if (!draft.stages.some((s) => s.items.length > 0)) {
      showToast('Добавьте хотя бы одну услугу в план', 'warning')
      return
    }

    setSaving(true)
    try {
      const stages = enrichStagesWithCosts(draft.stages)
      await api.upsertTreatmentPlan({
        id: draft.id,
        clinicId,
        patientId: draft.patientId,
        doctorId,
        title: draft.title || 'План лечения',
        diagnosis: draft.diagnosis || null,
        status: draft.status,
        totalBudget: planTotal(stages),
        teeth: collectPlanTeeth(stages),
        stages,
      })
      showToast(draft.id ? 'План обновлён' : 'План создан', 'success')
      onSaved()
      onClose()
    } catch {
      showToast('Не удалось сохранить план', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = async () => {
    if (!patient) {
      showToast('Выберите пациента', 'warning')
      return
    }
    let clinicData = clinic
    try {
      if (clinicId) {
        const payload = await api.getClinicSettings(clinicId)
        clinicData = payload.clinic || clinicData
      }
    } catch { /* use fallback clinic */ }

    printTreatmentPlan({
      clinicName: clinicData?.name || 'Клиника',
      clinicAddress: clinicData?.address,
      clinicPhone: clinicData?.phone,
      clinicCity: clinicData?.city,
      patientName: patient.name,
      patientPhone: patient.phone,
      doctorName,
      title: draft.title,
      diagnosis: draft.diagnosis,
      status: draft.status,
      stages: enrichStagesWithCosts(draft.stages),
      createdAt: plan?.createdAt ? String(plan.createdAt) : undefined,
    })
  }

  const servicesByCategory = useMemo(() => {
    const map = new Map<string, ServiceOption[]>()
    for (const s of services) {
      const list = map.get(s.cat) || []
      list.push(s)
      map.set(s.cat, list)
    }
    return [...map.entries()]
  }, [services])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? 'Редактирование плана лечения' : 'Новый план лечения'}
      description="Добавьте услуги, выберите зубы и разделите лечение на этапы"
      size="full"
      className="max-w-5xl"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-txt-muted mb-1 block">Пациент</label>
            <select
              value={draft.patientId}
              onChange={(e) => setDraft((prev) => ({ ...prev, patientId: e.target.value }))}
              disabled={Boolean(draft.id)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-txt-primary disabled:opacity-60"
            >
              <option value="">Выберите пациента…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-txt-muted mb-1 block">Название плана</label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="План лечения"
            />
          </div>
          <div>
            <label className="text-xs text-txt-muted mb-1 block">Диагноз / показания</label>
            <Input
              value={draft.diagnosis}
              onChange={(e) => setDraft((prev) => ({ ...prev, diagnosis: e.target.value }))}
              placeholder="Например: K02.1 Кариес дентина"
            />
          </div>
          <div>
            <label className="text-xs text-txt-muted mb-1 block">Статус</label>
            <select
              value={draft.status}
              onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-txt-primary"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-txt-primary">
            <Layers size={16} className="text-dv-gold" />
            Этапы лечения
          </div>
          <Button size="sm" variant="secondary" onClick={addStage} icon={<Plus size={14} />}>
            Добавить этап
          </Button>
        </div>

        <div className="space-y-3">
          {enrichedStages.map((stage, stageIndex) => {
            const expanded = expandedStageId === stage.id
            return (
              <Card key={stage.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedStageId(expanded ? null : stage.id)}
                  >
                    <GripVertical size={14} className="text-txt-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-txt-primary">{stage.title}</span>
                        <Badge size="xs">{stage.items.length} усл.</Badge>
                        <span className="text-sm text-dv-gold font-semibold ml-auto md:ml-0">
                          {stageTotal(stage).toLocaleString('ru-RU')} ₸
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); moveStage(stage.id, -1) }}
                        disabled={stageIndex === 0}
                      >
                        <ChevronUp size={14} />
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); moveStage(stage.id, 1) }}
                        disabled={stageIndex === enrichedStages.length - 1}
                      >
                        <ChevronDown size={14} />
                      </Button>
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-white/5">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 pt-4">
                        <Input
                          value={stage.title}
                          onChange={(e) => updateStage(stage.id, { title: e.target.value })}
                          placeholder={`Этап ${stageIndex + 1}`}
                        />
                        {enrichedStages.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-error/80"
                            icon={<Trash2 size={14} />}
                            onClick={() => removeStage(stage.id)}
                          >
                            Удалить этап
                          </Button>
                        )}
                      </div>

                      {stage.items.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-txt-muted border-b border-white/10">
                                <th className="p-3 font-medium">Услуга</th>
                                <th className="p-3 font-medium">Зубы</th>
                                <th className="p-3 font-medium text-right">Цена</th>
                                <th className="p-3 font-medium text-right">Сумма</th>
                                <th className="p-3 w-10" />
                              </tr>
                            </thead>
                            <tbody>
                              {stage.items.map((item) => (
                                <tr key={item.id} className="border-b border-white/5 last:border-0">
                                  <td className="p-3 text-txt-primary">{item.serviceName}</td>
                                  <td className="p-3">
                                    <button
                                      type="button"
                                      className="text-xs text-dv-gold hover:underline"
                                      onClick={() => {
                                        setEditingItem({ stageId: stage.id, itemId: item.id })
                                        setPickerTeeth(item.teeth)
                                      }}
                                    >
                                      {formatTeethList(item.teeth)}
                                    </button>
                                  </td>
                                  <td className="p-3 text-right">
                                    <input
                                      type="number"
                                      value={item.price}
                                      onChange={(e) => updateItem(stage.id, item.id, { price: Number(e.target.value) || 0 })}
                                      className="w-24 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-right text-sm"
                                    />
                                  </td>
                                  <td className="p-3 text-right text-txt-secondary font-medium">
                                    {lineItemTotal(item).toLocaleString('ru-RU')} ₸
                                  </td>
                                  <td className="p-3">
                                    <button
                                      type="button"
                                      onClick={() => removeItem(stage.id, item.id)}
                                      className="text-txt-muted hover:text-error transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-txt-muted">В этом этапе пока нет услуг</p>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 rounded-xl border border-dv-gold/20 bg-dv-gold/5 p-4">
                        <div className="space-y-3">
                          <label className="text-xs text-txt-muted block">Услуга из прайса</label>
                          <select
                            value={selectedServiceId}
                            onChange={(e) => setSelectedServiceId(e.target.value)}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-txt-primary"
                          >
                            <option value="">— Выберите услугу —</option>
                            {servicesByCategory.map(([cat, items]) => (
                              <optgroup key={cat} label={cat}>
                                {items.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} — {s.price.toLocaleString('ru-RU')} ₸
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() => addItemToStage(stage.id)}
                            icon={<Plus size={14} />}
                          >
                            Добавить услугу
                          </Button>
                        </div>
                        <ToothMultiPicker
                          selected={pickerTeeth}
                          onChange={handlePickerChange}
                          compact
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div>
            <p className="text-xs text-txt-muted">Итого по плану</p>
            <p className="text-2xl font-bold text-dv-gold">{total.toLocaleString('ru-RU')} ₸</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button size="sm" variant="secondary" onClick={handlePrint} icon={<Printer size={14} />}>
              Печать / PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} icon={<Save size={14} />}>
              {saving ? 'Сохранение…' : 'Сохранить план'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
