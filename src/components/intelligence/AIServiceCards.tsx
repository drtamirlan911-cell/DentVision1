import React from 'react';
import { motion } from 'framer-motion';
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
  { id: 'crm', name: 'CRM', description: 'Пациенты, расписание, лечение', icon: <StethoscopeIcon size={20} />, path: '/crm/schedule', color: '#C9A96E', gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5', category: 'crm' },
  { id: 'patients', name: 'Пациенты', description: 'База и поиск пациентов', icon: <UsersIcon size={20} />, path: '/crm/patients', color: '#E74C3C', gradient: 'from-[#E74C3C]/20 to-[#E74C3C]/5', category: 'crm' },
  { id: 'schedule', name: 'Расписание', description: 'Календарь и записи', icon: <CalendarIcon size={20} />, path: '/crm/schedule', color: '#27AE60', gradient: 'from-[#27AE60]/20 to-[#27AE60]/5', category: 'crm' },
  { id: 'cashier', name: 'Касса', description: 'Финансы и оплаты', icon: <DollarSignIcon size={20} />, path: '/crm/cashier', color: '#2980B9', gradient: 'from-[#2980B9]/20 to-[#2980B9]/5', category: 'crm' },
  { id: 'lab', name: 'Лаборатория', description: 'Лабораторные заказы', icon: <FlaskConicalIcon size={20} />, path: '/crm/lab', color: '#00BCD4', gradient: 'from-[#00BCD4]/20 to-[#00BCD4]/5', category: 'crm' },
  { id: 'documents', name: 'Документы', description: 'Документооборот', icon: <FileTextIcon size={20} />, path: '/crm/documents', color: '#8E44AD', gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5', category: 'crm' },
  { id: 'shop', name: 'Shop', description: 'Маркетплейс товаров', icon: <ShoppingCartIcon size={20} />, path: '/shop', color: '#8E44AD', gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5', category: 'shop' },
  { id: 'school', name: 'School', description: 'Образовательная платформа', icon: <GraduationCapIcon size={20} />, path: '/school', color: '#16A085', gradient: 'from-[#16A085]/20 to-[#16A085]/5', category: 'school' },
  { id: 'analytics', name: 'Аналитика', description: 'Отчёты и метрики', icon: <BarChart3Icon size={20} />, path: '/analytics', color: '#F39C12', gradient: 'from-[#F39C12]/20 to-[#F39C12]/5', category: 'platform' },
];

export const AI_PLATFORM_SERVICES: ServiceCardDef[] = [
  { id: 'dashboard', name: 'Главная', description: 'Обзор и быстрые действия', icon: <LayoutDashboardIcon size={20} />, path: '/dashboard', color: '#C9A96E', gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5', category: 'platform' },
  { id: 'ai', name: 'AI Команда', description: 'Интеллектуальные агенты', icon: <BotIcon size={20} />, path: '/ai', color: '#8E44AD', gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5', category: 'platform' },
  { id: 'profile', name: 'Профиль', description: 'Профессиональный профиль', icon: <UserIcon size={20} />, path: '/profile', color: '#2980B9', gradient: 'from-[#2980B9]/20 to-[#2980B9]/5', category: 'platform' },
  { id: 'admin', name: 'Super Admin', description: 'Управление платформой', icon: <ShieldIcon size={20} />, path: '/admin', color: '#E74C3C', gradient: 'from-[#E74C3C]/20 to-[#E74C3C]/5', category: 'platform' },
  { id: 'audit', name: 'Аудит', description: 'Журнал действий', icon: <FileTextIcon size={20} />, path: '/audit', color: '#F39C12', gradient: 'from-[#F39C12]/20 to-[#F39C12]/5', category: 'platform' },
  { id: 'backup', name: 'Бэкапы', description: 'Резервное копирование', icon: <DatabaseIcon size={20} />, path: '/backup', color: '#00BCD4', gradient: 'from-[#00BCD4]/20 to-[#00BCD4]/5', category: 'platform' },
];

// Icon components
function StethoscopeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function UsersIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CalendarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function DollarSignIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function FlaskConicalIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.31M14 2v7.31M6 14a6.5 6.5 0 1 1 12 0h0a6.5 6.5 0 0 1-12 0z" />
    </svg>
  );
}

function FileTextIcon({ size = 20 }: { size?: number }) {
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
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.92 1.22a1 1 0 0 0-1.837 0L2.58 9.084a1 1 0 0 0 0 1.838l8.41 7.86a1 1 0 0 0 1.823 0l8.41-7.86z" />
      <path d="M22 10.92v6.16a1 1 0 0 1-.48.866l-8.41 7.86a1 1 0 0 1-1.82 0l-8.41-7.86A1 1 0 0 1 2 17.08V10.92" />
      <path d="M12 4.5v15" />
    </svg>
  );
}

function BarChart3Icon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

function BotIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 17h8M6 17h2v4H6v-4" />
    </svg>
  );
}

function UserIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function DatabaseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function LayoutDashboardIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

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
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 25 },
    },
  };

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
  };

  if (variant === 'ring') {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={cn('relative', className)}
        style={{ width: 400, height: 400 }}
      >
        {services.map((service, i) => {
          const angle = (i / services.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 160;
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
                  'relative flex flex-col items-center gap-2 w-28 p-3 rounded-2xl border border-bdr-subtle',
                  'bg-gradient-to-br transition-all duration-300',
                  service.gradient,
                  'hover:border-bdr/50 hover:shadow-xl hover:shadow-black/10'
                )}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl mb-1 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `${service.color}20`, color: service.color }}
                >
                  {service.icon}
                </div>
                <span className="text-xs font-semibold text-txt-primary text-center leading-tight">{service.name}</span>
                <span className="text-[10px] text-txt-muted text-center">{service.description}</span>
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
            style={{ animationDelay: `${delayBase + i * 50}ms` }}
          >
            <span className={cn('shrink-0 transition-colors', 'text-txt-muted group-hover:text-txt-secondary')}>
              {item.icon}
            </span>
            <span className="text-sm truncate">{item.label}</span>
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
      className={cn('grid grid-cols-2 md:grid-cols-4 gap-2.5', className)}
    >
      {services.map((service) => (
        <motion.button
          key={service.id}
          variants={itemVariants}
          whileHover={{ scale: 1.03, y: -3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(service)}
          className={cn(
            'group relative overflow-hidden rounded-xl border border-bdr-subtle p-3 text-left',
            'bg-gradient-to-br transition-all duration-200',
            service.gradient,
            'hover:border-bdr/50 hover:shadow-lg hover:shadow-black/5'
          )}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl mb-2 transition-transform duration-200 group-hover:scale-110"
            style={{ background: `${service.color}15`, color: service.color }}
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
        'group relative overflow-hidden rounded-xl border border-bdr-subtle p-4 text-left',
        'bg-gradient-to-br transition-all duration-200',
        service.gradient,
        'hover:border-bdr/50 hover:shadow-lg hover:shadow-black/5',
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