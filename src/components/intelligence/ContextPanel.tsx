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
  Zap,
  Stethoscope,
  BookOpen,
  Target,
  Clock,
  Bell,
  FileText,
  FlaskConical,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiDigitalTwin, aiProactive, aiChat } from '@/utils/api';
import { ProactiveAlerts } from './ProactiveAlerts';
import { cn } from '@/lib/utils';

interface ContextPanelProps {
  onClose?: () => void;
  clinic?: any;
  user?: any;
  role?: any;
}

interface DigitalTwin {
  specialization?: string;
  expertiseLevel?: string;
  recommendedEquipment?: string[];
  learningPath?: { topic: string; reason: string }[];
  activityLevel?: string;
  completedCourses?: number;
  clinicalFocus?: string[];
}

interface ClinicContext {
  todayAppointments?: number;
  pendingAppointments?: number;
  totalPatients?: number;
  revenue?: number;
  unpaidReceipts?: number;
  activeLabOrders?: number;
  lowStockItems?: Array<{ name: string; quantity: number; minStock: number }>;
}

const AI_SKILLS_LIST = [
  { id: 'clinical', label: 'Clinical AI', icon: <Stethoscope size={14} />, color: '#E74C3C', desc: 'Клинические протоколы и диагностика' },
  { id: 'practice', label: 'Practice AI', icon: <Calendar size={14} />, color: '#27AE60', desc: 'Управление приёмом и расписанием' },
  { id: 'research', label: 'Research AI', icon: <BookOpen size={14} />, color: '#8E44AD', desc: 'Исследования и анализ' },
  { id: 'shopping', label: 'Shopping AI', icon: <ShoppingCart size={14} />, color: '#2980B9', desc: 'Подбор товаров и оборудования' },
  { id: 'learning', label: 'Learning AI', icon: <GraduationCap size={14} />, color: '#16A085', desc: 'Обучение и развитие' },
  { id: 'analytics', label: 'Analytics AI', icon: <BarChart3 size={14} />, color: '#F39C12', desc: 'Аналитика и отчёты' },
  { id: 'patient', label: 'Patient AI', icon: <Users size={14} />, color: '#C9A96E', desc: 'Работа с пациентами' },
  { id: 'automation', label: 'Auto AI', icon: <Zap size={14} />, color: '#00BCD4', desc: 'Автоматизация процессов' },
];

export function ContextPanel({ onClose, clinic, user, role }: ContextPanelProps) {
  const [twin, setTwin] = useState<DigitalTwin | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [context, setContext] = useState<ClinicContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'context' | 'alerts' | 'digital-twin'>('context');
  const [activeSkill, setActiveSkill] = useState('practice');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [twinData, alertData] = await Promise.allSettled([
        aiDigitalTwin(),
        aiProactive(),
      ]);
      if (twinData.status === 'fulfilled') setTwin(twinData.value?.twin || null);
      if (alertData.status === 'fulfilled') setAlerts(alertData.value?.alerts || []);
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs header */}
      <div className="h-12 border-b border-bdr-subtle flex items-center justify-between px-3 shrink-0">
        <div className="flex gap-1">
          {[
            { id: 'context', label: 'Контекст', icon: <Brain size={12} /> },
            { id: 'digital-twin', label: 'Двойник', icon: <Target size={12} /> },
            { id: 'alerts', label: 'Оповещения', icon: <Bell size={12} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-dv-gold/10 text-dv-gold'
                  : 'text-txt-muted hover:text-txt-primary hover:bg-white/5'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'alerts' && alerts.length > 0 && (
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-[9px] text-white flex items-center justify-center font-bold">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={load}
            className="h-6 w-6 flex items-center justify-center rounded-md text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded-md text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'context' && (
          <ContextTab context={context} twin={twin} clinic={clinic} user={user} loading={loading} activeSkill={activeSkill} />
        )}
        {activeTab === 'digital-twin' && (
          <DigitalTwinTab twin={twin} loading={loading} />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab alerts={alerts} loading={loading} />
        )}
      </div>
    </div>
  );
}

