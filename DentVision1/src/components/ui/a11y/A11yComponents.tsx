import React from 'react'
import { cn } from '@/lib/utils'
// ─── Accessible Icon Button ───────────────────────────────
interface A11yIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  icon: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'primary' | 'secondary'
  tooltip?: string
}
function A11yIconButton({ label, icon, size = 'md', variant = 'ghost', className, tooltip, ...props }: A11yIconButtonProps) {
  const sizeClasses = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-11 w-11' }
  const variantClasses = {
    ghost: 'text-txt-muted hover:text-txt-primary hover:bg-white/5',
    primary: 'bg-dv-gold/10 text-dv-gold hover:bg-dv-gold/20',
    secondary: 'bg-surface-raised text-txt-secondary hover:text-txt-primary border border-bdr-subtle',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={tooltip || label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon}
    </button>
  )
}

// ─── Accessible Button ────────────────────────────────────
interface A11yButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  loading?: boolean
  loadingText?: string
}
const A11yButton = React.forwardRef<HTMLButtonElement, A11yButtonProps>(
  ({ variant = 'primary', size = 'md', icon, loading, loadingText, children, disabled, className, ...props }, ref) => {
    const variants = {
      primary: 'bg-dv-gold text-surface-0 hover:bg-dv-gold/90 shadow-sm',
      secondary: 'bg-surface-raised border border-bdr-subtle text-txt-primary hover:bg-surface-raised-hover',
      ghost: 'text-txt-secondary hover:text-txt-primary hover:bg-white/5',
      danger: 'bg-error/10 border border-error/20 text-error hover:bg-error/20',
      outline: 'border border-bdr text-txt-primary hover:bg-dv-gold/10 hover:border-dv-gold/50',
    }
    const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-9 px-4 text-sm', lg: 'h-10 px-5 text-base' }
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap active:scale-[0.97]',
          variants[variant], sizes[size], className
        )}
        {...(props as any)}
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="sr-only">{loadingText || 'Loading...'}</span>
            {children}
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </button>
    )
  }
)
A11yButton.displayName = 'A11yButton'

// ─── Accessible Input ─────────────────────────────────────
interface A11yInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}
const A11yInput = React.forwardRef<HTMLInputElement, A11yInputProps>(
  ({ label, error, hint, icon, id, className, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    const errorId = error ? `${inputId}-error` : undefined
    const hintId = hint ? `${inputId}-hint` : undefined
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-xs font-medium text-txt-secondary">{label}</label>
        <div className="relative">
          {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={errorId || hintId || undefined}
            className={cn(
              'flex w-full rounded-lg border bg-white/[0.03] text-sm text-txt-primary border-bdr-subtle placeholder:text-txt-muted transition-all duration-200 focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 disabled:cursor-not-allowed disabled:opacity-50 h-9 px-3 py-2',
              icon && 'pl-9',
              error && 'border-error/50 focus:border-error focus:ring-error/20',
              className
            )}
            {...props}
          />
        </div>
        {error && <p id={errorId} role="alert" className="text-xs text-error">{error}</p>}
        {hint && !error && <p id={hintId} className="text-xs text-txt-muted">{hint}</p>}
      </div>
    )
  }
)
A11yInput.displayName = 'A11yInput'

// ─── Accessible Select ────────────────────────────────────
interface A11ySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string; label: string }[]
  error?: string
}
const A11ySelect = React.forwardRef<HTMLSelectElement, A11ySelectProps>(
  ({ label, options, error, id, className, ...props }, ref) => {
    const generatedId = React.useId()
    const selectId = id || generatedId
    return (
      <div className="space-y-1.5">
        <label htmlFor={selectId} className="block text-xs font-medium text-txt-secondary">{label}</label>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          className={cn(
            'flex w-full rounded-lg border bg-white/[0.03] text-sm text-txt-primary border-bdr-subtle transition-all duration-200 appearance-none focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 disabled:cursor-not-allowed disabled:opacity-50 h-9 px-3 py-2',
            className
          )}
          {...props}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
      </div>
    )
  }
)
A11ySelect.displayName = 'A11ySelect'

