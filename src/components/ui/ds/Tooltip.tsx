// ═══════════════════════════════════════════════════════════════
// DDS Tooltip — hover/focus tooltip with Radix-style positioning
// ═══════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: TooltipSide
  delay?: number
  className?: string
  /** Classes for the trigger wrapper (default inline-flex). Use `w-full` in nav rails. */
  triggerClassName?: string
}

const OFFSET = 8

function getPositions(side: TooltipSide, rect: DOMRect) {
  switch (side) {
    case 'top':
      return { top: rect.top - OFFSET, left: rect.left + rect.width / 2 }
    case 'bottom':
      return { top: rect.bottom + OFFSET, left: rect.left + rect.width / 2 }
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - OFFSET }
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + OFFSET }
  }
}

function getTransform(side: TooltipSide) {
  switch (side) {
    case 'top': return 'translate(-50%, -100%)'
    case 'bottom': return 'translate(-50%, 0)'
    case 'left': return 'translate(-100%, -50%)'
    case 'right': return 'translate(0, -50%)'
  }
}

function getInitial(side: TooltipSide) {
  switch (side) {
    case 'top': return { opacity: 0, y: 4 }
    case 'bottom': return { opacity: 0, y: -4 }
    case 'left': return { opacity: 0, x: 4 }
    case 'right': return { opacity: 0, x: -4 }
  }
}

export function Tooltip({ children, content, side = 'top', delay = 300, className }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const show = () => {
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const p = getPositions(side, rect)
        setPos(p)
        setOpen(true)
      }
    }, delay)
  }

  const hide = () => {
    clearTimeout(timerRef.current)
    setOpen(false)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (!content) return <>{children}</>

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={getInitial(side)}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, ...getInitial(side) }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed z-[9999] px-2.5 py-1.5 rounded-lg text-xs font-medium',
              'bg-surface-raised border border-bdr-subtle text-txt-primary shadow-lg pointer-events-none',
              className
            )}
            style={{ top: pos.top, left: pos.left, transform: getTransform(side) }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
