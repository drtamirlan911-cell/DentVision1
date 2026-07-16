import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionConfirmProps {
  open: boolean;
  title: string;
  description?: string;
  params?: Record<string, unknown>;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TYPE_STYLES = {
  danger: { icon: <AlertTriangle size={20} />, bg: 'bg-red-500/10', border: 'border-red-500/20', btn: 'bg-red-500 hover:bg-red-600' },
  warning: { icon: <AlertTriangle size={20} />, bg: 'bg-amber-500/10', border: 'border-amber-500/20', btn: 'bg-amber-500 hover:bg-amber-600' },
  info: { icon: <CheckCircle2 size={20} />, bg: 'bg-dv-gold/10', border: 'border-dv-gold/20', btn: 'bg-dv-gold hover:bg-dv-gold/90' },
};

export function ActionConfirm({ open, title, description, params, type = 'info', loading, onConfirm, onCancel }: ActionConfirmProps) {
  const style = TYPE_STYLES[type];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-bdr-subtle bg-surface-1 shadow-2xl overflow-hidden"
          >
            <div className={cn('flex items-center gap-3 px-5 py-4 border-b border-bdr-subtle', style.bg)}>
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', style.bg, style.border, 'border')}>
                <span className="text-dv-gold">{style.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-txt-primary">{title}</h3>
                {description && <p className="text-xs text-txt-muted mt-0.5 line-clamp-2">{description}</p>}
              </div>
              <button onClick={onCancel} className="text-txt-muted hover:text-txt-primary transition-colors">
                <X size={16} />
              </button>
            </div>

            {params && Object.keys(params).length > 0 && (
              <div className="px-5 py-3 border-b border-bdr-subtle bg-surface-2/50">
                <p className="text-[10px] text-txt-ghost uppercase tracking-wider mb-1.5">Параметры</p>
                <div className="space-y-1">
                  {Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-txt-muted">{k}</span>
                      <span className="text-txt-secondary font-mono text-[11px] truncate max-w-[60%] text-right">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 px-5 py-3.5">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 h-9 rounded-lg border border-bdr-subtle text-sm text-txt-secondary hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  'flex-1 h-9 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5',
                  style.btn
                )}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {loading ? 'Выполняю...' : 'Подтвердить'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ActionConfirm;
