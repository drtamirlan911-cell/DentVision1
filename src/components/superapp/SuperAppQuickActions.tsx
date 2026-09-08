import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CalendarPlus, CreditCard, Search, Sparkles, UserPlus, ClipboardCheck, ListTodo } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface SuperAppQuickActionsProps {
  onAIQuery?: (query: string) => void;
  className?: string;
}

const actions = [
  { id: 'appointment', label: 'Новая запись', icon: CalendarPlus, path: '/crm/schedule?action=new', tone: 'amber' },
  { id: 'patient', label: 'Новый пациент', icon: UserPlus, path: '/crm/patients?action=new', tone: 'blue' },
  { id: 'diagnostics', label: 'Направление', icon: Activity, path: '/diagnostics/referrals/new', tone: 'emerald' },
  { id: 'payment', label: 'Оплата', icon: CreditCard, path: '/crm/cashier', tone: 'violet' },
] as const;

const toneClass: Record<string, string> = {
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  violet: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
};

export const SuperAppQuickActions: React.FC<SuperAppQuickActionsProps> = ({ onAIQuery, className }) => {
  const navigate = useNavigate();

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, ctrlKey: false, bubbles: true }));
  };

  return (
    <div className={cn('flex w-full items-center gap-2 overflow-x-auto pb-1 no-scrollbar', className)}>
      <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-txt-ghost">Быстро</span>
      {actions.map(({ id, label, icon: Icon, path, tone }) => (
        <motion.button
          key={id}
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(path)}
          className={cn('flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50', toneClass[tone])}
        >
          <Icon size={15} />
          {label}
        </motion.button>
      ))}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => onAIQuery?.('Что важно сегодня? Составь приоритеты по клинике, пациентам, диагностике и финансам.')}
        className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-dv-gold/20 bg-dv-gold/10 px-3 text-xs font-semibold text-dv-gold transition-colors hover:bg-dv-gold/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50"
      >
        <Sparkles size={15} />
        Мой день
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => onAIQuery?.('Подготовь меня к следующему приёму: найди ближайшего пациента и покажи ключевой контекст, открытые планы лечения и важные сигналы.')}
        className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
      >
        <ClipboardCheck size={15} />
        Подготовить приём
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => onAIQuery?.('Покажи мои задачи и предложи следующие действия по самым важным пациентам.')}
        className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-txt-secondary transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      >
        <ListTodo size={15} />
        Задачи
      </motion.button>
      <button
        type="button"
        onClick={openSearch}
        className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-bdr-subtle bg-surface-1/60 px-3 text-xs font-medium text-txt-secondary transition-colors hover:text-txt-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50"
      >
        <Search size={15} />
        Поиск
        <kbd className="hidden rounded border border-bdr-subtle px-1.5 py-0.5 text-[9px] sm:inline">⌘K</kbd>
      </button>
    </div>
  );
};

export default SuperAppQuickActions;
