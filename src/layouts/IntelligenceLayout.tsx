import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ChevronRight, Menu, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { WelcomeAnimation } from '@/components/intelligence/WelcomeAnimation';
import { ContextPanel } from '@/components/intelligence/ContextPanel';
import { aiProactive } from '@/utils/api';
import { Sidebar } from './Sidebar';
import { AlertDropdown } from './AlertDropdown';

const BREADCRUMB_LABELS: Record<string, string> = {
  crm: 'CRM',
  schedule: 'Расписание',
  patients: 'Пациенты',
  shop: 'Маркетплейс',
  school: 'Академия',
  analytics: 'Аналитика',
  jobs: 'Вакансии',
  community: 'Сообщество',
  ai: 'AI Команда',
  profile: 'Профиль',
  settings: 'Настройки',
  admin: 'Администрирование',
  audit: 'Аудит',
  backup: 'Бэкапы',
};

export const IntelligenceLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clinic, isAuthenticated, roleInfo, logout } = useAuth();
  const { sidebarOpen, toggleSidebar, contextSheetOpen, setContextSheetOpen } = useUIStore();

  const [collapsed, setCollapsed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return !sessionStorage.getItem('dv_welcomed'); } catch { return false; }
  });
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [proactiveAlerts, setProactiveAlerts] = useState<Array<{ type: string; text: string; priority: number }>>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [alertDropdownOpen, setAlertDropdownOpen] = useState(false);

  const getBreadcrumbs = useCallback(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [];
    const crumbs: { label: string; path: string }[] = [];
    let accumulated = '';
    for (const seg of segments) {
      accumulated += '/' + seg;
      crumbs.push({ label: BREADCRUMB_LABELS[seg] || seg, path: accumulated });
    }
    return crumbs;
  }, [location.pathname]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isMobile) setContextSheetOpen(false);
  }, [isMobile, setContextSheetOpen]);

  const handleWelcomeComplete = useCallback(() => {
    try { sessionStorage.setItem('dv_welcomed', '1'); } catch {}
    setShowWelcome(false);
    setSidebarVisible(true);
    setTimeout(() => fetchProactiveAlerts(), 500);
  }, []);

  const fetchProactiveAlerts = useCallback(async () => {
    try {
      const data = await aiProactive();
      if (data?.alerts?.length) setProactiveAlerts(data.alerts);
    } catch {}
  }, []);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (showWelcome) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 overflow-hidden flex">
      <style>{`
        @keyframes sidebarGradient {
          0%, 100% { transform: translate(-25%, -25%) rotate(0deg); }
          33% { transform: translate(25%, -25%) rotate(120deg); }
          66% { transform: translate(25%, 25%) rotate(240deg); }
          100% { transform: translate(-25%, 25%) rotate(360deg); }
        }
        .sidebar-gradient {
          animation: sidebarGradient 30s ease-in-out infinite;
        }
        @keyframes alertPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
        }
        .alert-pulse {
          animation: alertPulse 2s ease-in-out infinite;
        }
      `}</style>

      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        sidebarVisible={sidebarVisible}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        user={user}
        roleInfo={roleInfo}
        logout={logout}
        toggleSidebar={toggleSidebar}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-surface-1/80 backdrop-blur-xl border-b border-bdr-subtle flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
              aria-label="Меню"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm text-txt-muted">
                {(() => {
                  const crumbs = getBreadcrumbs();
                  return crumbs.map((crumb, idx) => (
                    <span key={crumb.path} className="flex items-center gap-1.5">
                      {idx > 0 && <ChevronRight size={12} className="text-txt-ghost shrink-0" />}
                      <span className={idx === crumbs.length - 1 ? 'text-txt-primary font-semibold' : 'truncate'}>
                        {crumb.label}
                      </span>
                    </span>
                  ));
                })()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDropdown
              alerts={proactiveAlerts}
              isOpen={alertDropdownOpen}
              setIsOpen={setAlertDropdownOpen}
            />
            <button
              onClick={() => setContextSheetOpen(!contextSheetOpen)}
              className={cn(
                'hidden md:flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                contextSheetOpen ? 'text-dv-gold bg-dv-gold/10' : 'text-txt-muted hover:text-txt-primary hover:bg-white/5'
              )}
              aria-label="Контекстная панель"
            >
              <Building2 size={16} />
            </button>
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-dv-gold/10 border border-dv-gold/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[10px] font-medium text-dv-gold">AI</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-surface-0 relative min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <Outlet context={{ user, clinic, roleInfo }} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {!isMobile && (
        <AnimatePresence>
          {contextSheetOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="hidden lg:flex flex-col border-l border-bdr-subtle bg-surface-1 overflow-hidden flex-shrink-0 h-full"
            >
              <ContextPanel
                onClose={() => setContextSheetOpen(false)}
                clinic={clinic}
                user={user}
                role={roleInfo}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {isMobile && contextSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setContextSheetOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.3}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setContextSheetOpen(false);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden max-h-[85vh] bg-surface-1 border-t border-bdr-subtle rounded-t-2xl shadow-2xl flex flex-col"
            >
              <div
                className="flex h-12 items-center justify-center border-b border-bdr-subtle cursor-grab active:cursor-grabbing touch-pan-y"
                onClick={() => setContextSheetOpen(false)}
              >
                <div className="h-1 w-10 rounded-full bg-txt-muted" />
              </div>
              <div className="flex-1 overflow-y-auto">
                <ContextPanel
                  onClose={() => setContextSheetOpen(false)}
                  clinic={clinic}
                  user={user}
                  role={roleInfo}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntelligenceLayout;
