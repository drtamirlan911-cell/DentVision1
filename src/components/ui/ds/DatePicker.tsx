import React from 'react'
import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
  /** Text shown when no date is picked yet. */
  placeholder?: string
}

const sizeStyles = {
  sm: 'h-8 text-xs px-2.5',
  md: 'h-10 text-sm px-3',
  lg: 'h-12 text-sm px-4',
}

/**
 * Formats the `YYYY-MM-DD` value a date input carries into `dd.mm.yyyy`.
 *
 * Deliberately string-based: `new Date('2026-08-17')` parses as UTC midnight,
 * so anyone west of Greenwich would render the previous day.
 */
export function formatDateValue(value: unknown): string {
  const raw = typeof value === 'string' ? value : ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!m) return ''
  const [, y, mo, d] = m
  return `${d}.${mo}.${y}`
}

function DatePicker({ label, error, size = 'md', className, placeholder = 'дд.мм.гггг', ...props }: DatePickerProps) {
  const shown = formatDateValue(props.value)

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-txt-secondary">{label}</label>
      )}
      <div className="relative">
        <input
          type="date"
          className={cn(
            'dv-date-native w-full rounded-lg border bg-surface-raised text-txt-primary transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-dv-gold/40 focus:border-dv-gold',
            'placeholder:text-txt-ghost',
            error ? 'border-error/40' : 'border-bdr-subtle hover:border-bdr',
            sizeStyles[size],
            'pr-9',
            className,
          )}
          {...props}
        />
        {/* Painted over the input, which keeps the native picker underneath. */}
        <span
          aria-hidden="true"
          className={cn(
            'dv-date-label pointer-events-none absolute inset-y-0 left-0 flex items-center',
            shown ? 'text-txt-primary' : 'text-txt-ghost',
            size === 'sm' ? 'pl-2.5 text-xs' : size === 'lg' ? 'pl-4 text-sm' : 'pl-3 text-sm',
          )}
        >
          {shown || placeholder}
        </span>
        <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-ghost pointer-events-none" />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

export { DatePicker }
export type { DatePickerProps }
