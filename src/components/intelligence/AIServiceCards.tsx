import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ServiceCardDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  gradient: string;
  category: 'crm' | 'shop' | 'school' | 'platform';
}

export const AI_SERVICES: ServiceCardDef[] = [
  { id: 'crm', name: 'CRM', description: 'Пациенты и расписание', icon: <StethoscopeIcon size={20} />, path: '/crm/schedule', color: '#C9A96E', gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5', category: 'crm' },
  { id: 'shop', name: 'Shop', description: 'Маркетплейс товаров', icon: <ShoppingCartIcon size={20} />, path: '/shop', color: '#8E44AD', gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5', category: 'shop' },
  { id: 'school', name: 'School', description: 'Обучение и вебинары', icon: <GraduationCapIcon size={20} />, path: '/school', color: '#16A085', gradient: 'from-[#16A085]/20 to-[#16A085]/5', category: 'school' },
  { id: 'jobs', name: 'Вакансии', description: 'Поиск сотрудников', icon: <JobsIcon size={20} />, path: '/crm/staff', color: '#E67E22', gradient: 'from-[#E67E22]/20 to-[#E67E22]/5', category: 'platform' },
  { id: 'analytics', name: 'Analytics', description: 'Отчёты и метрики', icon: <AnalyticsIcon size={20} />, path: '/analytics', color: '#F39C12', gradient: 'from-[#F39C12]/20 to-[#F39C12]/5', category: 'platform' },
  { id: 'finance', name: 'Finance', description: 'Финансы и отчёты', icon: <FinanceIcon size={20} />, path: '/crm/cashier', color: '#27AE60', gradient: 'from-[#27AE60]/20 to-[#27AE60]/5', category: 'platform' },
  { id: 'laboratory', name: 'Laboratory', description: 'Лабораторные заказы', icon: <LaboratoryIcon size={20} />, path: '/crm/lab', color: '#00BCD4', gradient: 'from-[#00BCD4]/20 to-[#00BCD4]/5', category: 'crm' },
  { id: 'marketplace', name: 'Marketplace', description: 'B2B площадка', icon: <MarketplaceIcon size={20} />, path: '/shop/suppliers', color: '#E74C3C', gradient: 'from-[#E74C3C]/20 to-[#E74C3C]/5', category: 'platform' },
  { id: 'settings', name: 'Settings', description: 'Настройки системы', icon: <SettingsIcon size={20} />, path: '/settings', color: '#5DADE2', gradient: 'from-[#5DADE2]/20 to-[#5DADE2]/5', category: 'platform' },
];

export const AI_PLATFORM_SERVICES: ServiceCardDef[] = [
  { id: 'profile', name: 'Профиль', description: 'Профессиональный профиль', icon: <ProfileIcon size={20} />, path: '/profile', color: '#2980B9', gradient: 'from-[#2980B9]/20 to-[#2980B9]/5', category: 'platform' },
  { id: 'admin', name: 'Super Admin', description: 'Управление платформой', icon: <AdminIcon size={20} />, path: '/admin', color: '#E74C3C', gradient: 'from-[#E74C3C]/20 to-[#E74C3C]/5', category: 'platform' },
  { id: 'audit', name: 'Аудит', description: 'Журнал действий', icon: <AuditIcon size={20} />, path: '/audit', color: '#F39C12', gradient: 'from-[#F39C12]/20 to-[#F39C12]/5', category: 'platform' },
  { id: 'backup', name: 'Бэкапы', description: 'Резервное копирование', icon: <BackupIcon size={20} />, path: '/backup', color: '#00BCD4', gradient: 'from-[#00BCD4]/20 to-[#00BCD4]/5', category: 'platform' },
];

// ─── SVG Icons ───

function StethoscopeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2" />
      <path d="M12 11v7" />
      <path d="M8 15h8" />
      <path d="M18 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
      <circle cx="18" cy="13" r="3" />
      <path d="M18 16v3" />
    </svg>
  );
}

function ShoppingCartIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function GraduationCapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 1.1 2.2 2 6 2s6-.9 6-2v-5" />
      <path d="M4 12v3" />
    </svg>
  );
}

function JobsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M8 12h8" />
      <path d="M8 16h6" />
    </svg>
  );
}

function AnalyticsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <path d="M2 20h20" />
    </svg>
  );
}

function FinanceIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1v22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      <circle cx="12" cy="2" r="1" fill="currentColor" />
    </svg>
  );
}

function LaboratoryIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.07-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 15h10" />
    </svg>
  );
}

function MarketplaceIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M2 9h20" />
      <path d="M12 9v12" />
      <path d="M6 9V6a6 6 0 0 1 12 0v3" />
    </svg>
  );
}

function SettingsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ProfileIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function AdminIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function AuditIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function BackupIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

// ─── Components ───

interface AIServiceCardsProps {
  services: ServiceCardDef[];
  onSelect: (service: ServiceCardDef) => void;
  className?: string;
  variant?: 'ring' | 'grid' | 'sidebar';
  animated?: boolean;
  delayBase?: number;
}

export function AIServiceCards({
  services,
  onSelect,
  className,
  variant = 'grid',
  animated = true,
  delayBase = 0,
}: AIServiceCardsProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: delayBase,
      },
    },
  } as Variants;

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 25 },
    },
  } as Variants;

  const ringVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    show: (i: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
        delay: delayBase + i * 0.08,
      },
    }),
  } as Variants;

  if (variant === 'ring') {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={cn('relative', className)}
        style={{ width: 420, height: 420 }}
      >
        {services.map((service, i) => {
          const angle = (i / services.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 170;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.div
              key={service.id}
              variants={ringVariants}
              custom={i}
              style={{ x, y }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onSelect(service)}
                className={cn(
                  'group relative flex flex-col items-center gap-2 w-28 p-3 rounded-2xl border border-white/10',
                  'bg-gradient-to-br transition-all duration-300',
                  service.gradient,
                  'hover:border-white/30 hover:shadow-xl hover:shadow-black/20'
                )}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl mb-1 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `${service.color}20`, color: service.color }}
                >
                  {service.icon}
                </div>
                <span className="text-xs font-semibold text-white text-center leading-tight">{service.name}</span>
                <span className="text-[10px] text-white/50 text-center">{service.description}</span>
              </motion.button>
            </motion.div>
          );
        })}
      </motion.div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <nav className={cn('flex-1 overflow-y-auto px-2 py-3 space-y-1', className)}>
        {services.map((item, i) => (
          <motion.button
            key={item.id}
            variants={itemVariants}
            onClick={() => onSelect(item)}
              className={cn(
                  'group relative flex w-full items-center gap-2.5 rounded-lg transition-all duration-150',
                  'px-3 py-2',
                  animated
                    ? 'text-txt-secondary hover:bg-white/[0.04] hover:text-txt-primary'
                    : ''
                )}
                whileTap={{ scale: 0.98 }}
          >
            <span className={cn('shrink-0 transition-colors', 'text-txt-muted group-hover:text-txt-secondary')}>
              {item.icon}
            </span>
            <span className="text-sm truncate">{item.name}</span>
          </motion.button>
        ))}
      </nav>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={cn('grid grid-cols-2 md:grid-cols-3 gap-2.5', className)}
    >
      {services.map((service) => (
        <motion.button
          key={service.id}
          variants={itemVariants}
          whileHover={{ scale: 1.03, y: -3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(service)}
          className={cn(
            'group relative overflow-hidden rounded-xl border border-white/10 p-3 text-left',
            'bg-gradient-to-br transition-all duration-200',
            service.gradient,
            'hover:border-white/30 hover:shadow-lg hover:shadow-black/10'
          )}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl mb-2 transition-transform duration-200 group-hover:scale-110"
            style={{ background: `${service.color}20`, color: service.color }}
          >
            {service.icon}
          </div>
          <h3 className="text-sm font-semibold text-txt-primary">{service.name}</h3>
          <p className="text-xs text-txt-muted">{service.description}</p>
        </motion.button>
      ))}
    </motion.div>
  );
}

export function AIServiceCard({ service, onClick, className }: { service: ServiceCardDef; onClick: () => void; className?: string }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-white/10 p-4 text-left',
        'bg-gradient-to-br transition-all duration-200',
        service.gradient,
        'hover:border-white/30 hover:shadow-lg hover:shadow-black/10',
        className
      )}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl mb-3 transition-transform duration-200 group-hover:scale-110"
        style={{ background: `${service.color}20`, color: service.color }}
      >
        {service.icon}
      </div>
      <h3 className="text-base font-semibold text-txt-primary mb-1 group-hover:text-dv-gold transition-colors">
        {service.name}
      </h3>
      <p className="text-sm text-txt-muted line-clamp-2">{service.description}</p>
    </motion.button>
  );
}
