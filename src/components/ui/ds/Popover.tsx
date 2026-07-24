import React, { useState, useRef, useEffect, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

interface PopoverContextValue {
  isOpen: boolean
  setIsOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLDivElement | null>
}

const PopoverContext = createContext<PopoverContextValue | null>(null)

interface PopoverProps {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}

function Popover({ children, align = 'end', className }: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      <div ref={triggerRef} className={cn('relative inline-block', className)}>
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}

function PopoverTrigger({ children, asChild, className }: PopoverTriggerProps) {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error('PopoverTrigger must be used within Popover')

  if (asChild && React.isValidElement(children)) {
    return (
      <div onClick={() => ctx.setIsOpen(!ctx.isOpen)} className={cn('cursor-pointer', className)}>
        {children}
      </div>
    )
  }

  return (
    <button
      onClick={() => ctx.setIsOpen(!ctx.isOpen)}
      className={cn('cursor-pointer', className)}
    >
      {children}
    </button>
  )
}

interface PopoverContentProps {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  width?: 'auto' | 'trigger' | number
}

function PopoverContent({ children, align = 'end', className, width = 'auto' }: PopoverContentProps) {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error('PopoverContent must be used within Popover')

  const widthClass = width === 'trigger' ? 'w-full' : width === 'auto' ? '' : `w-[${width}px]`

  const alignClass = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  }[align]

  return (
    <AnimatePresence>
      {ctx.isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={cn(
            'absolute top-full mt-1.5 z-50 rounded-xl border border-bdr-subtle bg-surface-raised backdrop-blur-xl shadow-xl overflow-hidden',
            alignClass,
            widthClass,
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
