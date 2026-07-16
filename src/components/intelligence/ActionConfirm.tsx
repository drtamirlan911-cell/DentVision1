import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Zap, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';

interface ActionConfirmProps {
  action: { action: string; label: string; confidence: number; params?: Record<string, unknown> };
  message: string;
  onConfirm: (confirmed: boolean) => void;
}

export function ActionConfirm({ action, message, onConfirm }: ActionConfirmProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onConfirm(false)} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-surface-1 border border-bdr-subtle rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
      >
        <div className="flex items-center gap-3 p-4 bg-dv-gold/5 border-b border-bdr-subtle">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dv-gold/10">
            <Zap size={18} className="text-dv-gold" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-txt-primary">Подтверждение действия</h4>
            <p className="text-xs text-txt-muted">{message}</p>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dv-gold/10 text-dv-gold text-[10px] font-bold">
            {(action.confidence * 100).toFixed(0)}% уверенности
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-xs font-medium text-txt-secondary">Действие: {action.label}</span>
          </div>
          
          {action.params && Object.keys(action.params).length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-surface-2/50 border border-bdr-subtle">
              <p className="text-xs font-medium text-txt-muted mb-2">Параметры:</p>
              <div className="grid gap-1 text-sm">
                {Object.entries(action.params).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-txt-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-txt-primary font-mono text-xs">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => onConfirm(false)}
              size="sm"
            >
              <X size={14} className="mr-1.5" />
              Отмена
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => onConfirm(true)}
              size="sm"
            >
              <Check size={14} className="mr-1.5" />
              Подтвердить
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}