import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Sparkles, Zap, Stethoscope, Calendar, BarChart3, ShoppingCart, GraduationCap, BookOpen, Users, Globe, Database, Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  skill?: string;
  actions?: Array<{ action?: string; type?: string; label: string; confidence: number; params?: Record<string, unknown> }>;
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

/** Map backend intents / skill ids to short Russian chips — never show SCREAMING_SNAKE. */
const SKILL_LABELS: Record<string, string> = {
  clinical: 'Клиника',
  practice: 'Практика',
  analytics: 'Аналитика',
  shopping: 'Магазин',
  learning: 'Обучение',
  research: 'Исследования',
  automation: 'Автоматизация',
  patient: 'Пациент',
  general: 'Ассистент',
  MORNING_BRIEFING: 'Сводка',
  GET_ANALYTICS: 'Финансы',
  CHECK_DEBTS: 'Долги',
  VIEW_SCHEDULE: 'Расписание',
  GENERATE_REPORT: 'Отчёт',
  GENERATE_INVOICE: 'Счёт',
  CREATE_APPOINTMENT: 'Запись',
  LOW_STOCK: 'Склад',
  OPEN_INVENTORY: 'Склад',
  OPEN_SCHEDULE: 'Расписание',
  OPEN_SHOP: 'Магазин',
  OPEN_SCHOOL: 'Школа',
  OPEN_CRM: 'CRM',
  OPEN_ANALYTICS: 'Аналитика',
  UNKNOWN: 'Ассистент',
};

const ACTION_LABELS: Record<string, string> = {
  OPEN_SCHEDULE: 'Открыть расписание',
  OpenSchedule: 'Открыть расписание',
  OPEN_INVENTORY: 'Открыть склад',
  OpenInventory: 'Открыть склад',
  OPEN_CRM: 'Открыть CRM',
  OpenCRM: 'Открыть CRM',
  OPEN_SHOP: 'Открыть магазин',
  OpenShop: 'Открыть магазин',
  OPEN_SCHOOL: 'Открыть школу',
  OpenSchool: 'Открыть школу',
  OPEN_ANALYTICS: 'Открыть аналитику',
  OpenAnalytics: 'Открыть аналитику',
  OPEN_FINANCE: 'Открыть финансы',
  OpenFinance: 'Открыть финансы',
  OPEN_PATIENTS: 'Открыть пациентов',
  OpenPatients: 'Открыть пациентов',
};

