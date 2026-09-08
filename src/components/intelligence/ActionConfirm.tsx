import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle, Zap, Check, X, UserRound, CalendarDays, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/ds/Button';

interface ActionConfirmProps {
  action: { action: string; label: string; confidence: number; params?: Record<string, unknown> };
  message: string;
  onConfirm: (confirmed: boolean) => void;
}

const HIDDEN_PARAMS = new Set(['path', 'patientId', 'planId', 'visitId', 'doctorId', 'clinicId', 'confirmed']);

function readableKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

function valueLabel(key: string, value: unknown) {
  if (key === 'amount' || key === 'total' || key === 'price') {
    const n = Number(value);
    return Number.isFinite(n) ? `${n.toLocaleString('ru-RU')} ₸` : String(value);
  }
  return String(value);
}

function contextRows(params: Record<string, unknown>) {
  return Object.entries(params)
    .filter(([key, value]) => !HIDDEN_PARAMS.has(key) && value !== undefined && value !== null && value !== '')
    .slice(0, 5);
}

export function ActionConfirm({ action, message, onConfirm }: ActionConfirmProps) {
  const { t } = useTranslation();
  const rows = contextRows(action.params || {});
  const isHighImpact = /create|cancel|delete|update|payment|invoice|appointment|plan|lab/i.test(action.action);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="fixed inset-x-3 bottom-3 md:left-auto md:right-4 md:bottom-4 z-[60] md:w-[min(28rem,calc(100vw-2rem))]"
      role="dialog"
      aria-modal="true"
      aria-label="Подтверждение действия AI"
    >
      <div className="overflow-hidden rounded-2xl border border-bdr-subtle bg-surface-1 shadow-2xl shadow-black/40">
        <div className="flex items-start gap-3 border-b border-bdr-subtle p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold">
            <Zap size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-txt-primary">Подтвердите действие</h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-dv-gold/10 px-2 py-0.5 text-[9px] font-bold text-dv-gold">
                {(action.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-1 text-xs leading-4 text-txt-muted">{message}</p>
          </div>
          <button type="button" onClick={() => onConfirm(false)} className="rounded-lg p-1 text-txt-muted hover:bg-white/5 hover:text-txt-primary" aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-xl border border-dv-gold/15 bg-dv-gold/[0.04] p-3">
            <div className="flex items-start gap-2">
              {isHighImpact ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" /> : <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />}
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-txt-ghost">AI предлагает</div>
                <div className="mt-1 text-sm font-semibold text-txt-primary">{action.label}</div>
              </div>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-bdr-subtle bg-surface-2/40">
              <div className="border-b border-bdr-subtle px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-txt-ghost">Изменяемые параметры</div>
              <div className="divide-y divide-bdr-subtle">
                {rows.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-4 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-xs text-txt-muted">
                      {key.toLowerCase().includes('patient') ? <UserRound size={12} /> : key.toLowerCase().includes('date') ? <CalendarDays size={12} /> : <FileText size={12} />}
                      <span className="truncate">{readableKey(key)}</span>
                    </span>
                    <span className="max-w-[58%] truncate text-right text-xs font-medium text-txt-primary">{valueLabel(key, value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-[10px] leading-4 text-txt-ghost">AI не выполнит действие без вашего подтверждения. Проверьте данные перед продолжением.</p>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => onConfirm(false)} size="sm">
              <X size={14} className="mr-1.5" /> {t('common.cancel')}
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => onConfirm(true)} size="sm">
              <Check size={14} className="mr-1.5" /> {t('common.confirm')}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
