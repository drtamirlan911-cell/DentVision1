import React, { useEffect, useMemo, useState } from 'react'
import { Activity, ChevronDown, FileText, Image as ImageIcon, RotateCcw, Stethoscope } from 'lucide-react'
import { Card } from './ui/ds/Card'
import { Button } from './ui/ds/Button'
import { Badge } from './ui/ds/Badge'
import { AnatomicalToothSvg } from './odontogram/AnatomicalToothSvg'
import { SurfaceEditor } from './Odontogram3D'
import { archTeeth, normalizeTooth, STATUS_META, statusLabel, type Dentition, type PatientTeeth, type ToothData, type ToothStatusKey } from '@/lib/odontogram'
import { cn } from '@/lib/utils'

interface Props {
  patientTeeth?: PatientTeeth
  selectedTooth?: number
  onToothClick: (n: number) => void
  onApplyStatus?: (n: number, s: string) => void
  onToothDataChange?: (n: number, d: ToothData) => void
  onAction?: (a: 'note' | 'photo' | 'clear', n?: number) => void
  dentition?: Dentition
  onDentitionChange?: (d: Dentition) => void
}

const STATUS_TOOLS: ToothStatusKey[] = ['caries', 'filled', 'crown', 'implant', 'fracture', 'inflammation', 'missing', 'root', 'veneer', 'endo_ok', 'endo_fail']

function toothColumnClass(index: number) {
  if (index < 2 || index > 13) return 'scale-[0.92]'
  if (index < 4 || index > 11) return 'scale-[0.96]'
  return 'scale-100'
}

