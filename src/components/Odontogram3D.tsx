// ═══════════════════════════════════════════════════════════════════
// ODONTOGRAM — anatomical teeth + fast surface/status editor + plan
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { T, UPPER, LOWER } from '../utils/constants'
import { Card } from './ui/ds/Card'
import { Badge } from './ui/ds/Badge'
import { Button } from './ui/ds/Button'
import { AnatomicalToothSvg } from './odontogram/AnatomicalToothSvg'
import { getToothMorphology } from './odontogram/toothMorphology'
import { cn } from '@/lib/utils'
import {
  WHOLE_TOOTH_STATUSES,
  SURFACE_STATUSES,
  SURFACE_KEYS,
  STATUS_META,
  statusColor,
  statusLabel,
  normalizeTooth,
  normalizeSurfaceStatus,
  buildPlanFromOdontogram,
  aiPlanPrompt,
  summarizeOdontogram,
  type ToothStatusKey,
  type ToothSurfaces,
  type ToothData,
  type PatientTeeth,
  type SurfaceKey,
  type PlanRecommendation,
} from '@/lib/odontogram'
import { Sparkles, Check, X } from 'lucide-react'

interface Tooth3DProps {
  toothNumber: number
  status?: ToothStatusKey
  surfaces?: ToothSurfaces | null
  onClick: (toothNumber: number) => void
  selected?: number
}

export function Tooth3D({ toothNumber, status, surfaces, onClick, selected }: Tooth3DProps) {
  return (
    <AnatomicalToothSvg
      toothNumber={toothNumber}
      status={status}
      surfaces={surfaces}
      selected={selected === toothNumber}
      onClick={() => onClick(toothNumber)}
      size={40}
    />
  )
}

interface Odontogram3DProps {
  patientTeeth?: PatientTeeth
  onToothClick: (toothNumber: number) => void
  selectedTooth?: number
}

export function Odontogram3D({ patientTeeth = {}, onToothClick, selectedTooth }: Odontogram3DProps) {
  const renderArch = (teeth: readonly number[], label: string, upper: boolean) => {
    const right = teeth.slice(0, 8)
    const left = teeth.slice(8)
    return (
      <div className="space-y-2">
        <div className="text-center text-[10px] uppercase tracking-[0.12em] text-txt-muted font-semibold">
          {label}
        </div>
        <div className="overflow-x-auto overscroll-x-contain -mx-1 px-1">
          <div
            className={cn(
              'inline-flex min-w-full justify-center items-end gap-0.5 sm:gap-1 py-1',
              !upper && 'items-start',
            )}
          >
            {right.map((n) => {
              const t = normalizeTooth(patientTeeth[n] ?? patientTeeth[String(n)])
              return (
                <Tooth3D
                  key={n}
                  toothNumber={n}
                  status={t.status}
                  surfaces={t.surfaces}
                  onClick={onToothClick}
                  selected={selectedTooth}
                />
              )
            })}
            <div
              className="w-px self-stretch mx-1 sm:mx-1.5 bg-gradient-to-b from-transparent via-dv-gold/50 to-transparent shrink-0"
              aria-hidden
            />
            {left.map((n) => {
              const t = normalizeTooth(patientTeeth[n] ?? patientTeeth[String(n)])
              return (
                <Tooth3D
                  key={n}
                  toothNumber={n}
                  status={t.status}
                  surfaces={t.surfaces}
                  onClick={onToothClick}
                  selected={selectedTooth}
                />
              )
            })}
          </div>
        </div>
        <div className="flex justify-between text-[9px] text-txt-muted/50 px-2">
          <span>{upper ? 'Q1 (UR)' : 'Q4 (LR)'}</span>
          <span className="text-dv-gold/70">средняя линия</span>
          <span>{upper ? 'Q2 (UL)' : 'Q3 (LL)'}</span>
        </div>
      </div>
    )
  }

  const selectedMorph = selectedTooth ? getToothMorphology(selectedTooth) : null

  return (
    <Card className="p-3 sm:p-5 overflow-hidden max-w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-txt-muted">
        <span className="rounded-md border border-bdr-subtle px-2 py-0.5">Клик по зубу → статус / поверхности</span>
        <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 px-2 py-0.5">имплант</span>
        <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 px-2 py-0.5">эндо ✓/✗</span>
      </div>

      {renderArch(UPPER, 'Верхняя челюсть', true)}
      <div className="h-px my-3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {renderArch(LOWER, 'Нижняя челюсть', false)}

      {selectedMorph && selectedTooth && (
        <p className="mt-3 text-center text-[11px] text-txt-secondary">
          Зуб <span className="text-dv-gold font-semibold">{selectedTooth}</span>
          {' · '}
          {selectedMorph.label}
          {' · '}
          {selectedMorph.roots === 1 ? 'однокорневой' : selectedMorph.roots === 2 ? 'двукорневой' : 'трёхкорневой'}
        </p>
      )}
    </Card>
  )
}

