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

    if (first) first.focus()
    else content.focus()

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !first || !last) return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
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
          role="dialog"
          aria-modal="true"
          aria-label={title || 'Диалог'}
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === overlayRef.current) onClose()
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />

          <motion.div
            ref={contentRef}
            tabIndex={-1}
            className={cn(
              'relative w-full rounded-t-2xl sm:rounded-2xl border border-bdr-subtle bg-surface-1 shadow-modal outline-none',
              'max-h-[94dvh] sm:max-h-[90vh] flex flex-col',
              'max-w-full sm:mx-auto overflow-hidden',
              sizeMap[size],
              className
            )}
            initial={{ opacity: 0, scale: 0.985, y: 18 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { type: 'spring', damping: 30, stiffness: 340 },
            }}
            exit={{ opacity: 0, scale: 0.985, y: 12, transition: { duration: 0.15 } }}
          >
            {(title || description) && (
              <div className="flex items-start justify-between gap-3 border-b border-bdr-subtle bg-surface-1 px-4 py-3.5 sm:px-6 sm:py-4 flex-shrink-0">
                <div className="min-w-0 pr-2">
                  {title && (
                    <h2 className="text-base sm:text-lg font-semibold tracking-tight text-txt-primary break-words">{title}</h2>
                  )}
                  {description && (
                    <p className="text-sm text-txt-secondary mt-1 leading-snug break-words">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Закрыть"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-txt-muted hover:bg-surface-raised-hover hover:text-txt-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/40 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="px-4 py-4 overflow-y-auto overscroll-contain flex-1 min-h-0 sm:px-6 sm:py-5">
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
  description,
  confirmLabel = 'Подтвердить',
  variant = 'danger',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message?: string
  /** @deprecated use message — kept for ShopAdmin/SchoolAdmin callers */
  description?: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
}) {
  const body = message || description || ''
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
        <p className="text-sm text-txt-secondary mb-6 leading-relaxed">{body}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 min-h-11 text-sm font-medium text-txt-secondary hover:text-txt-primary rounded-xl hover:bg-surface-raised-hover transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={cn(
              'px-4 py-2 min-h-11 text-sm font-medium rounded-xl transition-colors',
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