function ContextTab({ context, twin, clinic, user, loading, activeSkill }: {
  context: ClinicContext | null;
  twin: DigitalTwin | null;
  clinic: any;
  user: any;
  loading: boolean;
  activeSkill: string;
}) {
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
      {/* Clinic Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope size={14} className="text-dv-gold" />
          <h4 className="text-xs font-semibold text-txt-primary">Рабочее пространство</h4>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-txt-muted">Клиника</span>
            <span className="text-txt-primary font-medium truncate pl-2">{clinic?.name || '—'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-txt-muted">Пользователь</span>
            <span className="text-txt-primary font-medium truncate pl-2">{user?.name || user?.login || '—'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-txt-muted">Роль</span>
            <span className="text-txt-primary font-medium">{user?.role || 'doctor'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-txt-muted">Специализация</span>
            <span className="text-txt-primary font-medium">{twin?.specialization || user?.spec || '—'}</span>
          </div>
        </div>
      </motion.div>

      {/* Today's Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={14} className="text-amber-400" />
          <h4 className="text-xs font-semibold text-txt-primary">Сегодня</h4>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-surface-1">
            <p className="text-txt-muted">Записей</p>
            <p className="font-semibold text-txt-primary">{context?.todayAppointments || '—'}</p>
          </div>
          <div className="p-2 rounded-lg bg-surface-1">
            <p className="text-txt-muted">Ожидают</p>
            <p className="font-semibold text-amber-400">{context?.pendingAppointments || '—'}</p>
          </div>
          <div className="p-2 rounded-lg bg-surface-1">
            <p className="text-txt-muted">Пациентов</p>
            <p className="font-semibold text-txt-primary">{context?.totalPatients || '—'}</p>
          </div>
          <div className="p-2 rounded-lg bg-surface-1">
            <p className="text-txt-muted">Выручка</p>
            <p className="font-semibold text-green-400">{(context?.revenue || 0).toLocaleString('ru-RU')} ₸</p>
          </div>
        </div>
      </motion.div>

      {/* Lab & Inventory */}
      {(context?.activeLabOrders || context?.lowStockItems?.length) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical size={14} className="text-cyan-400" />
            <h4 className="text-xs font-semibold text-txt-primary">Лаборатория и склад</h4>
          </div>
          <div className="space-y-1.5">
            {context?.activeLabOrders && (
              <div className="flex justify-between text-xs">
                <span className="text-txt-muted">Активных заказов</span>
                <span className="font-semibold text-txt-primary">{context.activeLabOrders}</span>
              </div>
            )}
            {context?.lowStockItems?.length && (
              <div className="flex justify-between text-xs">
                <span className="text-txt-muted">Мало на складе</span>
                <span className="font-semibold text-amber-400">{context.lowStockItems.length} позиций</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* AI Skills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-dv-gold" />
          <h4 className="text-xs font-semibold text-txt-primary">AI Навыки</h4>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {AI_SKILLS_LIST.map((skill) => (
            <div
              key={skill.id}
              className={cn(
                'flex items-center gap-2 p-1.5 rounded-lg text-xs transition-colors',
                activeSkill === skill.id
                  ? 'bg-dv-gold/10'
                  : 'bg-surface-1'
              )}
            >
              <span style={{ color: skill.color }}>{skill.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-txt-primary truncate">{skill.label}</p>
                <p className="text-2xs text-txt-muted truncate">{skill.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-dv-gold" />
          <h4 className="text-xs font-semibold text-txt-primary">Быстрые действия</h4>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'Расписание', icon: <Calendar size={12} />, action: 'OpenSchedule' },
            { label: 'Пациенты', icon: <Users size={12} />, action: 'OpenPatients' },
            { label: 'Новая запись', icon: <Calendar size={12} />, action: 'CreateAppointment' },
            { label: 'Аналитика', icon: <BarChart3 size={12} />, action: 'OpenAnalytics' },
          ].map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-1 border border-bdr-subtle text-txt-secondary hover:bg-surface-2 hover:border-dv-gold/30 hover:text-txt-primary transition-all"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function DigitalTwinTab({ twin, loading }: { twin: DigitalTwin | null; loading: boolean }) {
  if (loading || !twin) {
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
      >
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-dv-gold" />
          <h4 className="text-xs font-semibold text-txt-primary">Цифровой двойник</h4>
        </div>
        <div className="space-y-2">
          {twin.specialization && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-1">
              <BookOpen size={14} className="text-blue-400" />
              <div>
                <p className="text-2xs text-txt-muted">Специализация</p>
                <p className="text-sm font-medium text-txt-primary">{twin.specialization}</p>
              </div>
            </div>
          )}
          {twin.expertiseLevel && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-1">
              <Target size={14} className="text-amber-400" />
              <div>
                <p className="text-2xs text-txt-muted">Уровень экспертизы</p>
                <p className="text-sm font-medium text-txt-primary">{twin.expertiseLevel}</p>
              </div>
            </div>
          )}
          {twin.activityLevel && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-1">
              <Zap size={14} className="text-green-400" />
              <div>
                <p className="text-2xs text-txt-muted">Активность</p>
                <p className="text-sm font-medium text-txt-primary">{twin.activityLevel}</p>
              </div>
            </div>
          )}
          {twin.completedCourses && twin.completedCourses > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-1">
              <GraduationCap size={14} className="text-purple-400" />
              <div>
                <p className="text-2xs text-txt-muted">Пройдено курсов</p>
                <p className="text-sm font-medium text-txt-primary">{twin.completedCourses}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {twin.clinicalFocus?.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope size={14} className="text-red-400" />
            <h4 className="text-xs font-semibold text-txt-primary">Клинический фокус</h4>
          </div>
          <div className="flex flex-wrap gap-1">
            {twin.clinicalFocus.slice(0, 6).map((focus, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-[10px] bg-red-400/10 text-red-400 border border-red-400/20">
                {focus}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {twin.recommendedEquipment?.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={14} className="text-green-400" />
            <h4 className="text-xs font-semibold text-txt-primary">Рекомендуемое оборудование</h4>
          </div>
          <div className="flex flex-wrap gap-1">
            {twin.recommendedEquipment.slice(0, 6).map((eq, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-[10px] bg-green-400/10 text-green-400 border border-green-400/20">
                {eq}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {twin.learningPath?.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-bdr-subtle bg-surface-2/50 p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={14} className="text-blue-400" />
            <h4 className="text-xs font-semibold text-txt-primary">Рекомендации по обучению</h4>
          </div>
          <div className="space-y-1.5">
            {twin.learningPath.slice(0, 4).map((item, i) => (
              <div key={i} className="text-xs text-txt-secondary p-2 rounded-lg bg-surface-1">
                <p className="font-medium">{item.topic}</p>
                {item.reason && <p className="text-txt-muted mt-0.5">{item.reason}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}
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
          <Bell size={18} className="text-txt-muted" />
        </div>
        <p className="text-xs text-txt-muted">Нет оповещений</p>
        <p className="text-[10px] text-txt-ghost mt-1">AI уведомит о важных событиях</p>
      </div>
    );
  }

  return <ProactiveAlerts alerts={alerts} />;
}

export default ContextPanel;
