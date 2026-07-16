import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-bdr-subtle bg-surface-1">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Спросите о чём угодно или попросите выполнить действие..."
        className="flex-1 bg-transparent text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none"
        disabled={disabled}
      />
      <button
        onClick={onSend}
        disabled={!value.trim() || disabled}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition-all',
          value.trim() && !disabled
            ? 'bg-dv-gold text-white hover:bg-dv-gold/90'
            : 'bg-surface-3 text-txt-muted cursor-not-allowed'
        )}
      >
        <Send size={15} />
      </button>
    </div>
  );
}
