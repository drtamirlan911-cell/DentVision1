import React, { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-3xl',
}

function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!open) return
    const content = contentRef.current
    if (!content) return

    const focusable = content.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (first) {
      first.focus()
    } else {
      content.focus()
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !first || !last) return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === overlayRef.current) onClose()
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            ref={contentRef}
            tabIndex={-1}
            className={cn(
              'relative w-full rounded-2xl border border-bdr-subtle bg-surface-1 shadow-modal outline-none',
              sizeMap[size],
              className
            )}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { type: 'spring', damping: 25, stiffness: 300 },
            }}
            exit={{ opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } }}
          >
            {(title || description) && (
              <div className="flex items-start justify-between px-6 pt-6 pb-2">
                <div>
                  {title && (
                    <h2 className="text-lg font-semibold text-txt-primary">{title}</h2>
                  )}
                  {description && (
                    <p className="text-sm text-txt-secondary mt-1">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="px-6 py-4 max-h-[75vh] overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Подтвердить',
  variant = 'danger',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
}) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onConfirm()
      onClose()
    }
  }, [onConfirm, onClose])

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div onKeyDown={handleKeyDown}>
        <p className="text-sm text-txt-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-txt-secondary hover:text-txt-primary rounded-lg hover:bg-white/5 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              variant === 'danger'
                ? 'bg-error text-white hover:bg-error/90'
                : 'bg-warning text-surface-0 hover:bg-warning/90'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export { Modal, ConfirmModal }
