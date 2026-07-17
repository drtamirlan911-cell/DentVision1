import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Sparkles, Zap, Stethoscope, Calendar, BarChart3, ShoppingCart, GraduationCap, BookOpen, Users, Globe, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  skill?: string;
  actions?: Array<{ action: string; label: string; confidence: number; params?: Record<string, unknown> }>;
  proactive?: Array<{ type: string; text: string; priority: number }>;
  source?: 'crm' | 'shop' | 'school' | 'knowledge' | 'external' | 'market';
  data?: Record<string, unknown>;
  recommendations?: Array<Record<string, unknown>>;
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

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  crm: { label: 'CRM', icon: <Database size={10} /> },
  shop: { label: 'Shop', icon: <ShoppingCart size={10} /> },
  school: { label: 'School', icon: <GraduationCap size={10} /> },
  knowledge: { label: 'База знаний', icon: <BookOpen size={10} /> },
  external: { label: 'Внешний источник', icon: <Globe size={10} /> },
  market: { label: 'Рынок', icon: <BarChart3 size={10} /> },
};

export function ChatMessage({ msg, onAction }: { msg: ChatMsg; onAction?: (query: string) => void }) {
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
        {/* Skill + Source badges */}
        {!isUser && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {msg.skill && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dv-gold/10 text-dv-gold text-[10px] font-medium">
                {SKILL_ICONS[msg.skill] || <Sparkles size={10} />}
                <span className="capitalize">{msg.skill}</span>
              </div>
            )}
            {msg.source && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-txt-muted text-[10px] font-medium">
                {SOURCE_LABELS[msg.source]?.icon || <Globe size={10} />}
                <span>{SOURCE_LABELS[msg.source]?.label || msg.source}</span>
              </div>
            )}
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
          {msg.content.split('\n\n').map((block, i) => {
            if (block.startsWith('•') || block.startsWith('-')) {
              return (
                <div key={i} className="space-y-1 my-1.5">
                  {block.split('\n').map((line, j) => (
                    <p key={j} className="flex gap-2 text-sm">
                      <span className="text-dv-gold shrink-0">—</span>
                      <span>{line.replace(/^[•-]\s*/, '')}</span>
                    </p>
                  ))}
                </div>
              );
            }
            if (block.startsWith('**') && block.includes('** —')) {
              return (
                <div key={i} className="my-1.5 p-2 rounded-lg bg-dv-gold/5 border border-dv-gold/10">
                  {block.split('\n').map((line, j) => {
                    const parts = line.match(/\*\*(.+?)\*\*\s*[—–-]\s*(.+)/);
                    if (parts) {
                      return (
                        <p key={j} className="text-sm mb-0.5">
                          <span className="font-semibold text-dv-gold">{parts[1]}</span>
                          <span className="text-txt-muted"> — </span>
                          <span>{parts[2]}</span>
                        </p>
                      );
                    }
                    return <p key={j} className="text-sm">{line}</p>;
                  })}
                </div>
              );
            }
            return <p key={i} className="my-1.5">{block}</p>;
          })}
        </div>

        {/* Structured data: products */}
        {msg.data?.products && Array.isArray(msg.data.products) && msg.data.products.length > 0 && (
          <div className="grid gap-2 w-full">
            {(msg.data.products as Array<any>).slice(0, 4).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-1 border border-bdr-subtle">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10">
                  <ShoppingCart size={16} className="text-dv-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{p.brand ? `${p.brand} ` : ''}{p.name}</p>
                  <p className="text-xs text-txt-muted">
                    {p.price?.toLocaleString?.('ru-RU') || p.price || 'Цена по запросу'} ₸
                    {p.rating ? ` · ${'★'.repeat(Math.round(p.rating))} ${p.rating}` : ''}
                  </p>
                </div>
                {p.stock !== undefined && (
                  <span className={`text-2xs font-medium px-2 py-0.5 rounded-full ${p.stock > 0 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                    {p.stock > 0 ? 'В наличии' : 'Нет'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Structured data: courses */}
        {msg.data?.courses && Array.isArray(msg.data.courses) && msg.data.courses.length > 0 && (
          <div className="grid gap-2 w-full">
            {(msg.data.courses as Array<any>).slice(0, 4).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-1 border border-bdr-subtle">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10">
                  <GraduationCap size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{c.title}</p>
                  <p className="text-xs text-txt-muted">
                    {c.instructor || c.category || ''}
                    {c.durationHours ? ` · ${c.durationHours} ч.` : ''}
                    {c.rating ? ` · ${'★'.repeat(Math.round(c.rating))}` : ''}
                  </p>
                </div>
                {c.enrolledCount !== undefined && (
                  <span className="text-2xs text-txt-muted">{c.enrolledCount} зап.</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Legacy recommendations (fallback) */}
        {!msg.data && msg.recommendations && Array.isArray(msg.recommendations) && msg.recommendations.length > 0 && (
          <div className="grid gap-2 w-full">
            {msg.recommendations.slice(0, 4).map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-1 border border-bdr-subtle">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{r.name || r.title || r.brand || ''}</p>
                  {(r.price || r.instructor) && (
                    <p className="text-xs text-txt-muted">{r.price ? `${r.price} ₸` : r.instructor || ''}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.actions.map((a, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onAction?.(a.label)}
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

        {/* Quick reply actions */}
        {!isUser && onAction && !msg.actions?.length && msg.role === 'assistant' && (
          <div className="flex gap-1">
            <button
              onClick={() => onAction('Спасибо')}
              className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <ThumbsUp size={12} />
            </button>
            <button
              onClick={() => onAction('Расскажи подробнее')}
              className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <ThumbsDown size={12} />
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(msg.content);
              }}
              className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              <Copy size={12} />
            </button>
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

function ThumbsUp({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v12" />
      <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function ThumbsDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 14V2" />
      <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

function Copy({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export default ChatMessage;
