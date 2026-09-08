import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Stethoscope, Activity, ShoppingCart, GraduationCap, CreditCard, BarChart3, Briefcase, Users, Grid, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { KaspiAllServicesModal } from './KaspiAllServicesModal';
import { SuperAppQuickActions } from './SuperAppQuickActions';

interface ServiceTile { id: string; title: string; subtitle: string; icon: React.ReactNode; path: string; badge?: string; tone: string }
interface KaspiServiceHubProps { onAIQuery?: (query: string) => void; className?: string }

const services: ServiceTile[] = [
  { id: 'crm', title: 'Клиника', subtitle: 'Пациенты · записи · лечение', icon: <Stethoscope />, path: '/crm/schedule', badge: 'Сегодня', tone: 'accent' },
  { id: 'diagnostics', title: 'Диагностика', subtitle: 'КТ · 3D · исследования', icon: <Activity />, path: '/diagnostics', tone: 'success' },
  { id: 'shop', title: 'DentMarket', subtitle: 'Материалы · оборудование', icon: <ShoppingCart />, path: '/shop', tone: 'violet' },
  { id: 'school', title: 'Academy', subtitle: 'Курсы · навыки · развитие', icon: <GraduationCap />, path: '/school', tone: 'teal' },
  { id: 'finance', title: 'Финансы', subtitle: 'Касса · оплаты · баланс', icon: <CreditCard />, path: '/crm/cashier', tone: 'info' },
  { id: 'analytics', title: 'Аналитика', subtitle: 'Выручка · загрузка · KPI', icon: <BarChart3 />, path: '/analytics', tone: 'warning' },
  { id: 'jobs', title: 'Jobs', subtitle: 'Врачи · ассистенты · найм', icon: <Briefcase />, path: '/jobs', tone: 'orange' },
  { id: 'community', title: 'Community', subtitle: 'Профессиональная сеть', icon: <Users />, path: '/community', tone: 'blue' },
];

const toneClasses: Record<string, string> = {
  accent: 'border-[var(--dv-accent-soft)] bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]',
  success: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  violet: 'border-violet-500/15 bg-violet-500/10 text-violet-600 dark:text-violet-300',
  teal: 'border-teal-500/15 bg-teal-500/10 text-teal-600 dark:text-teal-300',
  info: 'border-sky-500/15 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  warning: 'border-amber-500/15 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  orange: 'border-orange-500/15 bg-orange-500/10 text-orange-600 dark:text-orange-300',
  blue: 'border-blue-500/15 bg-blue-500/10 text-blue-600 dark:text-blue-300',
};

export const KaspiServiceHub: React.FC<KaspiServiceHubProps> = ({ onAIQuery, className }) => {
  useTranslation();
  const navigate = useNavigate();
  const { clinic } = useAuth();
  const [allServicesOpen, setAllServicesOpen] = useState(false);

  return (
    <div className={cn('w-full space-y-5', className)}>
      <section className="dv-panel relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,var(--dv-accent-soft),transparent_34%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--dv-muted-2)]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--dv-accent-soft)] bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]"><Zap size={14} /></span>
              DentVision Command Center
            </div>
            <h3 className="text-base font-semibold tracking-[-0.015em] text-[var(--dv-text)] sm:text-lg">Всё необходимое — в одном рабочем контексте</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--dv-muted)]">{clinic?.name ? `${clinic.name} · ` : ''}AI соединяет клинику, диагностику, финансы, обучение и рынок.</p>
          </div>
          <button type="button" onClick={() => setAllServicesOpen(true)} className="dv-focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[11px] border border-[var(--dv-border)] bg-[var(--dv-surface-2)] px-3 text-xs font-semibold text-[var(--dv-text)] transition-colors hover:border-[var(--dv-border-strong)] hover:bg-[var(--dv-nav-hover)]">
            <Grid size={15} className="text-[var(--dv-accent)]" /> Все сервисы
          </button>
        </div>
      </section>

      <SuperAppQuickActions onAIQuery={onAIQuery} />

      <section>
        <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
          <div><h4 className="text-sm font-semibold text-[var(--dv-text)]">Сервисы</h4><p className="text-[11px] leading-5 text-[var(--dv-muted)]">Рабочие контексты DentVision</p></div>
          <button type="button" onClick={() => setAllServicesOpen(true)} className="dv-focus-ring hidden min-h-11 items-center gap-1 px-2 text-xs font-medium text-[var(--dv-accent)] sm:inline-flex">Все <ArrowRight size={13} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:gap-3">
          {services.map((tile) => (
            <motion.button key={tile.id} type="button" whileTap={{ scale: 0.985 }} onClick={() => navigate(tile.path)} className="dv-focus-ring group flex min-h-[112px] flex-col rounded-[14px] border border-[var(--dv-border)] bg-[var(--dv-surface)] p-3 text-left shadow-[var(--dv-shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--dv-border-strong)] hover:shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border', toneClasses[tile.tone])}>{React.cloneElement(tile.icon as React.ReactElement, { size: 18, strokeWidth: 1.8 })}</span>
                {tile.badge && <span className="max-w-[74px] truncate rounded-full border border-[var(--dv-border)] bg-[var(--dv-surface-2)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--dv-muted)]">{tile.badge}</span>}
              </div>
              <div className="mt-auto flex items-center justify-between gap-1"><span className="truncate text-sm font-semibold text-[var(--dv-text)]">{tile.title}</span><ArrowRight size={13} className="shrink-0 text-[var(--dv-muted-2)] transition-transform duration-200 group-hover:translate-x-0.5" /></div>
              <p className="mt-0.5 truncate text-[10px] text-[var(--dv-muted)]">{tile.subtitle}</p>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="rounded-[14px] border border-[var(--dv-accent-soft)] bg-[var(--dv-accent-soft)]/40 p-3.5 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><Sparkles size={16} className="text-[var(--dv-accent)]" /><span className="text-xs font-semibold text-[var(--dv-text)]">AI связывает сервисы в одно действие</span></div>
          <button type="button" onClick={() => onAIQuery?.('Покажи, что требует моего внимания сегодня, и предложи следующие действия')} className="dv-focus-ring inline-flex min-h-10 items-center gap-1.5 self-start rounded-[10px] border border-[var(--dv-accent-soft)] bg-[var(--dv-surface)] px-2.5 text-[11px] font-semibold text-[var(--dv-accent)] hover:bg-[var(--dv-nav-hover)] sm:self-auto">Спросить DentVision AI <ArrowRight size={12} /></button>
        </div>
      </section>

      <KaspiAllServicesModal open={allServicesOpen} onClose={() => setAllServicesOpen(false)} onAIQuery={onAIQuery} />
    </div>
  );
};