import React from 'react'
import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'
import { ChevronDown, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const inputVariants = cva(
  'flex w-full rounded-lg border bg-white/[0.03] text-sm text-txt-primary border-bdr-subtle placeholder:text-txt-muted transition-all duration-200 focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-8 px-2.5 py-1.5',
        md: 'h-9 px-3 py-2',
        lg: 'h-10 px-3.5 py-2.5',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-lg border bg-white/[0.03] text-sm text-txt-primary border-bdr-subtle placeholder:text-txt-muted transition-all duration-200 resize-none focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-3 py-2',
        lg: 'px-3.5 py-2.5 text-base',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

const selectVariants = cva(
  'flex w-full rounded-lg border bg-white/[0.03] text-sm text-txt-primary border-bdr-subtle transition-all duration-200 appearance-none focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-8 px-2.5 py-1.5 pr-9',
        md: 'h-9 px-3 py-2 pr-9',
        lg: 'h-10 px-3.5 py-2.5 pr-9',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  icon?: React.ReactNode
  suffix?: React.ReactNode
  clearable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, suffix, clearable, size = 'md', ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = props.id || generatedId
    const inputNodeRef = React.useRef<HTMLInputElement | null>(null)
    const [hasValue, setHasValue] = React.useState(() => {
      const v = props.value ?? props.defaultValue ?? ''
      return String(v).length > 0
    })

    React.useEffect(() => {
      if (props.value !== undefined) {
        setHasValue(String(props.value).length > 0)
      }
    }, [props.value])

    const refCallback = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputNodeRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
      },
      [ref]
    )

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value.length > 0)
      props.onChange?.(e)
    }

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (inputNodeRef.current) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set
        setter?.call(inputNodeRef.current, '')
        inputNodeRef.current.dispatchEvent(new Event('input', { bubbles: true }))
        inputNodeRef.current.focus()
      }
      setHasValue(false)
    }

    const showClear = clearable && hasValue
    const showSuffix = !!suffix
    const rightPad = showSuffix && showClear ? 'pr-12' : showSuffix || showClear ? 'pr-9' : ''

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-txt-secondary">
            {label}
          </label>
        )}
        <div className="relative rounded-lg transition-shadow duration-200 focus-within:shadow-glow-sm">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted">
              {icon}
            </span>
          )}
          <input
            ref={refCallback}
            id={inputId}
            className={cn(
              inputVariants({ size }),
              error && 'border-error/50 focus:border-error focus:ring-error/20',
              icon && 'pl-9',
              rightPad,
              props.readOnly && 'bg-white/[0.015] cursor-default',
              className
            )}
            onChange={handleChange}
            {...props}
          />
          {showSuffix && (
            <span
              className={cn(
                'absolute top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none transition-all duration-200',
                showClear ? 'right-9' : 'right-3'
              )}
            >
              {suffix}
            </span>
          )}
          <AnimatePresence>
            {showClear && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={handleClear}
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary transition-colors',
                  showSuffix ? 'right-3' : 'right-3'
                )}
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-error"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  showCount?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, showCount, size = 'md', ...props }, ref) => {
    const generatedId = React.useId()
    const textareaId = props.id || generatedId
    const [count, setCount] = React.useState(() => {
      const v = props.value ?? props.defaultValue ?? ''
      return String(v).length
    })

    React.useEffect(() => {
      if (props.value !== undefined) {
        setCount(String(props.value).length)
      }
    }, [props.value])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCount(e.target.value.length)
      props.onChange?.(e)
    }

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-medium text-txt-secondary">
            {label}
          </label>
        )}
        <div className="relative rounded-lg transition-shadow duration-200 focus-within:shadow-glow-sm">
          <textarea
            ref={ref}
            id={textareaId}
            className={cn(
              textareaVariants({ size }),
              error && 'border-error/50 focus:border-error focus:ring-error/20',
              props.readOnly && 'bg-white/[0.015] cursor-default',
              showCount && props.maxLength && 'pb-7',
              className
            )}
            onChange={handleChange}
            {...props}
          />
          {showCount && props.maxLength && (
            <span className="absolute bottom-2 right-3 text-2xs text-txt-muted pointer-events-none">
              {count}/{props.maxLength}
            </span>
          )}
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-error"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, size = 'md', ...props }, ref) => {
    const generatedId = React.useId()
    const selectId = props.id || generatedId

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-txt-secondary">
            {label}
          </label>
        )}
        <div className="relative rounded-lg transition-shadow duration-200 focus-within:shadow-glow-sm">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              selectVariants({ size }),
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
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted"
          />
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-error"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Input, Textarea, Select }
