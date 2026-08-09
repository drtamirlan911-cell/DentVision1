// ═══════════════════════════════════════════════════════════════════
// ODONTOGRAM — anatomical teeth + fast surface/status editor + plan
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  toothSize: number
}

export function Tooth3D({ toothNumber, status, surfaces, onClick, selected, toothSize }: Tooth3DProps) {
  return (
    <AnatomicalToothSvg
      toothNumber={toothNumber}
      status={status}
      surfaces={surfaces}
      selected={selected === toothNumber}
      onClick={() => onClick(toothNumber)}
      size={toothSize}
    />
  )
}

interface Odontogram3DProps {
  patientTeeth?: PatientTeeth
  onToothClick: (toothNumber: number) => void
  selectedTooth?: number
}

export function Odontogram3D({ patientTeeth = {}, onToothClick, selectedTooth }: Odontogram3DProps) {
  const { t } = useTranslation()
  const toothSize = typeof window !== 'undefined' && window.innerWidth < 480 ? 24 : window.innerWidth < 768 ? 30 : 40

  const renderArch = (teeth: readonly number[], label: string, upper: boolean) => {
    const right = teeth.slice(0, 8)
    const left = teeth.slice(8)
    return (
      <div className="space-y-1.5 sm:space-y-2">
        <div className="text-center text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-txt-muted font-semibold">
          {label}
        </div>
        <div className="overflow-x-auto overscroll-x-contain -mx-1 px-1">
          <div
            className={cn(
              'inline-flex min-w-full justify-center items-end gap-px sm:gap-0.5 md:gap-1 py-1',
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
                  toothSize={toothSize}
                />
              )
            })}
            <div
              className="w-px self-stretch mx-0.5 sm:mx-1 md:mx-1.5 bg-gradient-to-b from-transparent via-dv-gold/50 to-transparent shrink-0"
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
                  toothSize={toothSize}
                />
              )
            })}
          </div>
        </div>
        <div className="flex justify-between text-[8px] sm:text-[9px] text-txt-muted/50 px-1 sm:px-2">
          <span>{upper ? 'Q1 (UR)' : 'Q4 (LR)'}</span>
          <span className="text-dv-gold/70">{t('diagnostics.midline')}</span>
          <span>{upper ? 'Q2 (UL)' : 'Q3 (LL)'}</span>
        </div>
      </div>
    )
  }

  const selectedMorph = selectedTooth ? getToothMorphology(selectedTooth) : null

  return (
    <Card className="p-2 sm:p-3 md:p-5 overflow-hidden max-w-full">
      <div className="mb-2 sm:mb-3 flex flex-wrap items-center gap-1 sm:gap-2 text-[9px] sm:text-[10px] text-txt-muted">
        <span className="rounded-md border border-bdr-subtle px-1.5 sm:px-2 py-0.5">{t('diagnostics.click_status')}</span>
        <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 px-1.5 sm:px-2 py-0.5">{t('diagnostics.implant')}</span>
        <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 px-1.5 sm:px-2 py-0.5">{t('diagnostics.endo')}</span>
      </div>

      {renderArch(UPPER, t('diagnostics.upper_jaw'), true)}
      <div className="h-px my-2 sm:my-3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {renderArch(LOWER, t('diagnostics.lower_jaw'), false)}

      {selectedMorph && selectedTooth && (
        <p className="mt-2 sm:mt-3 text-center text-[10px] sm:text-[11px] text-txt-secondary">
          {t('diagnostics.tooth')} <span className="text-dv-gold font-semibold">{selectedTooth}</span>
          {' · '}
          {selectedMorph.label}
          {' · '}
          {selectedMorph.roots === 1 ? t('diagnostics.single_root') : selectedMorph.roots === 2 ? t('diagnostics.double_root') : t('diagnostics.triple_root')}
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
  const { t } = useTranslation()
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
    <Card className="p-3 sm:p-4 mt-2 sm:mt-3 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-dv-gold">{t('diagnostics.tooth')} {toothNumber}</span>
          <Badge variant="info">{STATUS_META[status]?.label || status}</Badge>
        </div>
        <p className="text-[10px] sm:text-[11px] text-txt-muted m-0">{t('diagnostics.status_surface')}</p>
      </div>

      {/* Whole-tooth statuses */}
      <div>
        <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-txt-muted font-semibold mb-1.5 sm:mb-2">{t('diagnostics.tooth_status')}</p>
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {WHOLE_TOOTH_STATUSES.map((key) => {
            const meta = STATUS_META[key]
            const active = status === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => applyWhole(key)}
                className={cn(
                  'px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold border transition-colors flex items-center gap-1 sm:gap-1.5',
                  active ? 'border-transparent text-white' : 'border-bdr-subtle text-txt-secondary hover:bg-surface-1',
                )}
                style={active ? { background: meta.color, borderColor: meta.color } : undefined}
              >
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: active ? 'rgba(255,255,255,0.9)' : meta.color }} />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Surface paint */}
      {status !== 'missing' && status !== 'implant' && (
        <div>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-txt-muted font-semibold mb-1.5 sm:mb-2">
            {t('diagnostics.surfaces_hint')}
          </p>
          <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
            {SURFACE_STATUSES.map((key) => {
              const meta = STATUS_META[key]
              const active = paint === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaint(key)}
                  className={cn(
                    'px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold border transition-colors',
                    active ? 'ring-2 ring-dv-gold/50 border-transparent text-txt-primary' : 'border-bdr-subtle text-txt-secondary',
                  )}
                  style={active ? { background: meta.color } : undefined}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {SURFACE_KEYS.map((surface) => {
              const current = normalizeSurfaceStatus(editedSurfaces[surface])
              const color = current && current !== 'healthy' ? statusColor(current) : undefined
              return (
                <button
                  key={surface}
                  type="button"
                  onClick={() => paintSurface(surface)}
                  className={cn(
                    'px-1 sm:px-2 py-2 sm:py-3 rounded-lg sm:rounded-xl border transition-all flex flex-col items-center gap-0.5 sm:gap-1',
                    color ? 'border-white/20' : 'border-bdr-subtle bg-surface-2 hover:bg-white/[0.07]',
                  )}
                  style={color ? { background: `${color}33`, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
                >
                  <span className="text-xs sm:text-sm font-bold text-txt-primary">{surface}</span>
                  <span className="text-[7px] sm:text-[9px] text-txt-muted leading-none">
                    {surface === 'M' && t('diagnostics.surface_med')}
                    {surface === 'O' && t('diagnostics.surface_occl')}
                    {surface === 'D' && t('diagnostics.surface_dist')}
                    {surface === 'B' && t('diagnostics.surface_bucc')}
                    {surface === 'L' && t('diagnostics.surface_ling')}
                  </span>
                  <span className="text-[8px] sm:text-[10px] font-semibold leading-none" style={{ color: color || T.slate }}>
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
          {t('common.cancel')}
        </Button>
        <Button size="sm" onClick={handleSave} icon={<Check size={14} />}>
          {t('common.save')}
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
  const { t } = useTranslation()
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
      const prompt = aiPlanPrompt(patientId, patientName || t('crm.patient_fallback'), teeth)
      navigate('/', { state: { aiQuery: prompt } })
    })
  }

  if (recommendations.length === 0) {
    return (
      <Card className="p-4 mt-3 space-y-3">
        <div className="text-center text-sm text-emerald-400">
          {t('diagnostics.no_active_issues')}
        </div>
      </Card>
    )
  }

  const total = recommendations.reduce((s, r) => s + r.estimatedPrice, 0)

  return (
    <Card className="p-4 mt-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-dv-gold">{t('diagnostics.plan_from_odontogram')}</span>
          <Badge variant="warning">{recommendations.length}</Badge>
        </div>
        <span className="text-[11px] text-txt-muted">
          {t('diagnostics.estimate')} ~{new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(total)}
        </span>
      </div>

      <p className="text-[11px] text-txt-muted whitespace-pre-wrap m-0 max-h-24 overflow-y-auto opacity-80">
        {summary}
      </p>

      <div className="flex flex-col gap-2">
        {recommendations.map((rec, idx) => (
          <div
            key={`${rec.tooth}-${idx}`}
            className="px-3 py-2.5 rounded-xl border border-bdr-subtle bg-surface-1 flex justify-between items-center gap-2"
          >
            <div className="min-w-0">
              <p className="text-xs text-txt-primary font-semibold m-0">
                {t('diagnostics.plan_recommendation', { tooth: rec.tooth, procedure: rec.procedure })}
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
              {rec.urgency === 'high' ? t('diagnostics.urgency_urgent') : rec.urgency === 'medium' ? t('diagnostics.urgency_recommended') : t('diagnostics.urgency_planned')}
            </Badge>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button size="sm" onClick={() => void savePlan()} disabled={busy}>
          {busy ? t('diagnostics.saving') : t('diagnostics.add_to_treatment_plan')}
        </Button>
        {patientId && clinicId && (
          <Button size="sm" variant="secondary" icon={<Sparkles size={14} />} onClick={openAiPlan} disabled={busy}>
            {t('diagnostics.save_and_ai')}
          </Button>
        )}
      </div>
      <p className="text-[10px] text-txt-muted m-0">
        {t('diagnostics.ai_optional_hint')}
      </p>
    </Card>
  )
}

export function ToothLegend() {
  return (
    <div className="flex gap-1.5 sm:gap-2 md:gap-3 flex-wrap py-1 sm:py-2">
      {Object.entries(STATUS_META).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] md:text-[11px] text-txt-muted">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm shrink-0" style={{ background: value.color }} />
          {value.label}
        </div>
      ))}
    </div>
  )
}

export default Odontogram3D
