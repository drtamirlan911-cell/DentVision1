import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarPlus, CreditCard, Search, Sparkles, UserPlus, ClipboardCheck, ListTodo } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SuperAppQuickActionsProps { onAIQuery?: (query: string) => void; className?: string }

const actions = [
  { id: 'appointment', label: 'Новая запись', icon: CalendarPlus, path: '/crm/schedule?action=new', tone: 'accent' },
  { id: 'patient', label: 'Новый пациент', icon: UserPlus, path: '/crm/patients?action=new', tone: 'info' },
  { id: 'diagnostics', label: 'Направление', icon: Activity, path: '/diagnostics/referrals/new', tone: 'success' },
  { id: 'payment', label: 'Оплата', icon: CreditCard, path: '/crm/cashier', tone: 'violet' },
] as const;

const toneClass: Record<string, string> = {
  accent: 'border-[var(--dv-accent-soft)] bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]',
  info: 'border-sky-500/15 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  success: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  violet: 'border-violet-500/15 bg-violet-500/10 text-violet-600 dark:text-violet-300',
};

export const SuperAppQuickActions: React.FC<SuperAppQuickActionsProps> = ({ onAIQuery, className }) => {
  const navigate = useNavigate();
  const openSearch = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, bubbles: true }));
  const base = 'dv-focus-ring flex min-h-11 shrink-0 items-center gap-2 rounded-[11px] border px-3 text-xs font-medium transition-colors';

  return (
    <div className={cn('flex w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]', className)}>
      <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dv-muted-2)]">Быстро</span>
      {actions.map(({ id, label, icon: Icon, path, tone }) => (
        <motion.button key={id} type="button" whileTap={{ scale: 0.98 }} onClick={() => navigate(path)} className={cn(base, toneClass[tone], 'hover:bg-[var(--dv-nav-hover)]')}>
          <Icon size={15} strokeWidth={1.8} />{label}
        </motion.button>
      ))}
      <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => onAIQuery?.('Что важно сегодня? Составь приоритеты по клинике, пациентам, диагностике и финансам.')} className={cn(base, 'border-[var(--dv-accent-soft)] bg-[var(--dv-accent-soft)] font-semibold text-[var(--dv-accent)] hover:bg-[var(--dv-nav-hover)]')}><Sparkles size={15} />Мой день</motion.button>
      <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => onAIQuery?.('Подготовь меня к следующему приёму: найди ближайшего пациента и покажи ключевой контекст, открытые планы лечения и важные сигналы.')} className={cn(base, 'border-sky-500/15 bg-sky-500/10 text-sky-600 dark:text-sky-300 hover:bg-sky-500/15')}><ClipboardCheck size={15} />Подготовить приём</motion.button>
      <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => onAIQuery?.('Покажи мои задачи и предложи следующие действия по самым важным пациентам.')} className={cn(base, 'border-[var(--dv-border)] bg-[var(--dv-surface)] text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-text)]')}><ListTodo size={15} />Задачи</motion.button>
      <button type="button" onClick={openSearch} className={cn(base, 'border-[var(--dv-border)] bg-[var(--dv-surface)] text-[var(--dv-muted)] hover:text-[var(--dv-text)]')}><Search size={15} />Поиск<kbd className="hidden rounded border border-[var(--dv-border)] px-1.5 py-0.5 text-[9px] sm:inline">⌘K</kbd></button>
    </div>
  );
};

export default SuperAppQuickActions;
