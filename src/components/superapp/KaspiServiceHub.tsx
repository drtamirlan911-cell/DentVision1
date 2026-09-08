import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  Activity,
  ShoppingCart,
  GraduationCap,
  CreditCard,
  BarChart3,
  Briefcase,
  Users,
  Grid,
  Zap,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { KaspiAllServicesModal } from './KaspiAllServicesModal';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
}

interface ServiceTile {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  path: string;
  gradient: string;
  borderColor: string;
  textColor: string;
  badge?: string;
  badgeColor?: string;
}

interface KaspiServiceHubProps {
  onAIQuery?: (query: string) => void;
  className?: string;
}

export const KaspiServiceHub: React.FC<KaspiServiceHubProps> = ({ onAIQuery, className }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clinic } = useAuth();
  const [allServicesOpen, setAllServicesOpen] = useState(false);

  const quickActions: QuickAction[] = [
    {
      id: 'appointment',
      label: 'Записать пациента',
      icon: <Plus size={16} className="text-amber-400" />,
      color: 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20',
      action: () => navigate('/crm/schedule?action=new'),
    },
    {
      id: 'receipt',
      label: 'Принять оплату',
      icon: <CreditCard size={16} className="text-emerald-400" />,
      color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20',
      action: () => navigate('/crm/cashier'),
    },
    {
      id: 'diagnostics',
      label: 'Направить на КТ',
      icon: <Activity size={16} className="text-teal-400" />,
      color: 'bg-teal-500/10 border-teal-500/20 text-teal-300 hover:bg-teal-500/20',
      action: () => navigate('/diagnostics/referrals/new'),
    },
    {
      id: 'market',
      label: 'Быстрый заказ',
      icon: <ShoppingCart size={16} className="text-purple-400" />,
      color: 'bg-purple-500/10 border-purple-500/20 text-purple-300 hover:bg-purple-500/20',
      action: () => navigate('/shop'),
    },
    {
      id: 'ai',
      label: 'Спросить AI',
      icon: <Sparkles size={16} className="text-dv-gold" />,
      color: 'bg-dv-gold/10 border-dv-gold/20 text-dv-gold hover:bg-dv-gold/20',
      action: () => onAIQuery?.('Что важно сегодня?'),
    },
  ];

  const serviceTiles: ServiceTile[] = [
    {
      id: 'crm',
      title: 'CRM Клиника',
      subtitle: 'Записи, карты и расписание',
      icon: <Stethoscope size={24} className="text-amber-400" />,
      path: '/crm/schedule',
      gradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
      borderColor: 'border-amber-500/25',
      textColor: 'text-amber-400',
      badge: '18 записей',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'diagnostics',
      title: '3D Диагностика',
      subtitle: 'КТ, сканы и лаборатории',
      icon: <Activity size={24} className="text-emerald-400" />,
      path: '/diagnostics',
      gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      borderColor: 'border-emerald-500/25',
      textColor: 'text-emerald-400',
      badge: '2 скана',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'shop',
      title: 'DentMarket',
      subtitle: 'Расходники и материалы',
      icon: <ShoppingCart size={24} className="text-purple-400" />,
      path: '/shop',
      gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
      borderColor: 'border-purple-500/25',
      textColor: 'text-purple-400',
      badge: 'Скидки',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
    {
      id: 'school',
      title: 'Academy OS',
      subtitle: 'Курсы и мастер-классы',
      icon: <GraduationCap size={24} className="text-teal-400" />,
      path: '/school',
      gradient: 'from-teal-500/15 via-teal-500/5 to-transparent',
      borderColor: 'border-teal-500/25',
      textColor: 'text-teal-400',
      badge: 'PRO',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    },
    {
      id: 'finance',
      title: 'Касса & Чеки',
      subtitle: 'Оплаты и баланс DentCash',
      icon: <CreditCard size={24} className="text-sky-400" />,
      path: '/crm/finance',
      gradient: 'from-sky-500/15 via-sky-500/5 to-transparent',
      borderColor: 'border-sky-500/25',
      textColor: 'text-sky-400',
    },
    {
      id: 'analytics',
      title: 'Аналитика',
      subtitle: 'Выручка и загрузка врачей',
      icon: <BarChart3 size={24} className="text-yellow-400" />,
      path: '/analytics',
      gradient: 'from-yellow-500/15 via-yellow-500/5 to-transparent',
      borderColor: 'border-yellow-500/25',
      textColor: 'text-yellow-400',
    },
    {
      id: 'jobs',
      title: 'Вакансии',
      subtitle: 'Поиск врачей и ассистентов',
      icon: <Briefcase size={24} className="text-orange-400" />,
      path: '/jobs',
      gradient: 'from-orange-500/15 via-orange-500/5 to-transparent',
      borderColor: 'border-orange-500/25',
      textColor: 'text-orange-400',
    },
    {
      id: 'community',
      title: 'Сообщество',
      subtitle: 'Опыт и профессиональный чат',
      icon: <Users size={24} className="text-blue-400" />,
      path: '/community',
      gradient: 'from-blue-500/15 via-blue-500/5 to-transparent',
      borderColor: 'border-blue-500/25',
      textColor: 'text-blue-400',
    },
  ];

  return (
    <div className={cn('space-y-4 w-full', className)}>
      {/* Quick Header & Wallet Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-surface-1 via-surface-2 to-surface-1 border border-white/[0.08] shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dv-gold/15 border border-dv-gold/30 text-dv-gold shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-txt-primary">
                SuperApp DentVision
              </h3>
              {clinic?.name && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-txt-secondary font-medium">
                  {clinic.name}
                </span>
              )}
            </div>
            <p className="text-xs text-txt-muted">Все сервисы клиники в одном месте как в Kaspi</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAllServicesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-txt-primary hover:bg-white/10 hover:border-dv-gold/30 transition-all"
          >
            <Grid size={15} className="text-dv-gold" />
            <span>Все сервисы</span>
          </button>
        </div>
      </div>

      {/* Quick Action Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <span className="text-xs font-semibold text-txt-ghost uppercase tracking-wider shrink-0 px-1">
          Быстро:
        </span>
        {quickActions.map((qa) => (
          <motion.button
            key={qa.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={qa.action}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium shrink-0 transition-all shadow-sm',
              qa.color
            )}
          >
            {qa.icon}
            <span>{qa.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Main Service Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {serviceTiles.map((tile) => (
          <motion.button
            key={tile.id}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(tile.path)}
            className={cn(
              'group relative flex flex-col justify-between p-4 rounded-2xl border text-left transition-all duration-200 overflow-hidden shadow-md',
              'bg-gradient-to-br',
              tile.gradient,
              tile.borderColor,
              'hover:shadow-lg hover:border-white/20'
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2.5 rounded-xl bg-surface-1/80 border border-white/10 group-hover:scale-105 transition-transform">
                {tile.icon}
              </div>
              {tile.badge && (
                <span
                  className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                    tile.badgeColor
                  )}
                >
                  {tile.badge}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-sm sm:text-base font-semibold text-txt-primary group-hover:text-txt-primary transition-colors">
                  {tile.title}
                </h4>
                <ArrowRight
                  size={15}
                  className="text-txt-muted opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-dv-gold"
                />
              </div>
              <p className="text-xs text-txt-muted mt-0.5 line-clamp-1">{tile.subtitle}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* All Services Modal */}
      <KaspiAllServicesModal
        open={allServicesOpen}
        onClose={() => setAllServicesOpen(false)}
        onAIQuery={onAIQuery}
      />
    </div>
  );
};
