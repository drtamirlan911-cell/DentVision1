import React, { useState, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface AccordionContextValue {
  expanded: Set<string>
  toggle: (id: string) => void
  multiple?: boolean
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

interface AccordionProps {
  children: React.ReactNode
  defaultExpanded?: string[]
  multiple?: boolean
  className?: string
}

function Accordion({ children, defaultExpanded = [], multiple = false, className }: AccordionProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(defaultExpanded))

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!multiple) next.clear()
        next.add(id)
      }
      return next
    })
  }

  return (
    <AccordionContext.Provider value={{ expanded, toggle, multiple }}>
      <div className={cn('space-y-1', className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps {
  id: string
  children: React.ReactNode
  className?: string
}

function AccordionItem({ id, children, className }: AccordionItemProps) {
  return (
    <div className={cn('rounded-xl border border-bdr-subtle bg-surface-raised overflow-hidden', className)}>
      {children}
    </div>
  )
}

interface AccordionTriggerProps {
  id: string
  children: React.ReactNode
  className?: string
}

function AccordionTrigger({ id, children, className }: AccordionTriggerProps) {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error('AccordionTrigger must be used within Accordion')
  const isOpen = ctx.expanded.has(id)

  return (
    <button
      onClick={() => ctx.toggle(id)}
      className={cn(
        'flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-txt-primary transition-colors hover:bg-white/[0.03]',
        className
      )}
    >
      {children}
      <motion.span
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2 }}
        className="text-txt-muted shrink-0"
      >
        <ChevronDown size={16} />
      </motion.span>
    </button>
  )
}

interface AccordionContentProps {
  id: string
  children: React.ReactNode
  className?: string
}

function AccordionContent({ id, children, className }: AccordionContentProps) {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error('AccordionContent must be used within Accordion')
  const isOpen = ctx.expanded.has(id)

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className={cn('px-4 pb-3 text-sm text-txt-secondary', className)}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
