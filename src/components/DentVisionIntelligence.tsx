import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  FileText,
  FlaskConical,
  ShoppingCart,
  GraduationCap,
  BarChart3,
  Settings,
  Stethoscope,
  ChevronRight,
  Brain,
  Microscope,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiChat, aiGreeting, aiProactive } from '@/utils/api';
import { ChatMessage, type ChatMsg } from './intelligence/ChatMessage';
import { TypingIndicator } from './intelligence/TypingIndicator';
import { ChatInput } from './intelligence/ChatInput';
import { SuggestionChips } from './intelligence/SuggestionChips';
import { ActionCard } from './intelligence/ActionCard';
import { ProactiveAlerts } from './intelligence/ProactiveAlerts';
import { ActionConfirm } from './intelligence/ActionConfirm';
import { Card } from '@/components/ui/ds/Card';

interface ServiceCardDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  gradient: string;
}

const SERVICES: ServiceCardDef[] = [
  { id: 'crm', name: 'CRM', description: 'Пациенты и расписание', icon: <Stethoscope size={20} />, path: '/crm/schedule', color: '#C9A96E', gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5' },
  { id: 'shop', name: 'Shop', description: 'Маркетплейс товаров', icon: <ShoppingCart size={20} />, path: '/shop', color: '#27AE60', gradient: 'from-[#27AE60]/20 to-[#27AE60]/5' },
  { id: 'school', name: 'School', description: 'Образовательная платформа', icon: <GraduationCap size={20} />, path: '/school', color: '#2980B9', gradient: 'from-[#2980B9]/20 to-[#2980B9]/5' },
  { id: 'analytics', name: 'Аналитика', description: 'Отчёты и метрики', icon: <BarChart3 size={20} />, path: '/analytics', color: '#F39C12', gradient: 'from-[#F39C12]/20 to-[#F39C12]/5' },
  { id: 'lab', name: 'Лаборатория', description: 'Лабораторные заказы', icon: <FlaskConical size={20} />, path: '/crm/lab', color: '#00BCD4', gradient: 'from-[#00BCD4]/20 to-[#00BCD4]/5' },
  { id: 'patients', name: 'Пациенты', description: 'База пациентов', icon: <Users size={20} />, path: '/crm/patients', color: '#E74C3C', gradient: 'from-[#E74C3C]/20 to-[#E74C3C]/5' },
  { id: 'documents', name: 'Документы', description: 'Документооборот', icon: <FileText size={20} />, path: '/crm/documents', color: '#8E44AD', gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5' },
  { id: 'settings', name: 'Настройки', description: 'Конфигурация', icon: <Settings size={20} />, path: '/settings', color: '#64748B', gradient: 'from-[#64748B]/20 to-[#64748B]/5' },
];

const SKILL_META: Record<string, { label: string; color: string }> = {
  clinical: { label: 'Clinical', color: '#E74C3C' },
  practice: { label: 'Practice', color: '#C9A96E' },
  analytics: { label: 'Analytics', color: '#F39C12' },
  shopping: { label: 'Shopping', color: '#27AE60' },
  learning: { label: 'Learning', color: '#2980B9' },
  patient: { label: 'Patient', color: '#00BCD4' },
  automation: { label: 'Auto', color: '#E91E8C' },
  research: { label: 'Research', color: '#8E44AD' },
};

export function DentVisionIntelligence() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [proactive, setProactive] = useState<Array<{ type: string; category: string; text: string; priority: number; action?: { type: string } }>>([]);
  const [initialized, setInitialized] = useState(false);
  const [confirmState, setConfirmState] = useState<{ open: boolean; action: string; params: Record<string, unknown>; type: 'danger' | 'warning' | 'info'; label: string }>({
    open: false, action: '', params: {}, type: 'info', label: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    (async () => {
      try {
        const [greeting, proactiveData] = await Promise.all([
          aiGreeting().catch(() => null),
          aiProactive().catch(() => ({ alerts: [] })),
        ]);

        if (greeting) {
          setMessages([{
            id: 'greeting',
            role: 'assistant',
            content: greeting.greeting || greetingGreeting(user),
            timestamp: new Date(),
            skill: greeting.skill,
          }]);
          setSuggestions(greeting.proactive?.map((p: any) => p.text)?.slice(0, 4) || []);
        } else {
          setMessages([{
            id: 'greeting',
            role: 'assistant',
            content: greetingGreeting(user),
            timestamp: new Date(),
          }]);
        }

        if (proactiveData?.alerts?.length) {
          setProactive(proactiveData.alerts);
        }
      } catch {
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: greetingGreeting(user),
          timestamp: new Date(),
        }]);
      }
    })();
  }, [initialized, user]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isProcessing) return;

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    setSuggestions([]);

    historyRef.current.push({ role: 'user', content: msg });

    try {
      const res = await aiChat(msg, historyRef.current.slice(-20));

      const aiMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date(),
        skill: res.skill,
        actions: res.actions,
        onAction: handleAction,
      };

      setMessages(prev => [...prev, aiMsg]);
      setSuggestions(res.suggestions || []);

      historyRef.current.push({ role: 'assistant', content: res.reply });

      if (res.proactive?.length) {
        setProactive(prev => {
          const existing = new Set(prev.map(p => p.text));
          const newAlerts = res.proactive.filter((p: any) => !existing.has(p.text));
          return [...prev, ...newAlerts].sort((a, b) => b.priority - a.priority).slice(0, 8);
        });
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте ещё раз.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing]);

  const handleAction = useCallback(async (actionType: string, params?: Record<string, unknown>) => {
    const navMap: Record<string, string> = {
      OpenSchedule: '/crm/schedule',
      OpenPatients: '/crm/patients',
      OpenCashier: '/crm/cashier',
      OpenLab: '/crm/lab',
      OpenShop: '/shop',
      OpenSchool: '/school',
      OpenAnalytics: '/analytics',
      OpenDocuments: '/crm/documents',
      OpenSettings: '/settings',
      OpenProfile: '/profile',
    };

    if (navMap[actionType]) {
      navigate(navMap[actionType]);
      return;
    }

    const CRITICAL_ACTIONS = ['CreatePatient', 'CreateAppointment', 'CreateReceipt', 'CreateLabOrder', 'DeletePatient', 'DeleteAppointment'];
    if (CRITICAL_ACTIONS.includes(actionType)) {
      setConfirmState({
        open: true,
        action: actionType,
        params: params || {},
        type: actionType.startsWith('Delete') ? 'danger' : 'warning',
        label: actionType,
      });
      return;
    }

    try {
      const result = await (await import('@/utils/api')).aiAction(actionType, params || {});
      if (result?.success) {
        setMessages(prev => [...prev, {
          id: `action-${Date.now()}`,
          role: 'assistant',
          content: result.message || `Действие "${actionType}" выполнено.`,
          timestamp: new Date(),
        }]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `action-err-${Date.now()}`,
        role: 'assistant',
        content: `Не удалось выполнить действие: ${e?.message || 'неизвестная ошибка'}`,
        timestamp: new Date(),
      }]);
    }
  }, [navigate]);

  const handleConfirmExecute = useCallback(async () => {
    const { action, params } = confirmState;
    setConfirmState(prev => ({ ...prev, open: false }));
    setIsProcessing(true);
    try {
      const result = await (await import('@/utils/api')).aiAction(action, params);
      setMessages(prev => [...prev, {
        id: `action-${Date.now()}`,
        role: 'assistant',
        content: result?.message || `Действие "${action}" выполнено.`,
        timestamp: new Date(),
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `action-err-${Date.now()}`,
        role: 'assistant',
        content: `Ошибка: ${e?.message || 'неизвестная ошибка'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [confirmState]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl"
        >
          <Card className="overflow-hidden shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between border-b border-bdr-subtle px-6 py-4 bg-gradient-to-r from-dv-gold/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dv-gold/10">
                  <Bot size={20} className="text-dv-gold" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-txt-primary">DentVision Intelligence</h2>
                  <p className="text-xs text-txt-muted">Ваш цифровой ассистент</p>
                </div>
              </div>
              {proactive.length > 0 && (
                <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">{proactive.length} оповещений</span>
              )}
            </div>

            <div className="flex flex-col lg:flex-row">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="max-h-[45vh] overflow-y-auto px-6 py-4 space-y-4">
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} msg={msg} />
                  ))}
                  <AnimatePresence>
                    {isProcessing && <TypingIndicator />}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>

                {suggestions.length > 0 && !isProcessing && (
                  <div className="px-6 pb-2">
                    <SuggestionChips suggestions={suggestions} onSelect={handleSend} disabled={isProcessing} />
                  </div>
                )}

                <ChatInput value={input} onChange={setInput} onSend={() => handleSend()} disabled={isProcessing} />
              </div>

              {proactive.length > 0 && (
                <div className="hidden lg:block w-64 border-l border-bdr-subtle p-4 overflow-y-auto max-h-[60vh]">
                  <h3 className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-3">Оповещения</h3>
                  <ProactiveAlerts alerts={proactive} onAction={handleAction} />
                </div>
              )}
            </div>
          </Card>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5"
          >
            {SERVICES.map((s) => (
              <motion.button
                key={s.id}
                variants={itemVariants}
                whileHover={{ scale: 1.03, y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(s.path)}
                className={`group relative overflow-hidden rounded-xl border border-bdr-subtle p-3.5 text-left bg-gradient-to-br transition-all duration-200 ${s.gradient} hover:border-bdr/50 hover:shadow-lg`}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl mb-2.5 transition-transform group-hover:scale-110"
                  style={{ background: `${s.color}15`, color: s.color }}
                >
                  {s.icon}
                </div>
                <h3 className="text-sm font-medium text-txt-primary">{s.name}</h3>
                <p className="text-[11px] text-txt-muted mt-0.5">{s.description}</p>
                <ChevronRight size={13} className="absolute right-2.5 top-2.5 text-txt-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
          </motion.div>
        </motion.div>
      </div>

      <ActionConfirm
        open={confirmState.open}
        title={confirmState.label}
        description={`Выполнить действие "${confirmState.action}"?`}
        params={confirmState.params}
        type={confirmState.type}
        onConfirm={handleConfirmExecute}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}

function greetingGreeting(user: any): string {
  const h = new Date().getHours();
  const timeGreeting = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = user?.name?.split(' ')[0] || user?.login || '';
  return `${timeGreeting}${name ? ', ' + name : ''}. Чем могу помочь?`;
}

export default DentVisionIntelligence;