// ─── Accessible Dialog (Modal wrapper) ────────────────────
interface A11yDialogProps {
  open: boolean
  onClose: () => void
  label: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}
function A11yDialog({ open, onClose, label, description, children, size = 'md' }: A11yDialogProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

  React.useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = '' }
  }, [open, onClose])

  React.useEffect(() => {
    if (!open) return
    const el = contentRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !first || !last) return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [open])

  if (!open) return null
  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-describedby={description ? 'a11y-dialog-desc' : undefined}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div ref={contentRef} tabIndex={-1} className={cn('relative w-full rounded-2xl border border-bdr-subtle bg-surface-1 shadow-modal outline-none max-h-[90vh] flex flex-col', sizes[size])}>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Accessible Table ─────────────────────────────────────
interface A11yTableProps {
  columns: { key: string; header: string; className?: string }[]
  rows: Record<string, React.ReactNode>[]
  caption?: string
}
function A11yTable({ columns, rows, caption }: A11yTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" role="table" aria-label={caption}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-bdr-subtle">
            {columns.map(col => (
              <th key={col.key} scope="col" className={cn('px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-bdr-subtle/50">
              {columns.map(col => (
                <td key={col.key} className={cn('px-4 py-3 text-sm', col.className)}>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Accessible Card ──────────────────────────────────────
interface A11yCardProps {
  title?: string
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}
function A11yCard({ title, children, className, actions }: A11yCardProps) {
  return (
    <section className={cn('rounded-2xl border border-bdr-subtle bg-surface-1 shadow-sm', className)}>
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-bdr-subtle">
          <h3 className="text-sm font-semibold text-txt-primary">{title}</h3>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

// ─── Accessible Tabs ──────────────────────────────────────
interface A11yTabsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[]
  active: string
  onChange: (id: string) => void
  label: string
}
function A11yTabs({ tabs, active, onChange, label }: A11yTabsProps) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex items-center gap-1 rounded-xl bg-surface-2 p-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-2 text-sm font-medium transition-all duration-200',
            active === tab.id ? 'bg-surface-raised text-dv-gold shadow-sm' : 'text-txt-muted hover:text-txt-secondary'
          )}
        >
          {tab.icon}{tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── Accessible Navigation ────────────────────────────────
interface A11yNavProps {
  label: string
  items: { id: string; label: string; href: string; icon?: React.ReactNode; badge?: string | number }[]
  activeId?: string
  onNavigate: (id: string, href: string) => void
}
function A11yNavigation({ label, items, activeId, onNavigate }: A11yNavProps) {
  return (
    <nav aria-label={label} className="space-y-1">
      {items.map(item => (
        <a
          key={item.id}
          href={item.href}
          aria-current={activeId === item.id ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); onNavigate(item.id, item.href) }}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            activeId === item.id
              ? 'bg-white/10 text-txt-primary'
              : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
          )}
        >
          {item.icon}
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && (
            <span className="rounded-full bg-dv-gold/20 px-1.5 py-0.5 text-2xs font-bold text-dv-gold">{item.badge}</span>
          )}
        </a>
      ))}
    </nav>
  )
}

// ─── Accessible Tooltip ───────────────────────────────────
interface A11yTooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}
function A11yTooltip({ content, children, position = 'top' }: A11yTooltipProps) {
  const [visible, setVisible] = React.useState(false)
  const id = React.useId()
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <div aria-describedby={id}>{children}</div>
      {visible && (
        <div
          id={id}
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-sm pointer-events-none whitespace-nowrap',
            positions[position]
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}

// ─── Accessible Menu / Dropdown ───────────────────────────
interface A11yMenuProps {
  trigger: React.ReactNode
  items: { id: string; label: string; icon?: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }[]
  label: string
  align?: 'start' | 'end'
}
function A11yMenu({ trigger, items, label, align = 'end' }: A11yMenuProps) {
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const _id = React.useId()
  React.useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) setOpen(false)
    }
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc) }
  }, [open])
  return (
    <div className="relative inline-flex">
      <button ref={buttonRef} type="button" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={cn(
            'absolute z-50 mt-1 min-w-[180px] rounded-xl border border-bdr-subtle bg-surface-1 shadow-lg py-1',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {items.map(item => (
            <button
              key={item.id}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick() }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                item.danger ? 'text-error hover:bg-error/10' : 'text-txt-primary hover:bg-white/5',
                item.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Accessible Textarea ──────────────────────────────────
interface A11yTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}
const A11yTextarea = React.forwardRef<HTMLTextAreaElement, A11yTextareaProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const generatedId = React.useId()
    const textareaId = id || generatedId
    return (
      <div className="space-y-1.5">
        <label htmlFor={textareaId} className="block text-xs font-medium text-txt-secondary">{label}</label>
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={!!error}
          className={cn(
            'flex w-full rounded-lg border bg-white/[0.03] text-sm text-txt-primary border-bdr-subtle placeholder:text-txt-muted transition-all duration-200 focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] px-3 py-2',
            error && 'border-error/50 focus:border-error focus:ring-error/20',
            className
          )}
          {...props}
        />
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
      </div>
    )
  }
)
A11yTextarea.displayName = 'A11yTextarea'

// ─── Accessible Badge ─────────────────────────────────────
interface A11yBadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
}
function A11yBadge({ children, variant = 'default', size = 'sm' }: A11yBadgeProps) {
  const variants = {
    default: 'bg-surface-2 text-txt-secondary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-error/10 text-error',
    info: 'bg-info/10 text-info',
  }
  const sizes = { sm: 'px-1.5 py-0.5 text-2xs', md: 'px-2 py-1 text-xs' }
  return (
    <span className={cn('inline-flex items-center rounded-full font-medium', variants[variant], sizes[size])} aria-label={typeof children === 'string' ? children : undefined}>
      {children}
    </span>
  )
}

// ─── Accessible Spinner ───────────────────────────────────
interface A11ySpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}
function A11ySpinner({ size = 'md', label = 'Loading...' }: A11ySpinnerProps) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }
  return (
    <svg
      className={cn('animate-spin text-dv-gold', sizes[size])}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Accessible Alert ─────────────────────────────────────
interface A11yAlertProps {
  type: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: React.ReactNode
  onClose?: () => void
}
function A11yAlert({ type, title, children, onClose }: A11yAlertProps) {
  const icons = {
    info: <svg className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    success: <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    warning: <svg className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>,
    error: <svg className="h-5 w-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  }
  const colors = {
    info: 'border-info/20 bg-info/5',
    success: 'border-success/20 bg-success/5',
    warning: 'border-warning/20 bg-warning/5',
    error: 'border-error/20 bg-error/5',
  }
  return (
    <div role="alert" className={cn('flex gap-3 rounded-xl border p-4', colors[type])}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-medium text-txt-primary mb-1">{title}</p>}
        <div className="text-sm text-txt-secondary">{children}</div>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close alert" className="shrink-0 text-txt-muted hover:text-txt-primary self-start">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  )
}

// ─── Accessible Toggle ────────────────────────────────────
interface A11yToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}
function A11yToggle({ label, checked, onChange, disabled }: A11yToggleProps) {
  const id = React.useId()
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none">
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
          aria-label={label}
        />
        <div className={cn(
          'w-9 h-5 rounded-full transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-dv-gold/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-0',
          checked ? 'bg-dv-gold' : 'bg-surface-2'
        )}>
          <div className={cn(
            'w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform mt-[3px]',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          )} />
        </div>
      </div>
      <span className="text-sm text-txt-primary">{label}</span>
    </label>
  )
}

export {
  A11yIconButton,
  A11yButton,
  A11yInput,
  A11ySelect,
  A11yDialog,
  A11yTable,
  A11yCard,
  A11yTabs,
  A11yNavigation,
  A11yTooltip,
  A11yMenu,
  A11yTextarea,
  A11yBadge,
  A11ySpinner,
  A11yAlert,
  A11yToggle,
}
