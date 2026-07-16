import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Send, Sparkles, X, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/ds/Button'
import { CursorBlink } from '@/components/ui/motion'

interface AIInputAreaProps {
  onSend: (text: string) => void
  disabled?: boolean
  status?: 'idle' | 'thinking' | 'executing' | 'result' | 'error'
  progress?: number
  suggestions?: string[]
  placeholder?: string
}

export function AIInputArea({
  onSend,
  disabled = false,
  status = 'idle',
  progress = 0,
  placeholder = 'Чем помочь?',
}: AIInputAreaProps) {
  const [text, setText] = useState('')
  const [hasVoice, setHasVoice] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [height, setHeight] = useState(48)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)
    setHasVoice(value.trim().length > 0)

    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(textareaRef.current.scrollHeight, 160)
      setHeight(newHeight)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.trim() && !disabled) {
        onSend(text.trim())
        setText('')
        setHasVoice(false)
        setHeight(48)
      }
    }
  }, [text, disabled, onSend])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(textareaRef.current.scrollHeight, 160)
      setHeight(newHeight)
    }
  }, [text])

  const showStatus = status !== 'idle'

  return (
    <div className={cn('flex items-end gap-3 px-4 md:px-6 pb-4', showStatus && 'pb-0')}>
      {/* Textarea Area */}
      <div className={cn('flex-1 relative', showStatus && 'hidden')}>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || showStatus}
            placeholder={placeholder}
            className={cn(
              'w-full bg-white/[0.03] border rounded-2xl px-4 py-3 pr-14 text-sm text-txt-primary',
              'border-bdr-subtle placeholder:text-txt-muted',
              'transition-colors duration-200 resize-none',
              'focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              showStatus && 'pointer-events-none opacity-60'
            )}
            style={{ height }}
            rows={1}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => { setHasVoice(!hasVoice) }}
              disabled={disabled || showStatus}
              className={cn('text-txt-muted hover:text-dv-gold transition-colors', hasVoice && 'text-dv-gold')}
            >
              <Mic size={16} />
            </Button>
            <Button
              variant={text.trim() ? 'primary' : 'ghost'}
              size="icon"
              onClick={() => { if (text.trim() && !disabled) onSend(text.trim()) }}
              disabled={disabled || !text.trim() || showStatus}
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <AnimatePresence mode="wait">
        {showStatus && (
          <motion.div
            key={status}
            initial={{ opacity: 0, height: 0, y: 10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-2 border border-bdr-subtle"
          >
            {status === 'thinking' && (
              <>
                <div className="relative flex h-6 w-6">
                  <RingSpinner size={20} thickness={2} color="gold" speed={1.2} />
                </div>
                <span className="text-sm text-txt-secondary">ИИ думает...</span>
              </>
            )}
            {status === 'executing' && (
              <>
                <div className="relative flex h-6 w-6">
                  <RingSpinner size={20} thickness={2} color="gold" speed={0.8} />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-txt-secondary">Выполняю действие...</span>
                  <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="h-full bg-dv-gold rounded-full"
                    />
                  </div>
                  <span className="text-xs text-txt-muted w-10 text-right">{Math.round(progress)}%</span>
                </div>
              </>
            )}
            {status === 'result' && (
              <>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle size={16} className="text-success" />
                </div>
                <span className="text-sm text-success font-medium">Готово</span>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-error/10">
                  <X size={16} className="text-error" />
                </div>
                <span className="text-sm text-error font-medium">Ошибка</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RingSpinner({ size = 20, thickness = 2, color = 'gold', speed = 1.2 }: { size?: number; thickness?: number; color?: 'gold' | 'white' | 'primary'; speed?: number }) {
  const colorStyles = { gold: 'text-dv-gold', white: 'text-white', primary: 'text-txt-primary' }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={colorStyles[color]} fill="none">
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth={thickness}
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 10}
        initial={{ strokeDashoffset: 2 * Math.PI * 10 * 0.75 }}
        animate={{ strokeDashoffset: [2 * Math.PI * 10 * 0.75, 2 * Math.PI * 10 * 0.25] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        strokeWidth={thickness}
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 10}
        initial={{ strokeDashoffset: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: speed * 1.5, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '12px 12px' }}
      />
    </svg>
  )
}