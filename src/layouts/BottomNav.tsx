import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Stethoscope, ShoppingCart, GraduationCap, Users, Bot, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { useGuestStore } from '@/store/guest.store';

interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  requiresAuth?: boolean;
}

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isGuest, setRegistrationModal } = useGuestStore();
  const { t } = useTranslation();

  const ITEMS: BottomNavItem[] = [
    { id: 'crm', label: t('nav.crm', 'Клиника'), icon: <Stethoscope size={18} />, path: '/crm/schedule', color: '#A47B35', requiresAuth: true },
    { id: 'shop', label: t('nav.market', 'Маркет'), icon: <ShoppingCart size={18} />, path: '/shop', color: '#A47B35' },
    { id: 'ai', label: t('nav.digital_assistant', 'ИИ'), icon: <Bot size={18} />, path: '/ai', color: '#A47B35' },
    { id: 'school', label: t('nav.school', 'Академия'), icon: <GraduationCap size={18} />, path: '/school', color: '#A47B35' },
    { id: 'community', label: t('nav.community', 'Сообщество'), icon: <Users size={18} />, path: '/community', color: '#A47B35' },
  ];

  const handleNavClick = useCallback((item: BottomNavItem) => {
    if (item.id === 'crm' && (!isAuthenticated || isGuest)) {
      navigate('/crm/schedule?demo=1');
      return;
    }
    if (item.requiresAuth && !isAuthenticated && !isGuest) {
      setRegistrationModal(true);
    } else if (item.requiresAuth && isGuest) {
      setRegistrationModal(true, () => navigate(item.path));
    } else {
      navigate(item.path);
    }
  }, [isAuthenticated, isGuest, navigate, setRegistrationModal]);

  return (
    <nav
      aria-label={t('nav.nav_sections', 'Главная навигация')}
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1 border-t border-bdr-subtle overflow-x-hidden"
      style={{
        paddingBottom: 'var(--dv-safe-bottom)',
        paddingLeft: 'var(--dv-safe-left)',
        paddingRight: 'var(--dv-safe-right)',
      }}
    >
      <div className="mx-auto flex h-[var(--dv-bottomnav-height,3.5rem)] w-full max-w-xl items-stretch justify-between px-1 sm:px-2">
        {ITEMS.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const isDisabled = item.id !== 'crm' && item.requiresAuth && !isAuthenticated && !isGuest;
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item)}
              whileTap={{ scale: 0.97 }}
              className="relative flex h-full min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center"
              disabled={isDisabled}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: item.color }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <span className={cn('shrink-0 transition-colors', isActive ? '' : 'text-txt-muted', isDisabled && 'opacity-40')}>
                {isDisabled ? <LogIn size={18} className="text-txt-muted" /> : item.icon}
              </span>
              <span
                className={cn(
                  'max-w-full truncate px-0.5 text-[clamp(9px,2.6vw,10px)] font-medium leading-tight transition-colors',
                  isActive ? '' : 'text-txt-muted',
                  isDisabled && 'text-txt-muted',
                )}
                style={isActive ? { color: item.color } : undefined}
              >
                {isDisabled ? t('nav.login', 'Войти') : item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
