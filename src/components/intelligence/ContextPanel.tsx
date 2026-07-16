import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  ShoppingCart,
  GraduationCap,
  X,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiDigitalTwin, aiProactive } from '@/utils/api';
import { ProactiveAlerts } from './ProactiveAlerts';
import { cn } from '@/lib/utils';

interface ContextPanelProps {
  onClose?: () => void;
}

interface DigitalTwin {
  specialization?: string;
  expertiseLevel?: string;
  recommendedEquipment?: string[];
  learningPath?: { topic: string; reason: string }[];
  activityLevel?: string;
}

export function ContextPanel({ onClose }: ContextPanelProps) {
  const { user, clinic } = useAuth();
  const [twin, setTwin] = useState<DigitalTwin | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'context' | 'alerts'>('context');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [twinData, alertData] = await Promise.allSettled([
      aiDigitalTwin(),
      aiProactive(),
    ]);
    if (twinData.status === 'fulfilled') setTwin(twinData.value?.twin || null);
    if (alertData.status === 'fulfilled') setAlerts(alertData.value?.alerts || []);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 border-b border-bdr-subtle flex items-center justify-between px-3 shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('context')}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              activeTab === 'context' ? 'bg-dv-gold/10 text-dv-gold' : 'text-txt-muted hover:text-txt-primary'
            )}
          >
            Контекст
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors relative',
              activeTab === 'alerts' ? 'bg-dv-gold/10 text-dv-gold' : 'text-txt-muted hover:text-txt-primary'
            )}
          >
            Оповещения
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-[9px] text-white flex items-center justify-center font-bold">
                {alerts.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={load}
            className="h-6 w-6 flex items-center justify-center rounded-md text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={12} />
          </button>
          {onClose && (
            <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded-md text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'context' && (
          <ContextTab twin={twin} user={user} clinic={clinic} loading={loading} />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab alerts={alerts} loading={loading} />
        )}
      </div>
    </div>
  );
}

function ContextTab({ twin, user, clinic, loading }: { twin: DigitalTwin | null; user: any; clinic: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-lg bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-dv-gold" />
          <h4 className="text-xs font-semibold text-txt-primary">Цифровой двойник</h4>
        </div>
        {twin ? (
          <div className="space-y-2">
            {twin.specialization && (
              <p className="text-xs text-txt-secondary">
                <span className="text-txt-muted">Специализация:</span> {twin.specialization}
              </p>
            )}
            {twin.expertiseLevel && (
              <p className="text-xs text-txt-secondary">
                <span className="text-txt-muted">Уровень:</span> {twin.expertiseLevel}
              </p>
            )}
            {twin.activityLevel && (
              <p className="text-xs text-txt-secondary">
                <span className="text-txt-muted">Активность:</span> {twin.activityLevel}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-txt-muted">Данные загружаются...</p>
        )}
      </div>

      {twin?.learningPath && twin.learningPath.length > 0 && (
        <div className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={14} className="text-blue-400" />
            <h4 className="text-xs font-semibold text-txt-primary">Рекомендации по обучению</h4>
          </div>
          <div className="space-y-1.5">
            {twin.learningPath.slice(0, 3).map((item, i) => (
              <div key={i} className="text-xs text-txt-secondary">
                <span className="font-medium">{item.topic}</span>
                {item.reason && <span className="text-txt-muted"> — {item.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {twin?.recommendedEquipment && twin.recommendedEquipment.length > 0 && (
        <div className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={14} className="text-green-400" />
            <h4 className="text-xs font-semibold text-txt-primary">Рекомендуемое оборудование</h4>
          </div>
          <div className="flex flex-wrap gap-1">
            {twin.recommendedEquipment.slice(0, 4).map((eq, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md text-[10px] bg-surface-3 text-txt-secondary">{eq}</span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={14} className="text-amber-400" />
          <h4 className="text-xs font-semibold text-txt-primary">Информация</h4>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-txt-secondary">
            <span className="text-txt-muted">Клиника:</span> {clinic?.name || '—'}
          </p>
          <p className="text-xs text-txt-secondary">
            <span className="text-txt-muted">Пользователь:</span> {user?.name || user?.login || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function AlertsTab({ alerts, loading }: { alerts: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-10 rounded-lg bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!alerts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center mb-3">
          <TrendingUp size={18} className="text-txt-muted" />
        </div>
        <p className="text-xs text-txt-muted">Нет оповещений</p>
        <p className="text-[10px] text-txt-ghost mt-1">AI уведомит о важных событиях</p>
      </div>
    );
  }

  return <ProactiveAlerts alerts={alerts} />;
}

export default ContextPanel;