function skillLabel(skill?: string): string | null {
  if (!skill) return null;
  if (SKILL_LABELS[skill]) return SKILL_LABELS[skill];
  if (/^[A-Z0-9_]+$/.test(skill)) {
    return skill
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return skill;
}

function actionLabel(a: { action?: string; type?: string; label?: string }): string {
  const key = a.action || a.type || '';
  if (a.label && !/^[A-Z][A-Z0-9_]+$/.test(a.label) && a.label !== key) return a.label;
  return ACTION_LABELS[key] || ACTION_LABELS[a.label || ''] || a.label || key || 'Действие';
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  crm: { label: 'CRM', icon: <Database size={10} /> },
  shop: { label: 'Shop', icon: <ShoppingCart size={10} /> },
  school: { label: 'School', icon: <GraduationCap size={10} /> },
  knowledge: { label: 'База знаний', icon: <BookOpen size={10} /> },
  external: { label: 'Внешний источник', icon: <Globe size={10} /> },
  market: { label: 'Рынок', icon: <BarChart3 size={10} /> },
};

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <span key={i} className="font-semibold text-dv-gold">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** Soft-rewrite legacy ACL error copy that leaked raw intent codes into chat history. */
function sanitizeAssistantContent(content: string): string {
  const raw = String(content || '');
  if (/Нет прав для действия:\s*UNKNOWN/i.test(raw)) {
    return 'Не совсем понял запрос. Попробуйте: «Чем полезен DentVision?», «Открыть демо-клинику» или войдите как сотрудник.';
  }
  if (/Нет прав для действия:\s*[A-Z0-9_]+/i.test(raw)) {
    return 'Для этого действия нужны права сотрудника клиники. Войдите в демо или под своей учётной записью.';
  }
  return raw;
}

function renderContent(content: string) {
  const blocks = sanitizeAssistantContent(content).split('\n\n');
  return blocks.map((block, i) => {
    if (block.startsWith('•') || block.startsWith('-') || block.includes('\n•') || block.includes('\n-')) {
      return (
        <div key={i} className="space-y-1 my-2">
          {block.split('\n').filter(Boolean).map((line, j) => (
            <div key={j} className="flex gap-2.5 text-[13px] leading-relaxed">
              <span className="text-dv-gold/60 mt-0.5 shrink-0">•</span>
              <span className="text-txt-primary/90">{renderInlineMarkdown(line.replace(/^[•-]\s*/, ''))}</span>
            </div>
          ))}
        </div>
      );
    }
    if (block.startsWith('**') && block.includes('**')) {
      return (
        <div key={i} className="my-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
          {block.split('\n').map((line, j) => {
            const parts = line.match(/\*\*(.+?)\*\*\s*[—–-]?\s*(.*)/);
            if (parts) {
              return (
                <p key={j} className="text-[13px] leading-relaxed mb-0.5">
                  <span className="font-semibold text-dv-gold">{parts[1]}</span>
                  {parts[2] && <span className="text-txt-muted"> — </span>}
                  {parts[2] && <span className="text-txt-primary/80">{renderInlineMarkdown(parts[2])}</span>}
                </p>
              );
            }
            return <p key={j} className="text-[13px] leading-relaxed">{renderInlineMarkdown(line)}</p>;
          })}
        </div>
      );
    }
    return <p key={i} className="my-1.5 text-[13px] leading-relaxed text-txt-primary/90">{renderInlineMarkdown(block)}</p>;
  });
}

export function ChatMessage({
  msg,
  onAction,
  onExecuteAction,
}: {
  msg: ChatMsg;
  onAction?: (query: string) => void;
  onExecuteAction?: (action: { action?: string; type?: string; label: string; params?: Record<string, unknown> }) => void;
}) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasContent = !!String(msg.content || '').trim()
  const hasExtras = !!(
    (msg.data && Object.keys(msg.data).length) ||
    (msg.actions && msg.actions.length) ||
    (msg.recommendations && msg.recommendations.length)
  )
  // Don't render empty assistant placeholders (optimistic stream shell).
  if (!isUser && !hasContent && !hasExtras) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className={cn('flex gap-3 group', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/25 to-dv-gold/5 border border-dv-gold/20 shadow-[0_0_20px_rgba(201,169,110,0.12)]"
        >
          <Bot size={17} className="text-dv-gold" />
        </motion.div>
      )}

      <div className={cn('flex flex-col gap-1.5 max-w-[75%] min-w-0', isUser ? 'items-end' : 'items-start')}>
        {!isUser && (msg.skill || msg.source) && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.2 }}
            className="flex items-center gap-1.5 flex-wrap"
          >
            {msg.skill && skillLabel(msg.skill) && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dv-gold/8 text-dv-gold/80 text-[10px] font-medium backdrop-blur-sm">
                {SKILL_ICONS[msg.skill] || <Sparkles size={10} />}
                <span>{skillLabel(msg.skill)}</span>
              </div>
            )}
            {msg.source && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-txt-muted text-[10px] font-medium">
                {SOURCE_LABELS[msg.source]?.icon || <Globe size={10} />}
                <span>{SOURCE_LABELS[msg.source]?.label || msg.source}</span>
              </div>
            )}
          </motion.div>
        )}

        <motion.div
          layout
          className={cn(
            'rounded-[1.35rem] px-5 py-3.5 text-[13.5px] leading-[1.55] whitespace-pre-wrap max-w-full',
            isUser
              ? 'bg-gradient-to-br from-[#D4B57A] to-dv-gold/85 text-[#0B1220] font-medium rounded-br-lg shadow-[0_8px_28px_rgba(201,169,110,0.18)]'
              : 'bg-gradient-to-b from-white/[0.055] to-white/[0.025] border border-white/[0.08] text-txt-primary rounded-bl-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md'
          )}
        >
          {renderContent(msg.content)}
        </motion.div>

        {msg.data?.products && Array.isArray(msg.data.products) && msg.data.products.length > 0 && (
          <div className="grid gap-1.5 w-full">
            {(msg.data.products as Array<any>).slice(0, 4).map((p: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-dv-gold/15 transition-all cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10">
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
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.stock > 0 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                    {p.stock > 0 ? 'В наличии' : 'Нет'}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {msg.data?.courses && Array.isArray(msg.data.courses) && msg.data.courses.length > 0 && (
          <div className="grid gap-1.5 w-full">
            {(msg.data.courses as Array<any>).slice(0, 4).map((c: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-emerald-400/15 transition-all cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
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
                  <span className="text-[10px] text-txt-muted">{c.enrolledCount} зап.</span>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!msg.data && msg.recommendations && Array.isArray(msg.recommendations) && msg.recommendations.length > 0 && (
          <div className="grid gap-1.5 w-full">
            {msg.recommendations.slice(0, 4).map((r: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-txt-primary truncate">{r.name || r.title || r.brand || ''}</p>
                  {(r.price || r.instructor) && (
                    <p className="text-xs text-txt-muted">{r.price ? `${r.price} ₸` : r.instructor || ''}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.actions
              .filter((a) => !String(a.action || a.type || '').startsWith('SHOW_'))
              .map((a, i) => {
                const label = actionLabel(a);
                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 400, damping: 20 }}
                    onClick={() => {
                      if (onExecuteAction) onExecuteAction(a);
                      else onAction?.(label);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-dv-gold/8 text-dv-gold border border-dv-gold/15 hover:bg-dv-gold/15 hover:border-dv-gold/30 transition-all"
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Zap size={10} />
                    {label}
                  </motion.button>
                );
              })}
          </div>
        )}

        {!isUser && !!msg.content?.trim() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <button
              onClick={() => onAction?.('Спасибо')}
              className="p-1.5 rounded-lg text-txt-ghost hover:text-txt-secondary hover:bg-white/[0.04] transition-colors"
            >
              <ThumbsUp size={12} />
            </button>
            <button
              onClick={() => onAction?.('Расскажи подробнее')}
              className="p-1.5 rounded-lg text-txt-ghost hover:text-txt-secondary hover:bg-white/[0.04] transition-colors"
            >
              <ThumbsDown size={12} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-txt-ghost hover:text-txt-secondary hover:bg-white/[0.04] transition-colors"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </motion.div>
        )}
      </div>

      {isUser && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/[0.08]"
        >
          <User size={16} className="text-txt-secondary" />
        </motion.div>
      )}
    </motion.div>
  );
}

export default ChatMessage;
