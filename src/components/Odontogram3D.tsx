// ═══════════════════════════════════════════════════════════════════
// ODONTOGRAM — anatomical teeth + fast surface/status editor + plan
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { T } from '../utils/constants'
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
  archTeeth,
  type Dentition,
  type ToothStatusKey,
  type ToothSurfaces,
  type ToothData,
  type PatientTeeth,
  type SurfaceKey,
  type PlanRecommendation,
} from '@/lib/odontogram'
import { Sparkles, Check, X, History, Pencil, Camera, Trash2 } from 'lucide-react'

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

/** A status swatch drawn the way the tooth itself is marked, so the toolbar and
 *  the chart teach the same vocabulary. */
function StatusSwatch({ status }: { status: string }) {
  const color = STATUS_META[status]?.color || 'currentColor'
  const common = { style: { '--sw': color } as React.CSSProperties }
  if (status === 'crown') {
    return <span {...common} className="w-3 h-3 rounded-[3px] border-[1.5px] border-[var(--sw)] shrink-0" />
  }
  if (status === 'missing') {
    return <span {...common} className="w-3 h-3 rounded-full border-[1.5px] border-dashed border-[var(--sw)] shrink-0" />
  }
  if (status === 'extracted') {
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" {...common} aria-hidden>
        <path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" stroke="var(--sw)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    )
  }
  if (status === 'fracture') {
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" {...common} aria-hidden>
        <path d="M7.5 1.5 L4.5 5 L7 6.5 L4 10.5" stroke="var(--sw)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    )
  }
  if (status === 'implant') {
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" {...common} aria-hidden>
        <circle cx="6" cy="6" r="4.6" fill="none" stroke="var(--sw)" strokeWidth="1.5" />
        <circle cx="6" cy="6" r="1.7" fill="var(--sw)" />
      </svg>
    )
  }
  return <span {...common} className="w-3 h-3 rounded-full bg-[var(--sw)] shrink-0" />
}

interface ChartToolButtonProps {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ChartToolButton({ label, active, onClick, children }: ChartToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 min-w-[62px] transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50',
        active ? 'bg-dv-gold/12 text-txt-primary ring-1 ring-dv-gold/40' : 'text-txt-secondary hover:bg-surface-2',
      )}
    >
      {children}
      <span className="text-[10px] leading-none whitespace-nowrap">{label}</span>
    </button>
  )
}

/** Actions that are not a status — they operate on the selected tooth. */
export type ChartAction = 'note' | 'photo' | 'clear'

interface Odontogram3DProps {
  patientTeeth?: PatientTeeth
  onToothClick: (toothNumber: number) => void
  selectedTooth?: number
  /** Permanent (default) or primary dentition. Uncontrolled if no handler. */
  dentition?: Dentition
  onDentitionChange?: (next: Dentition) => void
  /** Tool-first editing: pick a status, then click teeth to stamp it. */
  activeTool?: string | null
  onToolChange?: (next: string | null) => void
  onApplyStatus?: (toothNumber: number, status: string) => void
  onAction?: (action: ChartAction, toothNumber?: number) => void
  onHistoryClick?: () => void
  /** The toolbar is part of the chart; hide it where the chart is read-only. */
  showToolbar?: boolean
}

