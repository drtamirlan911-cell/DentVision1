import React from 'react'
import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'h-8 text-xs px-2.5',
  md: 'h-10 text-sm px-3',
  lg: 'h-12 text-sm px-4',
}

function DatePicker({ label, error, size = 'md', className, ...props }: DatePickerProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-txt-secondary">{label}</label>
      )}
      <div className="relative">
        <input
          type="date"
          className={cn(
            'w-full rounded-lg border bg-surface-raised text-txt-primary transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-dv-gold/40 focus:border-dv-gold',
            'placeholder:text-txt-ghost',
            error ? 'border-error/40' : 'border-bdr-subtle hover:border-bdr',
            sizeStyles[size],
            'pr-9',
            className
          )}
          {...props}
        />
        <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-ghost pointer-events-none" />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

export { DatePicker }
export type { DatePickerProps }