interface ToothEditorProps {
  toothNumber: number
  tooth?: string | ToothData
  onSave: (toothNumber: number, data: ToothData) => void
  onCancel: () => void
}

/**
 * Fast tooth editor:
 * - one click sets whole-tooth status (implant, endo, crown…)
 * - pick a surface paint, then tap M/O/D/B/L to apply instantly
 */
export function SurfaceEditor({ toothNumber, tooth, surfaces, onSave, onCancel }: ToothEditorProps & { surfaces?: ToothSurfaces }) {
  const initial = normalizeTooth(tooth || { surfaces })
  const [status, setStatus] = useState<ToothStatusKey>(initial.status || 'healthy')
  const [editedSurfaces, setEditedSurfaces] = useState<ToothSurfaces>(initial.surfaces || {})
  const [paint, setPaint] = useState<ToothStatusKey>('caries')

  const applyWhole = (next: ToothStatusKey) => {
    setStatus(next)
    // Whole-tooth replacements clear surface paint noise for missing/implant
    if (next === 'missing' || next === 'implant') {
      setEditedSurfaces({})
    }
  }

  const paintSurface = (surface: SurfaceKey) => {
    setEditedSurfaces((prev) => {
      const next = { ...prev }
      if (paint === 'healthy') {
        delete next[surface]
      } else {
        next[surface] = paint
      }
      return next
    })
    // Surface work implies tooth is present
    if (status === 'missing') setStatus('healthy')
  }

  const handleSave = () => {
    onSave(toothNumber, {
      status,
      surfaces: editedSurfaces,
    })
  }

  return (
    <Card className="p-4 mt-3 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-dv-gold">Зуб {toothNumber}</span>
          <Badge variant="info">{STATUS_META[status]?.label || status}</Badge>
        </div>
        <p className="text-[11px] text-txt-muted m-0">Сначала статус зуба · затем покраска поверхностей</p>
      </div>

      {/* Whole-tooth statuses */}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-txt-muted font-semibold mb-2">Статус зуба</p>
        <div className="flex flex-wrap gap-1.5">
          {WHOLE_TOOTH_STATUSES.map((key) => {
            const meta = STATUS_META[key]
            const active = status === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyWhole(key)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1.5',
                  active ? 'border-transparent text-white' : 'border-bdr-subtle text-txt-secondary hover:bg-white/5',
                )}
                style={active ? { background: meta.color, borderColor: meta.color } : undefined}
              >
                <span className="w-2 h-2 rounded-sm" style={{ background: active ? 'rgba(255,255,255,0.9)' : meta.color }} />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Surface paint */}
      {status !== 'missing' && status !== 'implant' && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-txt-muted font-semibold mb-2">
            Поверхности — выберите краску, затем нажмите M / O / D / B / L
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SURFACE_STATUSES.map((key) => {
              const meta = STATUS_META[key]
              const active = paint === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaint(key)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors',
                    active ? 'ring-2 ring-dv-gold/50 border-transparent text-white' : 'border-bdr-subtle text-txt-secondary',
                  )}
                  style={active ? { background: meta.color } : undefined}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {SURFACE_KEYS.map((surface) => {
              const current = normalizeSurfaceStatus(editedSurfaces[surface])
              const color = current && current !== 'healthy' ? statusColor(current) : undefined
              return (
                <button
                  key={surface}
                  type="button"
                  onClick={() => paintSurface(surface)}
                  className={cn(
                    'px-2 py-3 rounded-xl border transition-all flex flex-col items-center gap-1',
                    color ? 'border-white/20' : 'border-bdr-subtle bg-white/[0.04] hover:bg-white/[0.07]',
                  )}
                  style={color ? { background: `${color}33`, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
                >
                  <span className="text-sm font-bold text-white">{surface}</span>
                  <span className="text-[9px] text-txt-muted">
                    {surface === 'M' && 'мед.'}
                    {surface === 'O' && 'оккл.'}
                    {surface === 'D' && 'дист.'}
                    {surface === 'B' && 'букк.'}
                    {surface === 'L' && 'лингв.'}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: color || T.slate }}>
                    {current && current !== 'healthy' ? statusLabel(current) : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} icon={<X size={14} />}>
          Отмена
        </Button>
        <Button size="sm" onClick={handleSave} icon={<Check size={14} />}>
          Сохранить
        </Button>
      </div>
    </Card>
  )
}

interface AutoTreatmentPlanProps {
  teeth: PatientTeeth
  patientId?: string
  patientName?: string
  clinicId?: string
  onAddToPlan: (recommendations: PlanRecommendation[]) => void | Promise<void>
}

export function AutoTreatmentPlan({ teeth, patientId, patientName, clinicId, onAddToPlan }: AutoTreatmentPlanProps) {
  const navigate = useNavigate()
  const recommendations = useMemo(() => buildPlanFromOdontogram(teeth), [teeth])
  const summary = useMemo(() => summarizeOdontogram(teeth, patientName), [teeth, patientName])
  const [busy, setBusy] = useState(false)

  const savePlan = async () => {
    setBusy(true)
    try {
      await onAddToPlan(recommendations)
    } finally {
      setBusy(false)
    }
  }

  const openAiPlan = () => {
    if (!patientId) return
    // Prefer local plan first — AI may 402 on free/starter; still open chat as optional refine.
    void savePlan().then(() => {
      const prompt = aiPlanPrompt(patientId, patientName || 'пациент', teeth)
      navigate('/', { state: { aiQuery: prompt } })
    })
  }

  if (recommendations.length === 0) {
    return (
      <Card className="p-4 mt-3 space-y-3">
        <div className="text-center text-sm text-emerald-400">
          ✓ Нет активных проблем по одонтограмме — можно назначить профилактику.
        </div>
      </Card>
    )
  }

  const total = recommendations.reduce((s, r) => s + r.estimatedPrice, 0)

  return (
    <Card className="p-4 mt-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-dv-gold">План из одонтограммы</span>
          <Badge variant="warning">{recommendations.length}</Badge>
        </div>
        <span className="text-[11px] text-txt-muted">
          ориентир ~{new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(total)}
        </span>
      </div>

      <p className="text-[11px] text-txt-muted whitespace-pre-wrap m-0 max-h-24 overflow-y-auto opacity-80">
        {summary}
      </p>

      <div className="flex flex-col gap-2">
        {recommendations.map((rec, idx) => (
          <div
            key={`${rec.tooth}-${idx}`}
            className="px-3 py-2.5 rounded-xl border border-bdr-subtle bg-white/[0.03] flex justify-between items-center gap-2"
          >
            <div className="min-w-0">
              <p className="text-xs text-white font-semibold m-0">
                Зуб {rec.tooth}: {rec.procedure}
              </p>
              <p className="text-[10px] text-txt-muted m-0 mt-0.5">
                {rec.reason} · ~
                {new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(rec.estimatedPrice)}
              </p>
            </div>
            <Badge
              variant={rec.urgency === 'high' ? 'error' : rec.urgency === 'medium' ? 'warning' : 'default'}
              size="sm"
            >
              {rec.urgency === 'high' ? 'Срочно' : rec.urgency === 'medium' ? 'Реком.' : 'Планово'}
            </Badge>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button size="sm" onClick={() => void savePlan()} disabled={busy}>
          {busy ? 'Сохранение…' : 'В план лечения'}
        </Button>
        {patientId && clinicId && (
          <Button size="sm" variant="secondary" icon={<Sparkles size={14} />} onClick={openAiPlan} disabled={busy}>
            Сохранить и уточнить в ИИ
          </Button>
        )}
      </div>
      <p className="text-[10px] text-txt-muted m-0">
        При сохранении зуба позиции уже попадают в черновик плана. ИИ — опционально (нужен тариф с AI).
      </p>
    </Card>
  )
}

export function ToothLegend() {
  return (
    <div className="flex gap-2 sm:gap-3 flex-wrap py-2">
      {Object.entries(STATUS_META).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1.5 text-[11px] text-txt-muted">
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: value.color }} />
          {value.label}
        </div>
      ))}
    </div>
  )
}

export default Odontogram3D
