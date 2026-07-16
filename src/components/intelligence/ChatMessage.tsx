import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Sparkles, Zap, Stethoscope, Calendar, BarChart3, ShoppingCart, GraduationCap, BookOpen, Users } from 'lucide-react';
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

const SKILL_ICONS: Record<string, React.ReactNode> = {
  clinical: <Stethoscope size={10} />,
  practice: <Calendar size={10} />,
  analytics: <BarChart3 size={10} />,
  shopping: <ShoppingCart size={10} />,
  learning: <GraduationCap size={10} />,
  research: <BookOpen size={10} />,
  automation: <Zap size={10} />,
  patient: <Users size={10} />,
};

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

      <div className={cn('flex flex-col gap-2 max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && msg.skill && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-dv-gold/10 text-dv-gold text-[10px] font-medium">
            {SKILL_ICONS[msg.skill] || <Sparkles size={10} />}
            <span className="capitalize">{msg.skill}</span>
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap max-w-full',
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
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => msg.onAction?.(a.action, a.params)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-dv-gold/10 text-dv-gold border border-dv-gold/20 hover:bg-dv-gold/20 hover:border-dv-gold/40 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Zap size={10} />
                {a.label}
                {a.confidence > 0 && (
                  <span className="text-[9px] opacity-60">{(a.confidence * 100).toFixed(0)}%</span>
                )}
              </motion.button>
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