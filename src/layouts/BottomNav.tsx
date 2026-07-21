import React, { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Stethoscope, ShoppingCart, GraduationCap, BarChart3, Bot, UserPlus, LogIn } from 'lucide-react';
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

const ITEMS: BottomNavItem[] = [
  { id: 'crm', label: 'CRM', icon: <Stethoscope size={18} />, path: '/crm/schedule', color: '#C9A96E', requiresAuth: true },
  { id: 'shop', label: 'Маркет', icon: <ShoppingCart size={18} />, path: '/shop', color: '#8E44AD', requiresAuth: false },
  { id: 'ai', label: 'AI', icon: <Bot size={18} />, path: '/', color: '#D4AF37', requiresAuth: false },
  { id: 'school', label: 'Academy', icon: <GraduationCap size={18} />, path: '/school', color: '#16A085', requiresAuth: false },
  { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={18} />, path: '/analytics', color: '#F39C12', requiresAuth: true },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isGuest, setRegistrationModal } = useGuestStore();

  const handleNavClick = useCallback((item: BottomNavItem) => {
    if (item.requiresAuth && !isAuthenticated && !isGuest) {
      setRegistrationModal(true);
    } else if (item.requiresAuth && isGuest) {
      setRegistrationModal(true, () => navigate(item.path));
    } else {
      navigate(item.path);
    }
  }, [isAuthenticated, isGuest, navigate, setRegistrationModal]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-1/95 backdrop-blur-xl border-t border-bdr-subtle" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around h-[var(--dv-bottomnav-height,3.5rem)]">
        {ITEMS.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const isDisabled = item.requiresAuth && !isAuthenticated && !isGuest;
          
          return (
            <motion.button
              key={item.id}
              onClick={() => handleNavClick(item)}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center justify-center gap-0.5 w-16 h-full relative"
              disabled={isDisabled}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className={cn('transition-colors', isActive ? '' : 'text-txt-muted', isDisabled && 'opacity-40')}>
                {isDisabled ? <LogIn size={18} className="text-txt-muted" /> : item.icon}
              </span>
              <span className={cn('text-[10px] font-medium transition-colors', isActive ? '' : 'text-txt-muted', isDisabled && 'text-txt-muted')} style={isActive ? { color: item.color } : undefined}>
                {isDisabled ? 'Вход' : item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
