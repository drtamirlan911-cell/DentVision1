import React, { useRef, useEffect } from 'react';
import { Send, Mic, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onAttach?: () => void;
  onVoice?: () => void;
}

export function ChatInput({ value, onChange, onSend, disabled, onAttach, onVoice }: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
    }
  }, [disabled, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-bdr-subtle bg-surface-1">
      {onAttach && (
        <button
          onClick={onAttach}
          disabled={disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <Paperclip size={18} />
        </button>
      )}
      <div className="flex-1 relative">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Спросите о чём угодно или попросите выполнить действие…"
          rows={1}
          disabled={disabled}
          className={cn(
            'w-full bg-transparent resize-none text-sm text-txt-primary placeholder-txt-muted',
            'pr-28 py-2 rounded-xl border border-bdr-subtle',
            'focus:outline-none focus:ring-2 focus:ring-dv-gold/30',
            'transition-colors',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
          style={{ minHeight: '40px', maxHeight: '150px' }}
        />
      </div>
      <div className="flex items-center gap-1">
        {onVoice && (
          <button
            onClick={onVoice}
            disabled={disabled || !value.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <Mic size={18} />
          </button>
        )}
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150',
            value.trim() && !disabled
              ? 'bg-dv-gold text-white hover:bg-dv-gold/90 shadow-lg shadow-dv-gold/30'
              : 'bg-surface-3 text-txt-muted cursor-not-allowed'
          )}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}