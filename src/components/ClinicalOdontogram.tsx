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

function archPoint(index: number, count: number, upper: boolean) {
  const t = count <= 1 ? 0.5 : index / (count - 1)
  const x = 5 + t * 90
  const edgeY = upper ? 27 : 73
  const centerY = upper ? 45 : 55
  const curve = 1 - Math.pow(Math.abs(t - 0.5) * 2, 1.55)
  const y = edgeY + (centerY - edgeY) * curve
  const rotation = (upper ? 1 : -1) * (t - 0.5) * 20
  return { left: x, top: y, rotation }
}

function ArchTooth({
  n, index, count, upper, patientTeeth, selectedTooth, tool, onApplyStatus, onToothClick, toothSize,
}: {
  n: number
  index: number
  count: number
  upper: boolean
  patientTeeth: PatientTeeth
  selectedTooth?: number
  tool: ToothStatusKey | null
  onApplyStatus?: (n: number, s: string) => void
  onToothClick: (n: number) => void
  toothSize: number
}) {
  const t = normalizeTooth(patientTeeth[n] ?? patientTeeth[String(n)])
  const active = selectedTooth === n
  const p = archPoint(index, count, upper)

  return (
    <div
      key={n}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${p.left}%`, top: `${p.top}%` }}
    >
      <div style={{ transform: `rotate(${p.rotation}deg)` }}>
        <AnatomicalToothSvg
          toothNumber={n}
          status={t.status}
          surfaces={t.surfaces}
          selected={active}
          size={toothSize}
          view="buccal"
          showLabels={false}
          onClick={() => {
            if (tool && onApplyStatus) onApplyStatus(n, tool)
            onToothClick(n)
          }}
        />
      </div>
      <span className={cn(
        'pointer-events-none absolute whitespace-nowrap text-[8px] tabular-nums sm:text-[10px]',
        upper ? '-bottom-5 sm:-bottom-6' : '-top-5 sm:-top-6',
        active ? 'font-semibold text-dv-gold' : 'text-txt-muted',
      )}>{n}</span>
      {Object.keys(t.surfaces || {}).length > 0 && (
        <span className={cn(
          'pointer-events-none absolute whitespace-nowrap text-[7px] text-txt-muted/80',
          upper ? '-bottom-8' : '-top-8',
        )}>{Object.keys(t.surfaces || {}).join(' · ')}</span>
      )}
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
  const [toothSize, setToothSize] = useState(30)

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth
      setToothSize(w < 430 ? 22 : w < 640 ? 25 : w < 1024 ? 30 : 34)
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
            <div className="mb-2 flex items-center justify-center gap-3 text-[9px] uppercase tracking-[.16em] text-txt-muted">
              <span>Верхняя челюсть</span>
              <span className="text-dv-gold/70">FDI · пациентский вид</span>
              <span>Нижняя челюсть</span>
            </div>
            <div className="relative mx-auto aspect-[1.9/1] min-h-[245px] w-full max-w-[1080px] overflow-visible">
              <div className="pointer-events-none absolute left-1/2 top-[10%] bottom-[10%] -translate-x-1/2 border-l border-dashed border-dv-gold/30" aria-hidden />
              <div className="pointer-events-none absolute left-[5%] right-[5%] top-1/2 border-t border-bdr-subtle/60" aria-hidden />
              {upper.map((n, index) => <ArchTooth key={n} n={n} index={index} count={upper.length} upper patientTeeth={patientTeeth} selectedTooth={selectedTooth} tool={tool} onApplyStatus={onApplyStatus} onToothClick={onToothClick} toothSize={toothSize} />)}
              {lower.map((n, index) => <ArchTooth key={n} n={n} index={index} count={lower.length} upper={false} patientTeeth={patientTeeth} selectedTooth={selectedTooth} tool={tool} onApplyStatus={onApplyStatus} onToothClick={onToothClick} toothSize={toothSize} />)}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] text-txt-muted">
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
