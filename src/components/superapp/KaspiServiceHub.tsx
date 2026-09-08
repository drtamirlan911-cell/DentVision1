import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Stethoscope, Activity, ShoppingCart, GraduationCap, CreditCard,
  BarChart3, Briefcase, Users, Grid, Zap, Plus, ArrowRight, Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { KaspiAllServicesModal } from './KaspiAllServicesModal';
import { SuperAppQuickActions } from './SuperAppQuickActions';

interface ServiceTile {
  id: string; title: string; subtitle: string; icon: React.ReactNode;
  path: string; badge?: string; tone: string;
}

interface KaspiServiceHubProps { onAIQuery?: (query: string) => void; className?: string; }

export const KaspiServiceHub: React.FC<KaspiServiceHubProps> = ({ onAIQuery, className }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clinic } = useAuth();
  const [allServicesOpen, setAllServicesOpen] = useState(false);

  const serviceTiles: ServiceTile[] = [
    { id: 'crm', title: 'Клиника', subtitle: 'Пациенты · записи · лечение', icon: <Stethoscope size={21} />, path: '/crm/schedule', badge: '18 записей', tone: 'amber' },
    { id: 'diagnostics', title: 'Диагностика', subtitle: 'КТ · 3D · исследования', icon: <Activity size={21} />, path: '/diagnostics', badge: '2 скана', tone: 'emerald' },
    { id: 'shop', title: 'DentMarket', subtitle: 'Материалы · оборудование', icon: <ShoppingCart size={21} />, path: '/shop', badge: 'Скидки', tone: 'violet' },
    { id: 'school', title: 'Academy', subtitle: 'Курсы · навыки · развитие', icon: <GraduationCap size={21} />, path: '/school', badge: 'PRO', tone: 'teal' },
    { id: 'finance', title: 'Финансы', subtitle: 'Касса · оплаты · баланс', icon: <CreditCard size={21} />, path: '/crm/finance', tone: 'sky' },
    { id: 'analytics', title: 'Аналитика', subtitle: 'Выручка · загрузка · KPI', icon: <BarChart3 size={21} />, path: '/analytics', tone: 'yellow' },
    { id: 'jobs', title: 'Jobs', subtitle: 'Врачи · ассистенты · найм', icon: <Briefcase size={21} />, path: '/jobs', tone: 'orange' },
    { id: 'community', title: 'Community', subtitle: 'Профессиональная сеть', icon: <Users size={21} />, path: '/community', tone: 'blue' },
  ];

  const toneClasses: Record<string, string> = {
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
    teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
    sky: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
    yellow: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
    orange: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
    blue: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className={cn('w-full space-y-4', className)}>
      <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-1/70 p-4 sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(212,175,55,0.10),transparent_34%)] pointer-events-none" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dv-gold/25 bg-dv-gold/10 text-dv-gold"><Zap size={16} /></span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-txt-ghost">DentVision Command Center</span>
            </div>
            <h3 className="text-base font-semibold text-txt-primary sm:text-lg">Всё необходимое — в одном рабочем контексте</h3>
            <p className="mt-1 max-w-2xl text-xs text-txt-muted">{clinic?.name ? `${clinic.name} · ` : ''}AI соединяет клинику, диагностику, финансы, обучение и рынок.</p>
          </div>
          <button type="button" onClick={() => setAllServicesOpen(true)} className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-txt-primary transition-colors hover:border-dv-gold/30 hover:bg-white/[0.07]">
            <Grid size={15} className="text-dv-gold" /> Все сервисы
          </button>
        </div>
      </section>

      <SuperAppQuickActions onAIQuery={onAIQuery} />

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <div><h4 className="text-sm font-semibold text-txt-primary">Сервисы</h4><p className="text-[11px] text-txt-muted">Открывайте нужный рабочий контекст без перегруженного меню.</p></div>
          <button type="button" onClick={() => setAllServicesOpen(true)} className="hidden items-center gap-1 text-xs font-medium text-dv-gold sm:flex">Все <ArrowRight size={13} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:gap-3">
          {serviceTiles.map((tile) => (
            <motion.button key={tile.id} whileTap={{ scale: 0.98 }} onClick={() => navigate(tile.path)} className="group min-h-[104px] rounded-xl border border-white/[0.07] bg-surface-1/55 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-white/15 hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dv-gold/50">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', toneClasses[tile.tone])}>{tile.icon}</span>
                {tile.badge && <span className="max-w-[74px] truncate rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-txt-muted">{tile.badge}</span>}
              </div>
              <div className="flex items-center justify-between gap-1"><span className="truncate text-sm font-semibold text-txt-primary">{tile.title}</span><ArrowRight size={13} className="shrink-0 text-txt-ghost opacity-0 transition-opacity group-hover:opacity-100" /></div>
              <p className="mt-0.5 truncate text-[10px] text-txt-muted">{tile.subtitle}</p>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dv-gold/15 bg-dv-gold/[0.04] p-3.5 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><Sparkles size={16} className="text-dv-gold" /><span className="text-xs font-semibold text-txt-primary">AI может связать эти сервисы в одно действие</span></div>
          <button type="button" onClick={() => onAIQuery?.('Покажи, что требует моего внимания сегодня, и предложи следующие действия')} className="inline-flex items-center gap-1.5 self-start rounded-lg bg-dv-gold/10 px-2.5 py-1.5 text-[11px] font-semibold text-dv-gold hover:bg-dv-gold/15 sm:self-auto">Спросить DentVision AI <ArrowRight size={12} /></button>
        </div>
      </section>

      <KaspiAllServicesModal open={allServicesOpen} onClose={() => setAllServicesOpen(false)} onAIQuery={onAIQuery} />
    </div>
  );
};
