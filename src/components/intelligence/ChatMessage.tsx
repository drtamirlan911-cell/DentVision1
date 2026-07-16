import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  skill?: string;
  actions?: Array<{ action: string; label: string; confidence: number; params?: Record<string, unknown> }>;
  onAction?: (action: string, params?: Record<string, unknown>) => void;
}

export function ChatMessage({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10">
          <Bot size={16} className="text-dv-gold" />
        </div>
      )}

      <div className={cn('flex flex-col gap-2 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
            isUser
              ? 'bg-dv-gold text-white rounded-br-md'
              : 'bg-surface-2 border border-bdr-subtle text-txt-primary rounded-bl-md'
          )}
        >
          {msg.content}
        </div>

        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.actions.map((a, i) => (
              <button
                key={i}
                onClick={() => msg.onAction?.(a.action, a.params)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-dv-gold/10 text-dv-gold border border-dv-gold/20 hover:bg-dv-gold/20 transition-colors"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-3">
          <User size={16} className="text-txt-muted" />
        </div>
      )}
    </motion.div>
  );
}
