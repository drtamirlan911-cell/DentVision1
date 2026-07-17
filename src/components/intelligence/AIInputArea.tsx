import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Send, ArrowUp, Loader2, CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [height, setHeight] = useState(52)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setText(value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(textareaRef.current.scrollHeight, 180)
      setHeight(newHeight)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.trim() && !disabled) {
        onSend(text.trim())
        setText('')
        setHeight(52)
      }
    }
  }, [text, disabled, onSend])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(textareaRef.current.scrollHeight, 180)
      setHeight(newHeight)
    }
  }, [text])

  const isProcessing = status !== 'idle'

  return (
    <div className="px-4 md:px-6 pb-4 pt-2">
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl"
          >
            {status === 'thinking' && (
              <>
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 rounded-full border-2 border-dv-gold/20 border-t-dv-gold"
                  />
                </div>
                <span className="text-sm text-txt-secondary font-medium">AI анализирует запрос</span>
                <motion.div
                  className="flex gap-1 ml-auto"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      variants={{
                        hidden: { opacity: 0.2, scale: 0.8 },
                        visible: { opacity: [0.2, 0.8, 0.2], scale: [0.8, 1, 0.8], transition: { duration: 1.2, repeat: Infinity } },
                      }}
                      className="w-1.5 h-1.5 rounded-full bg-dv-gold/60"
                    />
                  ))}
                </motion.div>
              </>
            )}
            {status === 'executing' && (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 rounded-full border-2 border-dv-gold/20 border-t-dv-gold border-r-transparent"
                />
                <span className="text-sm text-txt-secondary font-medium">Выполняю</span>
                <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden max-w-[200px]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-dv-gold to-dv-gold/60 rounded-full"
                  />
                </div>
                <span className="text-[11px] text-txt-muted tabular-nums">{Math.round(progress)}%</span>
              </>
            )}
            {status === 'result' && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  <CheckCircle size={18} className="text-green-400" />
                </motion.div>
                <span className="text-sm text-green-400 font-medium">Готово</span>
              </>
            )}
            {status === 'error' && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                >
                  <X size={18} className="text-red-400" />
                </motion.div>
                <span className="text-sm text-red-400 font-medium">Ошибка</span>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'relative rounded-2xl transition-all duration-300',
              focused
                ? 'shadow-[0_0_30px_rgba(201,169,110,0.08)] ring-1 ring-dv-gold/20'
                : 'shadow-none ring-1 ring-white/[0.06]'
            )}
          >
            <div className="relative bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.06] overflow-hidden">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={disabled}
                placeholder={placeholder}
                className={cn(
                  'w-full bg-transparent px-5 py-3.5 pr-14 text-[13px] text-txt-primary',
                  'placeholder:text-txt-muted/50 resize-none outline-none',
                  'transition-colors duration-200',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
                style={{ height }}
                rows={1}
              />

              <div className="absolute right-3 bottom-2.5 flex items-center gap-1.5">
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {}}
                  disabled={disabled}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-txt-muted hover:text-txt-secondary hover:bg-white/[0.05] transition-all"
                >
                  <Mic size={16} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => { if (text.trim() && !disabled) { onSend(text.trim()); setText(''); setHeight(52) } }}
                  disabled={disabled || !text.trim()}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                    text.trim()
                      ? 'bg-dv-gold text-surface-0 shadow-lg shadow-dv-gold/20'
                      : 'bg-white/[0.05] text-txt-muted'
                  )}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </motion.button>
              </div>
            </div>

            <p className="text-center text-[10px] text-txt-ghost/40 mt-1.5 select-none">
              DentVision Intelligence · Enter для отправки
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
