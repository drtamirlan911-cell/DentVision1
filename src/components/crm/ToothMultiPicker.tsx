import React from 'react'
import { UPPER, LOWER } from '@/utils/constants'
import { cn } from '@/lib/utils'

interface ToothMultiPickerProps {
  selected: number[]
  onChange: (teeth: number[]) => void
  className?: string
  compact?: boolean
}

function toggleTooth(selected: number[], tooth: number): number[] {
  return selected.includes(tooth)
    ? selected.filter((n) => n !== tooth)
    : [...selected, tooth].sort((a, b) => a - b)
}

function ToothButton({
  num,
  active,
  compact,
  onClick,
}: {
  num: number
  active: boolean
  compact?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border text-center font-semibold transition-colors',
        compact ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs',
        active
          ? 'bg-dv-gold/25 border-dv-gold text-dv-gold'
          : 'bg-white/5 border-white/10 text-txt-secondary hover:border-dv-gold/40 hover:text-txt-primary',
      )}
      title={`Зуб ${num}`}
    >
      {num}
    </button>
  )
}

export function ToothMultiPicker({ selected, onChange, className, compact }: ToothMultiPickerProps) {
  const renderRow = (teeth: readonly number[]) => (
    <div className="flex flex-wrap gap-1 justify-center">
      {teeth.map((num) => (
        <ToothButton
          key={num}
          num={num}
          active={selected.includes(num)}
          compact={compact}
          onClick={() => onChange(toggleTooth(selected, num))}
        />
      ))}
    </div>
  )

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-txt-muted">Выбор зубов FDI</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-[11px] text-dv-gold hover:underline"
            onClick={() => onChange([...UPPER, ...LOWER])}
          >
            Все
          </button>
          <button
            type="button"
            className="text-[11px] text-txt-muted hover:text-txt-primary"
            onClick={() => onChange([])}
          >
            Сброс
          </button>
        </div>
      </div>
      <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-2">
        <p className="text-[10px] text-center text-txt-muted">Верхняя челюсть</p>
        {renderRow(UPPER)}
        <div className="h-px bg-white/10 my-1" />
        <p className="text-[10px] text-center text-txt-muted">Нижняя челюсть</p>
        {renderRow(LOWER)}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-txt-secondary">
          Выбрано: <span className="text-dv-gold font-medium">{selected.join(', ')}</span>
        </p>
      )}
    </div>
  )
}
