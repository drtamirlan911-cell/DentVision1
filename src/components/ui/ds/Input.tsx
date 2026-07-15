import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  suffix?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, suffix, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-txt-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              'flex h-9 w-full rounded-lg border bg-white/[0.03] px-3 py-2 text-sm text-txt-primary',
              'border-bdr-subtle placeholder:text-txt-muted',
              'transition-colors duration-200',
              'focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-9',
              suffix && 'pr-9',
              error && 'border-error/50 focus:border-error focus:ring-error/20',
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted">
              {suffix}
            </span>
          )}
        </div>
        {error && (
          <p className="text-xs text-error">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-txt-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border bg-white/[0.03] px-3 py-2 text-sm text-txt-primary',
            'border-bdr-subtle placeholder:text-txt-muted',
            'transition-colors duration-200 resize-none',
            'focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error/50 focus:border-error focus:ring-error/20',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-error">{error}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-txt-secondary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-lg border bg-white/[0.03] px-3 py-2 text-sm text-txt-primary',
            'border-bdr-subtle appearance-none',
            'transition-colors duration-200',
            'focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-error/50 focus:border-error focus:ring-error/20',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="bg-surface-1 text-txt-muted">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface-1 text-txt-primary">
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-error">{error}</p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Input, Textarea, Select }
