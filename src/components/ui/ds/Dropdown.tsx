// ═══════════════════════════════════════════════════════════════
// DDS Dropdown — custom dropdown menu with Framer Motion
// ═══════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DropdownContextValue {
  open: boolean
  setOpen: (v: boolean) => void
}

const DropdownContext = createContext<DropdownContextValue>({ open: false, setOpen: () => {} })

interface DropdownProps {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}

export function Dropdown({ children, align = 'end', className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className={cn('relative inline-flex', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

interface TriggerProps {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}

function Trigger({ children, className }: TriggerProps) {
  const { setOpen, open } = useContext(DropdownContext)
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn('outline-none', className)}
    >
      {children}
    </button>
  )
}

interface ContentProps {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  width?: number | string
}

function Content({ children, align = 'end', className, width }: ContentProps) {
  const { open } = useContext(DropdownContext)

  const alignClass = align === 'start'
    ? 'left-0 origin-top-left'
    : align === 'center'
    ? 'left-1/2 -translate-x-1/2 origin-top'
    : 'right-0 origin-top-right'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={cn(
            'absolute top-full mt-1.5 z-50 min-w-[180px] rounded-xl border border-bdr-subtle',
            'bg-surface-raised backdrop-blur-xl shadow-xl overflow-hidden',
            alignClass,
            className
          )}
          style={width ? { width } : undefined}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ItemProps {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  className?: string
}

function Item({ children, onClick, danger, disabled, icon, className }: ItemProps) {
  const { setOpen } = useContext(DropdownContext)
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => { onClick?.(); setOpen(false) }}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors text-left',
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-txt-primary hover:bg-white/5',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {icon && <span className="shrink-0 text-txt-secondary">{icon}</span>}
      {children}
    </button>
  )
}

function Separator() {
  return <div className="h-px bg-bdr-subtle my-1" />
}

Dropdown.Trigger = Trigger
Dropdown.Content = Content
Dropdown.Item = Item
Dropdown.Separator = Separator
