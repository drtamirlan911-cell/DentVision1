import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/ds/Card';
import { normalizeAlertTone, type AlertTone } from '@/utils/alertTone';

interface Alert {
  type: string;
  category: string;
  text: string;
  priority: number;
  action?: { type: string };
  timestamp?: Date;
}

interface ProactiveAlertsProps {
  alerts: Alert[];
  onDismiss?: (text: string) => void;
  onAction?: (actionType: string) => void;
  compact?: boolean;
}

function AlertIcon({ type }: { type: AlertTone }) {
  const icons = {
    info: <Info size={14} />,
    warning: <AlertTriangle size={14} />,
    success: <CheckCircle size={14} />,
    error: <AlertTriangle size={14} />,
  };
  return icons[type];
}

function CompactAlertIcon({ type }: { type: AlertTone }) {
  const icons = {
    info: <Info size={12} />,
    warning: <AlertTriangle size={12} />,
    success: <CheckCircle size={12} />,
    error: <AlertTriangle size={12} />,
  };
  return icons[type];
}

const COLORS = {
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  warning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  success: 'text-green-400 bg-green-400/10 border-green-400/20',
  error: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export function ProactiveAlerts({ alerts, onDismiss, onAction, compact = false }: ProactiveAlertsProps) {
  if (!alerts.length) return null;

  const sortedAlerts = [...alerts].sort((a, b) => b.priority - a.priority);

  if (compact) {
    return (
      <AnimatePresence>
        {sortedAlerts.slice(0, 3).map((alert, i) => {
          const tone = normalizeAlertTone(alert.type);
          return (
          <motion.div
            key={alert.text + i}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.1 }}
            className={cn(
              'flex items-start gap-2.5 px-3 py-2 rounded-xl border transition-all',
              COLORS[tone]
            )}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg">
              <CompactAlertIcon type={tone} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-txt-primary">{alert.text}</p>
              <p className="text-2xs text-txt-muted mt-0.5 capitalize">{alert.category}</p>
            </div>
            {alert.action && onAction && (
              <motion.button
                onClick={() => onAction(alert.action!.type)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-2 py-1 rounded-lg text-xs font-medium bg-white/10 text-txt-secondary hover:bg-white/20 transition-colors"
              >
                Действие
              </motion.button>
            )}
            {onDismiss && (
              <button
                onClick={() => onDismiss(alert.text)}
                className="p-1 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </motion.div>
          );
        })}
      </AnimatePresence>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-bdr-subtle">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-dv-gold" />
          <h4 className="text-sm font-semibold text-txt-primary">Проактивные оповещения</h4>
          <span className="px-2 py-0.5 rounded-full bg-dv-gold/10 text-dv-gold text-xs font-bold">{alerts.length}</span>
        </div>
      </div>
      <div className="p-3 space-y-2 max-h-[40vh] overflow-y-auto">
        <AnimatePresence>
          {sortedAlerts.map((alert, i) => {
            const tone = normalizeAlertTone(alert.type);
            return (
            <motion.div
              key={alert.text}
              initial={{ opacity: 0, y: 10, x: -20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: -10, x: 20 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
              className={cn(
                'relative flex gap-3 p-3 rounded-xl border transition-all',
                COLORS[tone]
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <AlertIcon type={tone} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-txt-primary pr-4">{alert.text}</p>
                  <div className="flex items-center gap-1">
                    {alert.action && onAction && (
                      <motion.button
                        onClick={() => onAction(alert.action!.type)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-txt-secondary hover:bg-white/20 transition-colors"
                      >
                        Выполнить
                      </motion.button>
                    )}
                    {onDismiss && (
                      <button
                        onClick={() => onDismiss(alert.text)}
                        className="p-1 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-txt-muted capitalize">{alert.category}</span>
                  {alert.timestamp && (
                    <span className="text-[10px] text-txt-ghost">
                      {alert.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
            );
          })}
        </AnimatePresence>
        {!alerts.length && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell size={28} className="text-txt-ghost" />
            <p className="text-sm text-txt-muted mt-2">Нет оповещений</p>
            <p className="text-[10px] text-txt-ghost mt-1">AI уведомит о важных событиях</p>
          </div>
        )}
      </div>
    </Card>
  );
}