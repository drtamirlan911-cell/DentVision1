import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Stethoscope, ShoppingCart, Bot, Activity, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { useGuestStore } from '@/store/guest.store';
import { useUIStore } from '@/store/ui.store';

interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  color: string;
  requiresAuth?: boolean;
}

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isGuest, setRegistrationModal } = useGuestStore();
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const { t } = useTranslation();

  // Keep mobile navigation task-first. Secondary destinations remain in the sidebar,
  // so the bottom bar does not duplicate the entire information architecture.
  const ITEMS: BottomNavItem[] = [
    { id: 'ai', label: t('nav.digital_assistant', 'ИИ'), icon: <Bot size={19} />, path: '/ai', color: '#A47B35' },
    { id: 'crm', label: t('nav.crm', 'Клиника'), icon: <Stethoscope size={19} />, path: '/crm/schedule', color: '#A47B35', requiresAuth: true },
    { id: 'diagnostics', label: t('nav.diagnostics', 'Диагностика'), icon: <Activity size={19} />, path: '/diagnostics', color: '#A47B35' },
    { id: 'shop', label: t('nav.market', 'Маркет'), icon: <ShoppingCart size={19} />, path: '/shop', color: '#A47B35' },
    { id: 'more', label: t('nav.more', 'Ещё'), icon: <MoreHorizontal size={20} />, color: '#A47B35' },
  ];

  const handleNavClick = useCallback((item: BottomNavItem) => {
    if (item.id === 'more') {
      toggleSidebar();
      return;
    }
    if (item.id === 'crm' && (!isAuthenticated || isGuest)) {
      navigate('/crm/schedule?demo=1');
      return;
    }
    if (item.requiresAuth && !isAuthenticated && !isGuest) {
      setRegistrationModal(true);
    } else if (item.requiresAuth && isGuest) {
      setRegistrationModal(true, () => navigate(item.path!));
    } else if (item.path) {
      navigate(item.path);
    }
  }, [isAuthenticated, isGuest, navigate, setRegistrationModal, toggleSidebar]);

  return (
    <nav
      aria-label={t('nav.nav_sections', 'Главная навигация')}
      className="fixed bottom-0 left-0 right-0 z-50 overflow-x-hidden border-t border-bdr-subtle bg-surface-1"
      style={{
        paddingBottom: 'var(--dv-safe-bottom)',
        paddingLeft: 'var(--dv-safe-left)',
        paddingRight: 'var(--dv-safe-right)',
      }}
    >
      <div className="mx-auto flex h-[var(--dv-bottomnav-height,3.5rem)] w-full max-w-xl items-stretch justify-between px-1 sm:px-2">
        {ITEMS.map((item) => {
          const isActive = Boolean(item.path) && (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item)}
              whileTap={{ scale: 0.97 }}
              className="relative flex h-full min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center"
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: item.color }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <span className={cn('shrink-0 transition-colors', isActive ? '' : 'text-txt-muted')} style={isActive ? { color: item.color } : undefined}>
                {item.icon}
              </span>
              <span className={cn('max-w-full truncate px-0.5 text-[clamp(9px,2.6vw,10px)] font-medium leading-tight transition-colors', isActive ? '' : 'text-txt-muted')} style={isActive ? { color: item.color } : undefined}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
