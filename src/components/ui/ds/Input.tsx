import React from 'react'
import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'
import { ChevronDown, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const inputVariants = cva(
  'flex w-full rounded-xl border bg-surface-raised text-sm text-txt-primary border-bdr-subtle placeholder:text-txt-muted transition-[background-color,border-color,box-shadow] duration-base ease-dv focus-visible:outline-none focus-visible:border-dv-gold/50 focus-visible:ring-2 focus-visible:ring-dv-gold/10 disabled:cursor-not-allowed disabled:opacity-50',
  { variants: { size: { sm: 'h-8 px-2.5 py-1.5', md: 'h-10 px-3 py-2', lg: 'h-11 px-3.5 py-2.5' } }, defaultVariants: { size: 'md' } }
)
const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-xl border bg-surface-raised text-sm text-txt-primary border-bdr-subtle placeholder:text-txt-muted transition-[background-color,border-color,box-shadow] duration-base ease-dv resize-none focus-visible:outline-none focus-visible:border-dv-gold/50 focus-visible:ring-2 focus-visible:ring-dv-gold/10 disabled:cursor-not-allowed disabled:opacity-50',
  { variants: { size: { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3 py-2.5', lg: 'px-3.5 py-2.5 text-base' } }, defaultVariants: { size: 'md' } }
)
const selectVariants = cva(
  'flex w-full rounded-xl border bg-surface-raised text-sm text-txt-primary border-bdr-subtle transition-[background-color,border-color,box-shadow] duration-base ease-dv appearance-none focus-visible:outline-none focus-visible:border-dv-gold/50 focus-visible:ring-2 focus-visible:ring-dv-gold/10 disabled:cursor-not-allowed disabled:opacity-50',
  { variants: { size: { sm: 'h-8 px-2.5 py-1.5 pr-9', md: 'h-10 px-3 py-2 pr-9', lg: 'h-11 px-3.5 py-2.5 pr-9' } }, defaultVariants: { size: 'md' } }
)

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> { label?: string; error?: string; icon?: React.ReactNode; suffix?: React.ReactNode; clearable?: boolean; size?: 'sm' | 'md' | 'lg' }
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, label, error, icon, suffix, clearable, size = 'md', ...props }, ref) => {
  const generatedId = React.useId(); const inputId = props.id || generatedId; const inputNodeRef = React.useRef<HTMLInputElement | null>(null)
  const [hasValue, setHasValue] = React.useState(() => String(props.value ?? props.defaultValue ?? '').length > 0)
  React.useEffect(() => { if (props.value !== undefined) setHasValue(String(props.value).length > 0) }, [props.value])
  const refCallback = React.useCallback((node: HTMLInputElement | null) => { inputNodeRef.current = node; if (typeof ref === 'function') ref(node); else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node }, [ref])
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { setHasValue(e.target.value.length > 0); props.onChange?.(e) }
  const handleClear = (e: React.MouseEvent) => { e.stopPropagation(); if (inputNodeRef.current) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set; setter?.call(inputNodeRef.current, ''); inputNodeRef.current.dispatchEvent(new Event('input', { bubbles: true })); inputNodeRef.current.focus() }; setHasValue(false) }
  const showClear = clearable && hasValue; const showSuffix = !!suffix; const rightPad = showSuffix && showClear ? 'pr-12' : showSuffix || showClear ? 'pr-9' : ''
  return <div className="space-y-1.5">{label && <label htmlFor={inputId} className="block text-xs font-medium text-txt-secondary">{label}</label>}<div className="relative rounded-xl transition-[border-color,box-shadow] duration-base ease-dv">{icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted">{icon}</span>}<input ref={refCallback} id={inputId} className={cn(inputVariants({ size }), error && 'border-error/50 focus:border-error focus:ring-error/20', icon && 'pl-9', rightPad, props.readOnly && 'bg-surface-raised/50 cursor-default', className)} onChange={handleChange} {...props} />{showSuffix && <span className={cn('absolute top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none', showClear ? 'right-9' : 'right-3')}>{suffix}</span>}<AnimatePresence>{showClear && <motion.button type="button" aria-label="Clear input" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }} onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary transition-colors"><X size={14} /></motion.button>}</AnimatePresence></div><AnimatePresence>{error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="text-xs text-error">{error}</motion.p>}</AnimatePresence></div>
})
Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; error?: string; showCount?: boolean; size?: 'sm' | 'md' | 'lg' }
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, label, error, showCount, size = 'md', ...props }, ref) => {
  const generatedId = React.useId(); const textareaId = props.id || generatedId; const [count, setCount] = React.useState(() => String(props.value ?? props.defaultValue ?? '').length)
  React.useEffect(() => { if (props.value !== undefined) setCount(String(props.value).length) }, [props.value])
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setCount(e.target.value.length); props.onChange?.(e) }
  return <div className="space-y-1.5">{label && <label htmlFor={textareaId} className="block text-xs font-medium text-txt-secondary">{label}</label>}<div className="relative rounded-xl transition-[border-color,box-shadow] duration-base ease-dv"><textarea ref={ref} id={textareaId} className={cn(textareaVariants({ size }), error && 'border-error/50 focus:border-error focus:ring-error/20', props.readOnly && 'bg-surface-raised/50 cursor-default', showCount && props.maxLength && 'pb-7', className)} onChange={handleChange} {...props} />{showCount && props.maxLength && <span className="absolute bottom-2 right-3 text-2xs text-txt-muted pointer-events-none">{count}/{props.maxLength}</span>}</div><AnimatePresence>{error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="text-xs text-error">{error}</motion.p>}</AnimatePresence></div>
})
Textarea.displayName = 'Textarea'

interface SelectOption { value: string; label: string; group?: string }
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> { label?: string; error?: string; options: SelectOption[]; placeholder?: string; size?: 'sm' | 'md' | 'lg' }
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, label, error, options, placeholder, size = 'md', ...props }, ref) => {
  const generatedId = React.useId(); const selectId = props.id || generatedId
  const groups = React.useMemo(() => { if (!options.some((o) => o.group)) return null; const ordered: Array<[string, SelectOption[]]> = []; const index = new Map<string, SelectOption[]>(); for (const opt of options) { const key = opt.group || ''; let bucket = index.get(key); if (!bucket) { bucket = []; index.set(key, bucket); ordered.push([key, bucket]) }; bucket.push(opt) }; return ordered }, [options])
  return <div className="space-y-1.5">{label && <label htmlFor={selectId} className="block text-xs font-medium text-txt-secondary">{label}</label>}<div className="relative rounded-xl transition-[border-color,box-shadow] duration-base ease-dv"><select ref={ref} id={selectId} className={cn(selectVariants({ size }), error && 'border-error/50 focus:border-error focus:ring-error/20', className)} {...props}>{placeholder && <option value="">{placeholder}</option>}{groups ? groups.map(([groupLabel, groupOptions]) => groupLabel ? <optgroup key={groupLabel} label={groupLabel}>{groupOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</optgroup> : groupOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)) : options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted" /></div><AnimatePresence>{error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="text-xs text-error">{error}</motion.p>}</AnimatePresence></div>
})
Select.displayName = 'Select'
export { Input, Textarea, Select }
