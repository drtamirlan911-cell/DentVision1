import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Alert {
  type: string;
  category: string;
  text: string;
  priority: number;
  action?: { type: string };
}

interface ProactiveAlertsProps {
  alerts: Alert[];
  onAction?: (actionType: string) => void;
}

const ALERT_STYLES: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  urgent: { icon: <AlertCircle size={14} />, bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-400' },
  warning: { icon: <AlertTriangle size={14} />, bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400' },
  info: { icon: <Info size={14} />, bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400' },
};

export function ProactiveAlerts({ alerts, onAction }: ProactiveAlertsProps) {
  if (!alerts.length) return null;

  return (
    <div className="space-y-1.5">
      <AnimatePresence mode="popLayout">
        {alerts.map((alert, i) => {
          const style = ALERT_STYLES[alert.type] || ALERT_STYLES.info;
          return (
            <motion.button
              key={`${alert.category}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => alert.action?.type && onAction?.(alert.action.type)}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left transition-colors hover:opacity-80',
                style.bg, 'border', style.border
              )}
            >
              <span className={style.text}>{style.icon}</span>
              <span className="flex-1 text-xs text-txt-secondary leading-tight">{alert.text}</span>
              <ChevronRight size={12} className="text-txt-muted shrink-0" />
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
