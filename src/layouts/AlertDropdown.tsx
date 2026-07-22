import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bell, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const priorityIcon: Record<string, React.ReactNode> = {
  high: <AlertCircle size={14} className="text-red-400 shrink-0" />,
  medium: <AlertTriangle size={14} className="text-amber-400 shrink-0" />,
  low: <Info size={14} className="text-blue-400 shrink-0" />,
};

const ACTION_PATHS: Record<string, string> = {
  OpenSchedule: '/crm/schedule',
  OpenCashier: '/crm/finance',
  OpenInventory: '/crm/inventory',
  OpenBilling: '/crm/billing',
  OpenSchool: '/school',
  OpenProfile: '/profile',
  OpenLab: '/crm/lab',
  OpenShop: '/shop',
  OpenDemo: '/crm/schedule?demo=1',
  OpenPatients: '/crm/patients',
  OpenTreatmentPlans: '/crm/treatment-plans',
};

interface AlertDropdownProps {
  alerts: Array<{
    type: string;
    message?: string;
    text?: string;
    priority: 'high' | 'medium' | 'low' | number;
    action?: { type: string; path?: string };
  }>;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

function normalizePriority(p: AlertDropdownProps['alerts'][0]['priority']): 'high' | 'medium' | 'low' {
  if (p === 'high' || p === 'medium' || p === 'low') return p;
  const n = Number(p) || 0;
  if (n >= 8) return 'high';
  if (n >= 4) return 'medium';
  return 'low';
}

export const AlertDropdown: React.FC<AlertDropdownProps> = ({ alerts, isOpen, setIsOpen }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen, setIsOpen]);

  if (alerts.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          isOpen ? 'text-amber-400 bg-amber-400/10' : 'text-amber-400 hover:bg-amber-400/10'
        )}
        aria-label="Оповещения"
      >
        <Bell size={16} className="alert-pulse" />
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-400 text-[9px] font-bold text-black flex items-center justify-center">
          {alerts.length > 9 ? '9+' : alerts.length}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop — keeps panel readable over page content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-black/40 sm:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'z-[95] rounded-xl border border-bdr-subtle bg-surface-1 shadow-xl overflow-hidden',
                // Mobile: fixed panel under header, full readable width
                'fixed left-3 right-3 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1.5',
                'sm:w-80 max-w-[calc(100vw-1.5rem)]',
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-bdr-subtle">
                <span className="text-xs font-semibold text-txt-primary">Оповещения</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded text-txt-muted hover:text-txt-primary transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-[min(60vh,320px)] overflow-y-auto overscroll-contain">
                {alerts.map((alert, i) => {
                  const pr = normalizePriority(alert.priority);
                  const text = alert.message || alert.text || '';
                  const path = alert.action?.path
                    || (alert.action?.type ? ACTION_PATHS[alert.action.type] : undefined);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (path) {
                          navigate(path);
                          setIsOpen(false);
                        }
                      }}
                      className="w-full text-left flex items-start gap-2.5 px-3 py-3 border-b border-bdr-subtle last:border-b-0 hover:bg-white/[0.03] transition-colors"
                    >
                      {priorityIcon[pr]}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-txt-primary leading-snug break-words">{text}</p>
                        <span className="text-2xs text-txt-ghost uppercase mt-0.5 block">{alert.type}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
