import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  side?: 'left' | 'right'
  width?: number
  className?: string
}

const sideVariants = {
  left: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
  },
  right: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },
}

function Drawer({ open, onClose, title, children, side = 'right', width = 320, className }: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === overlayRef.current) onClose()
            }}
          />
          <motion.div
            initial={sideVariants[side].initial}
            animate={sideVariants[side].animate}
            exit={sideVariants[side].exit}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            style={{ width, maxWidth: '90vw' }}
            className={cn(
              'fixed top-0 bottom-0 z-50 flex flex-col',
              'bg-surface-1 border-l border-bdr-subtle shadow-2xl',
              side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
              className
            )}
          >
            {title && (
              <div className="flex items-center justify-between px-4 h-14 border-b border-bdr-subtle flex-shrink-0">
                <h2 className="text-sm font-semibold text-txt-primary">{title}</h2>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { Drawer }
