import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const priorityIcon: Record<string, React.ReactNode> = {
  high: <AlertCircle size={14} className="text-red-400 shrink-0" />,
  medium: <AlertTriangle size={14} className="text-amber-400 shrink-0" />,
  low: <Info size={14} className="text-blue-400 shrink-0" />,
};

interface AlertDropdownProps {
  alerts: Array<{ type: string; text: string; priority: number }>;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export const AlertDropdown: React.FC<AlertDropdownProps> = ({ alerts, isOpen, setIsOpen }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
      >
        <Bell size={16} className="alert-pulse" />
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-400 text-[9px] font-bold text-black flex items-center justify-center">
          {alerts.length > 9 ? '9+' : alerts.length}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-bdr-subtle bg-surface-raised backdrop-blur-xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-bdr-subtle">
              <span className="text-xs font-semibold text-txt-primary">Proactive Alerts</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-0.5 rounded text-txt-muted hover:text-txt-primary transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2.5 border-b border-bdr-subtle last:border-b-0 hover:bg-white/[0.03] transition-colors"
                >
                  {priorityIcon[alert.priority >= 8 ? 'high' : alert.priority >= 4 ? 'medium' : 'low']}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-txt-primary leading-snug">{alert.text}</p>
                    <span className="text-2xs text-txt-ghost uppercase mt-0.5 block">{alert.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