function ToothRow({
  teeth, upper, patientTeeth, selectedTooth, tool, onApplyStatus, onToothClick, toothSize,
}: {
  teeth: number[]
  upper: boolean
  patientTeeth: PatientTeeth
  selectedTooth?: number
  tool: ToothStatusKey | null
  onApplyStatus?: (n: number, s: string) => void
  onToothClick: (n: number) => void
  toothSize: number
}) {
  return (
    <div className={cn('grid grid-cols-16 items-center gap-0.5 sm:gap-1 md:gap-1.5 px-1 sm:px-3', !upper && 'mt-5 sm:mt-7')}>
      {teeth.map((n, index) => {
        const t = normalizeTooth(patientTeeth[n] ?? patientTeeth[String(n)])
        const active = selectedTooth === n
        return (
          <div key={n} className={cn('relative flex min-w-0 flex-col items-center justify-center', toothColumnClass(index))}>
            <span className={cn('mb-1 text-[8px] sm:text-[10px] tabular-nums', active ? 'font-bold text-dv-gold' : 'text-txt-muted')}>{n}</span>
            <button
              type="button"
              aria-label={`Зуб ${n}${t.status && t.status !== 'healthy' ? `, ${statusLabel(t.status)}` : ''}`}
              onClick={() => { if (tool && onApplyStatus) onApplyStatus(n, tool); onToothClick(n) }}
              className={cn('relative rounded-xl p-0 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/70', active && 'z-20 scale-110', !active && 'hover:scale-105')}
            >
              {active && <span className="absolute -inset-1 rounded-xl border border-dv-gold/80 bg-dv-gold/10" />}
              <span className="relative block">
                <AnatomicalToothSvg toothNumber={n} status={t.status} surfaces={t.surfaces} selected={active} size={toothSize} view="buccal" showLabels={false} />
              </span>
            </button>
            <div className="mt-1 flex h-3 items-center justify-center gap-0.5">
              {t.status !== 'healthy' && t.status !== 'missing' && <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[t.status]?.color }} />}
              {Object.keys(t.surfaces || {}).length > 0 && <span className="text-[7px] text-txt-muted">S</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ClinicalOdontogram({
  patientTeeth = {},
  selectedTooth,
  onToothClick,
  onApplyStatus,
  onToothDataChange,
  onAction,
  dentition = 'permanent',
  onDentitionChange,
}: Props) {
  const [tool, setTool] = useState<ToothStatusKey | null>(null)
  const [open, setOpen] = useState(true)
  const [toothSize, setToothSize] = useState(34)

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth
      setToothSize(w < 430 ? 20 : w < 640 ? 24 : w < 1024 ? 30 : 34)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const upper = archTeeth(dentition, true)
  const lower = archTeeth(dentition, false)
  const selected = selectedTooth ? normalizeTooth(patientTeeth[selectedTooth] ?? patientTeeth[String(selectedTooth)]) : null
  const status = selected?.status || 'healthy'
  const diagnosis = selected?.diagnosis?.trim() || ''
  const surfaces = Object.entries(selected?.surfaces || {}).filter(([, v]) => v)
  const findings = useMemo(
    () => Object.entries(patientTeeth).filter(([, raw]) => {
      const t = normalizeTooth(raw)
      return t.status !== 'healthy' || Object.keys(t.surfaces || {}).length > 0
    }).length,
    [patientTeeth],
  )

  const renderTooth = (n: number, index: number, upperArch: boolean) => {
    const t = normalizeTooth(patientTeeth[n] ?? patientTeeth[String(n)])
    const p = pointOnArch(index, upperArch ? upper.length : lower.length, upperArch, 44, 33)
    const active = selectedTooth === n

    return (
      <div key={n} className="absolute z-10" style={{ left: `${p.left}%`, top: `${p.top}%`, transform: 'translate(-50%, -50%)' }}>
        <button
          type="button"
          aria-label={`Зуб ${n}${t.status && t.status !== 'healthy' ? `, ${statusLabel(t.status)}` : ''}`}
          onClick={() => { if (tool && onApplyStatus) onApplyStatus(n, tool); onToothClick(n) }}
          className={cn('relative rounded-2xl p-0.5 transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/70', active && 'scale-110')}
        >
          {active && <span className="absolute -inset-1.5 rounded-2xl border border-dv-gold/70 bg-dv-gold/10 shadow-[0_0_20px_rgba(201,169,110,.18)]" />}
          <span className="relative block">
            <AnatomicalToothSvg toothNumber={n} status={t.status} surfaces={t.surfaces} selected={active} size={toothSize} view="occlusal" showLabels={false} />
          </span>
        </button>
        <span className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] sm:text-[10px] tabular-nums', upperArch ? '-top-4 sm:-top-5' : '-bottom-4 sm:-bottom-5', active ? 'font-semibold text-dv-gold' : 'text-txt-muted')}>{n}</span>
      </div>
    )
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bdr-subtle px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Stethoscope size={17} className="text-dv-gold" />
            <h3 className="m-0 text-sm font-semibold text-txt-primary">Одонтограмма</h3>
            {findings > 0 && <Badge variant="warning" size="sm">{findings}</Badge>}
          </div>
          <p className="m-0 mt-0.5 text-[11px] text-txt-muted">Анатомический вид · FDI · M/O/D/B/L · выбор зуба → клинический контекст</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-bdr-subtle p-0.5">
          {(['permanent', 'primary'] as const).map((mode) => (
            <button key={mode} type="button" aria-pressed={dentition === mode} onClick={() => onDentitionChange?.(mode)} className={cn('rounded-md px-3 py-1.5 text-[11px]', dentition === mode ? 'bg-surface-2 text-txt-primary' : 'text-txt-muted')}>
              {mode === 'permanent' ? 'Постоянные' : 'Молочные'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 px-2 py-5 sm:px-4 sm:py-7">
          <div className="relative mx-auto w-full max-w-[1180px] rounded-2xl border border-bdr-subtle bg-surface-1/50 px-1 py-5 sm:px-3 sm:py-7">
            <div className="mb-3 flex items-center justify-center gap-3 text-[9px] uppercase tracking-[.16em] text-txt-muted">
              <span>Верхняя челюсть</span><span className="h-px w-8 bg-bdr-subtle" />
              <span className="text-dv-gold/70">FDI</span><span className="h-px w-8 bg-bdr-subtle" />
              <span>Нижняя челюсть</span>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <ToothRow teeth={upper} upper patientTeeth={patientTeeth} selectedTooth={selectedTooth} tool={tool} onApplyStatus={onApplyStatus} onToothClick={onToothClick} toothSize={toothSize} />
                <div className="mx-auto my-2 h-px w-[96%] bg-bdr-subtle" />
                <ToothRow teeth={[...lower].reverse()} upper={false} patientTeeth={patientTeeth} selectedTooth={selectedTooth} tool={tool} onApplyStatus={onApplyStatus} onToothClick={onToothClick} toothSize={toothSize} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-txt-muted">
              <span>M — мезиальная</span><span>O — окклюзионная</span><span>D — дистальная</span><span>B — щёчная</span><span>L — язычная</span>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-1.5">
            {STATUS_TOOLS.map((s) => (
              <button key={s} type="button" aria-pressed={tool === s} onClick={() => setTool(tool === s ? null : s)} className={cn('rounded-lg border px-2 py-1.5 text-[10px] transition-colors', tool === s ? 'border-dv-gold/50 bg-dv-gold/10 text-txt-primary' : 'border-bdr-subtle text-txt-secondary hover:bg-surface-2')}>
                <i className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: STATUS_META[s]?.color }} />
                {STATUS_META[s]?.label || statusLabel(s)}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-center text-[10px] text-txt-muted">
            {tool ? <><span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[tool]?.color }} />{STATUS_META[tool]?.label || statusLabel(tool)} → выберите зуб</> : 'Клик по зубу открывает его клинический контекст'}
          </div>
        </section>

        <aside className={cn('border-t border-bdr-subtle bg-surface-1/40 xl:border-l xl:border-t-0', !open && 'hidden xl:block')}>
          <div className="flex items-center justify-between border-b border-bdr-subtle px-4 py-3">
            <div className="flex items-center gap-2"><Activity size={15} className="text-dv-gold" /><span className="text-xs font-semibold">Клинический контекст</span></div>
            <button type="button" onClick={() => setOpen(!open)} aria-label="Свернуть"><ChevronDown size={15} className={cn(open && 'rotate-180')} /></button>
          </div>

          {!selectedTooth ? (
            <div className="px-5 py-12 text-center">
              <Stethoscope size={20} className="mx-auto mb-3 text-txt-muted" />
              <p className="m-0 text-xs text-txt-secondary">Выберите зуб</p>
              <p className="m-0 mt-1 text-[10px] text-txt-muted">Находка, поверхности, диагноз и действия появятся здесь.</p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-dv-gold">Зуб {selectedTooth}</div>
                  <div className="text-[10px] text-txt-muted">{status === 'healthy' ? 'Без отмеченных состояний' : STATUS_META[status]?.label || statusLabel(status)}</div>
                </div>
                <Badge variant={status === 'healthy' ? 'default' : 'warning'} size="sm">{status === 'healthy' ? 'Норма' : 'Находка'}</Badge>
              </div>

              <div className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3">
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-txt-muted">Клиническая оценка</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="text-[9px] uppercase tracking-wide text-txt-muted">Диагноз</div><div className="mt-1 text-[11px] text-txt-primary">{diagnosis || 'Не указан'}</div></div>
                  <div><div className="text-[9px] uppercase tracking-wide text-txt-muted">Заметка</div><div className="mt-1 line-clamp-2 text-[11px] text-txt-primary">{selected?.notes?.trim() || 'Нет заметки'}</div></div>
                </div>
                <div className="mb-2 mt-3 text-[9px] font-semibold uppercase tracking-wide text-txt-muted">Поверхности</div>
                {surfaces.length ? (
                  <div className="grid grid-cols-5 gap-1">
                    {surfaces.map(([s, v]) => <div key={s} className="rounded-lg border border-bdr-subtle p-2 text-center"><b className="text-xs">{s}</b><div className="text-[8px] text-txt-muted">{statusLabel(String(v))}</div></div>)}
                  </div>
                ) : <div className="text-[10px] text-txt-muted">Нет отметок</div>}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => onAction?.('note', selectedTooth)} icon={<FileText size={13} />}>Заметка</Button>
                <Button size="sm" variant="secondary" onClick={() => onAction?.('photo', selectedTooth)} icon={<ImageIcon size={13} />}>Фото</Button>
                <Button size="sm" variant="secondary" onClick={() => onAction?.('clear', selectedTooth)} icon={<RotateCcw size={13} />}>Сброс</Button>
              </div>

              {onToothDataChange && (
                <SurfaceEditor toothNumber={selectedTooth} tooth={patientTeeth[selectedTooth] ?? patientTeeth[String(selectedTooth)]} onSave={onToothDataChange} onCancel={() => onToothClick(selectedTooth)} />
              )}
            </div>
          )}
        </aside>
      </div>
    </Card>
  )
}

export default ClinicalOdontogram
