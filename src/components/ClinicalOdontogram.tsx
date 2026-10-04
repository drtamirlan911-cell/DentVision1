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

function pointOnArch(index: number, count: number, upper: boolean, rx: number, ry: number) {
  const t = index / Math.max(1, count - 1)
  const angle = upper ? Math.PI + t * Math.PI : Math.PI - t * Math.PI
  return { left: 50 + Math.cos(angle) * rx, top: upper ? 47 + Math.sin(angle) * ry : 53 + Math.sin(angle) * ry }
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
  const [toothSize, setToothSize] = useState(42)

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth
      setToothSize(w < 430 ? 26 : w < 640 ? 31 : w < 1024 ? 38 : 46)
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
          <div className="relative mx-auto aspect-[1.15/1] w-full max-w-[780px] min-h-[390px] overflow-visible rounded-3xl border border-bdr-subtle bg-surface-1/40">
            <div className="absolute left-1/2 top-[47%] h-[68%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dv-gold/10" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden>
              <path d="M55 255 Q300 20 545 255" fill="none" stroke="currentColor" strokeOpacity=".13" strokeWidth="2" />
              <path d="M55 275 Q300 500 545 275" fill="none" stroke="currentColor" strokeOpacity=".13" strokeWidth="2" />
              <path d="M95 260 Q300 80 505 260" fill="none" stroke="currentColor" strokeOpacity=".06" strokeWidth="10" strokeLinecap="round" />
              <path d="M95 270 Q300 440 505 270" fill="none" stroke="currentColor" strokeOpacity=".06" strokeWidth="10" strokeLinecap="round" />
              <line x1="300" y1="40" x2="300" y2="480" stroke="currentColor" strokeOpacity=".05" strokeDasharray="4 7" />
            </svg>

            <div className="absolute left-3 top-3 rounded-lg border border-bdr-subtle bg-surface-1/80 px-2 py-1 text-[9px] uppercase tracking-[.14em] text-txt-muted">Верхняя</div>
            <div className="absolute bottom-3 left-3 rounded-lg border border-bdr-subtle bg-surface-1/80 px-2 py-1 text-[9px] uppercase tracking-[.14em] text-txt-muted">Нижняя</div>

            {upper.map((n, i) => renderTooth(n, i, true))}
            {lower.map((n, i) => renderTooth(n, i, false))}

            <div className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-[9px] uppercase tracking-[.18em] text-txt-muted/60">FDI</div>
              <div className="mt-1 text-[10px] text-txt-muted/50">выберите зуб</div>
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