export function Odontogram3D({
  patientTeeth = {},
  onToothClick,
  selectedTooth,
  dentition,
  onDentitionChange,
  activeTool,
  onToolChange,
  onApplyStatus,
  onAction,
  onHistoryClick,
  showToolbar = true,
}: Odontogram3DProps) {
  const { t } = useTranslation()
  const [ownDentition, setOwnDentition] = useState<Dentition>('permanent')
  const [ownTool, setOwnTool] = useState<string | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  const mode: Dentition = dentition ?? ownDentition
  const setMode = (next: Dentition) => (onDentitionChange ? onDentitionChange(next) : setOwnDentition(next))
  const tool = activeTool !== undefined ? activeTool : ownTool
  const setTool = (next: string | null) => (onToolChange ? onToolChange(next) : setOwnTool(next))

  const [toothSize, setToothSize] = useState(38)
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth
      setToothSize(w < 480 ? 22 : w < 768 ? 27 : w < 1280 ? 33 : 38)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const upperTeeth = archTeeth(mode, true)
  const lowerTeeth = archTeeth(mode, false)
  const half = upperTeeth.length / 2
  const cell = toothSize + 10

  const toothOf = (n: number) => normalizeTooth(patientTeeth[n] ?? patientTeeth[String(n)])

  /** A tool stamps directly; without one the click selects, as it always did. */
  const handleTooth = (n: number) => {
    if (tool && onApplyStatus) {
      onApplyStatus(n, tool)
      return
    }
    onToothClick(n)
  }

  const Midline = () => (
    <div className="w-px self-stretch shrink-0 mx-1.5 md:mx-2.5 bg-bdr-subtle" aria-hidden />
  )

  const numberRow = (teeth: readonly number[], key: string) => (
    <div className="flex items-center justify-center" key={key}>
      {teeth.slice(0, half).map((n) => (
        <span
          key={n}
          style={{ width: cell }}
          className={cn(
            'text-center text-[10px] tabular-nums leading-none shrink-0',
            selectedTooth === n || hovered === n ? 'text-dv-gold font-semibold' : 'text-txt-muted',
          )}
        >
          {n}
        </span>
      ))}
      <Midline />
      {teeth.slice(half).map((n) => (
        <span
          key={n}
          style={{ width: cell }}
          className={cn(
            'text-center text-[10px] tabular-nums leading-none shrink-0',
            selectedTooth === n || hovered === n ? 'text-dv-gold font-semibold' : 'text-txt-muted',
          )}
        >
          {n}
        </span>
      ))}
    </div>
  )

  const toothRow = (teeth: readonly number[], view: 'buccal' | 'occlusal', upper: boolean) => (
    <div className={cn('flex justify-center', upper ? 'items-end' : 'items-start')}>
      {teeth.slice(0, half).map((n) => {
        const d = toothOf(n)
        return (
          <div key={n} style={{ width: cell }} className="flex justify-center shrink-0">
            <AnatomicalToothSvg
              toothNumber={n}
              status={d.status}
              surfaces={d.surfaces}
              selected={selectedTooth === n}
              onClick={() => handleTooth(n)}
              onHover={setHovered}
              size={toothSize}
              view={view}
              showLabels={false}
            />
          </div>
        )
      })}
      <Midline />
      {teeth.slice(half).map((n) => {
        const d = toothOf(n)
        return (
          <div key={n} style={{ width: cell }} className="flex justify-center shrink-0">
            <AnatomicalToothSvg
              toothNumber={n}
              status={d.status}
              surfaces={d.surfaces}
              selected={selectedTooth === n}
              onClick={() => handleTooth(n)}
              onHover={setHovered}
              size={toothSize}
              view={view}
              showLabels={false}
            />
          </div>
        )
      })}
    </div>
  )

  /** R/L side markers, as on a printed chart. */
  const sideLabel = (side: 'R' | 'L', jaw: string) => (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-bdr-subtle px-2 py-2 shrink-0">
      <span className="text-xs font-semibold text-txt-secondary leading-none">{side}</span>
      <span className="text-[9px] text-txt-muted leading-none">{jaw}</span>
    </div>
  )

  const archBlock = (teeth: readonly number[], view: 'buccal' | 'occlusal', upper: boolean, jaw: string) => (
    <div className="flex items-stretch justify-center gap-2 md:gap-3">
      {sideLabel('R', jaw)}
      <div className="flex-1 min-w-0 flex justify-center">{toothRow(teeth, view, upper)}</div>
      {sideLabel('L', jaw)}
    </div>
  )

  const hoveredMorph = hovered ? getToothMorphology(hovered) : null
  const selectedMorph = selectedTooth ? getToothMorphology(selectedTooth) : null
  const tipTooth = hovered ?? selectedTooth
  const tipMorph = hoveredMorph ?? selectedMorph
  const tipStatus = tipTooth ? toothOf(tipTooth).status : undefined

  const STATUS_TOOLS_PRIMARY = ['caries', 'filled', 'crown', 'implant']
  const STATUS_TOOLS_SECONDARY = ['extracted', 'fracture', 'inflammation', 'missing']
  /** Everything else the model knows — kept reachable, not dropped. */
  const STATUS_TOOLS_MORE = WHOLE_TOOTH_STATUSES.filter(
    (s) => !STATUS_TOOLS_PRIMARY.includes(s) && !STATUS_TOOLS_SECONDARY.includes(s) && s !== 'healthy',
  )

  return (
    <Card padding="none" className="overflow-hidden max-w-full">
      {/* ── Header: title · dentition · history ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-5">
        <h3 className="text-base font-semibold text-txt-primary m-0">{t('diagnostics.odontogram')}</h3>

        <div className="flex items-center gap-1 rounded-lg border border-bdr-subtle p-0.5">
          {(['permanent', 'primary'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50',
                mode === m ? 'bg-surface-2 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary',
              )}
            >
              {m === 'permanent' ? t('diagnostics.permanent_teeth') : t('diagnostics.primary_teeth')}
            </button>
          ))}
        </div>

        {onHistoryClick ? (
          <Button size="sm" variant="secondary" onClick={onHistoryClick} icon={<History size={14} />}>
            {t('diagnostics.change_history')}
          </Button>
        ) : (
          <span className="text-[11px] text-txt-muted">
            {tool ? t('diagnostics.tool_hint_active', { tool: STATUS_META[tool]?.label || tool }) : t('diagnostics.click_status')}
          </span>
        )}
      </div>

      {/* ── The chart ── */}
      <div className="overflow-x-auto overscroll-x-contain px-3 pb-2 md:px-5">
        <div className="min-w-max mx-auto space-y-1.5 py-2">
          {numberRow(upperTeeth, 'up-top')}
          {archBlock(upperTeeth, 'buccal', true, t('diagnostics.jaw_upper_short'))}
          {numberRow(upperTeeth, 'up-bottom')}

          <div className="h-2" />
          {toothRow(upperTeeth, 'occlusal', true)}
          {toothRow(lowerTeeth, 'occlusal', false)}
          <div className="h-2" />

          {numberRow(lowerTeeth, 'low-top')}
          {archBlock(lowerTeeth, 'buccal', false, t('diagnostics.jaw_lower_short'))}
          {numberRow(lowerTeeth, 'low-bottom')}
        </div>
      </div>

      {tipTooth && tipMorph && (
        <p className="px-4 md:px-5 pb-1 text-center text-[11px] text-txt-secondary m-0">
          {t('diagnostics.tooth')} <span className="text-dv-gold font-semibold">{tipTooth}</span>
          {' · '}
          {tipMorph.label}
          {tipStatus && tipStatus !== 'healthy' ? ` · ${STATUS_META[tipStatus]?.label || tipStatus}` : ''}
        </p>
      )}

      {/* ── Toolbar ── */}
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 md:px-5 py-3">
          <div className="flex items-center gap-1 rounded-xl border border-bdr-subtle p-1">
            {STATUS_TOOLS_PRIMARY.map((s) => (
              <ChartToolButton key={s} label={STATUS_META[s].label} active={tool === s} onClick={() => setTool(tool === s ? null : s)}>
                <StatusSwatch status={s} />
              </ChartToolButton>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-bdr-subtle p-1">
            {STATUS_TOOLS_SECONDARY.map((s) => (
              <ChartToolButton key={s} label={STATUS_META[s].label} active={tool === s} onClick={() => setTool(tool === s ? null : s)}>
                <StatusSwatch status={s} />
              </ChartToolButton>
            ))}
          </div>

          {/* Rendered only when the host actually handles them — a chart button
              that does nothing is worse than one that isn't there. */}
          {onAction && (
            <div className="flex items-center gap-1 rounded-xl border border-bdr-subtle p-1">
              <ChartToolButton label={t('diagnostics.action_note')} onClick={() => onAction('note', selectedTooth)}>
                <Pencil size={13} className="text-txt-secondary" />
              </ChartToolButton>
              <ChartToolButton label={t('diagnostics.action_photo')} onClick={() => onAction('photo', selectedTooth)}>
                <Camera size={13} className="text-txt-secondary" />
              </ChartToolButton>
              <ChartToolButton label={t('diagnostics.action_clear')} onClick={() => onAction('clear', selectedTooth)}>
                <Trash2 size={13} className="text-txt-secondary" />
              </ChartToolButton>
            </div>
          )}

          {/* Statuses beyond the reference set stay reachable rather than lost. */}
          {STATUS_TOOLS_MORE.length > 0 && (
            <div className="flex items-center gap-1 rounded-xl border border-bdr-subtle p-1">
              {STATUS_TOOLS_MORE.map((s) => (
                <ChartToolButton key={s} label={STATUS_META[s]?.label || s} active={tool === s} onClick={() => setTool(tool === s ? null : s)}>
                  <StatusSwatch status={s} />
                </ChartToolButton>
              ))}
            </div>
          )}
        </div>
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
  const [notes, setNotes] = useState<string>(initial.notes || '')

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
      notes: notes.trim() ? notes.trim() : null,
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
                  active
                    ? 'border-transparent bg-[var(--status-color)] text-white'
                    : 'border-bdr-subtle text-txt-secondary hover:bg-surface-1',
                )}
                style={(active ? { '--status-color': meta.color } : undefined) as unknown as React.CSSProperties}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-sm shrink-0',
                    active ? 'bg-white/90' : 'bg-[var(--status-color)]',
                  )}
                  style={(!active ? { '--status-color': meta.color } : undefined) as unknown as React.CSSProperties}
                />
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

      {/* Tooth-level note — the chart toolbar's «Заметка» lands here, and the
          model already carried `notes`; nothing else was reading it. */}
      <div>
        <label
          htmlFor={`tooth-note-${toothNumber}`}
          className="block text-[9px] sm:text-[10px] uppercase tracking-wide text-txt-muted font-semibold mb-1.5"
        >
          {t('diagnostics.action_note')}
        </label>
        <textarea
          id={`tooth-note-${toothNumber}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-bdr-subtle bg-surface-1 px-2.5 py-2 text-xs text-txt-primary placeholder:text-txt-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50"
        />
      </div>

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
