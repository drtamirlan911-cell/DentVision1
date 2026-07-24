import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxHeight?: number
  className?: string
  showHandle?: boolean
}

function BottomSheet({ open, onClose, title, children, maxHeight = 85, className, showHandle = true }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ maxHeight: `${maxHeight}vh` }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 md:hidden',
              'flex flex-col bg-surface-1 border-t border-bdr-subtle',
              'rounded-t-2xl shadow-2xl',
              className
            )}
          >
            {showHandle && (
              <div className="flex items-center justify-center py-2 flex-shrink-0">
                <motion.div
                  className="h-1 w-10 rounded-full bg-txt-muted/40"
                  whileHover={{ scaleX: 1.5 }}
                  whileTap={{ scaleX: 0.8 }}
                />
              </div>
            )}
            {title && (
              <div className="px-4 pb-2 flex-shrink-0">
                <h2 className="text-sm font-semibold text-txt-primary text-center">{title}</h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { BottomSheet }
