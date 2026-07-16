import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Send,
  Loader2,
  Maximize2,
  Minimize2,
  MessageSquare,
  Zap,
  Brain,
  Bell,
  X,
  Copy,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiChat, aiAction, aiProactive, aiSetContext } from '@/utils/api';
import { ChatMessage, type ChatMsg } from './intelligence/ChatMessage';
import { TypingIndicator } from './intelligence/TypingIndicator';
import { ChatInput } from './intelligence/ChatInput';
import { SuggestionChips } from './intelligence/SuggestionChips';
import { ProactiveAlerts } from './intelligence/ProactiveAlerts';
import { ActionCard } from './intelligence/ActionCard';
import { ActionConfirm } from './intelligence/ActionConfirm';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/ds/Card';
import { AI_SERVICES } from '@/components/intelligence/AIServiceCards';

interface ServiceCardDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  gradient: string;
}

interface DentVisionIntelligenceProps {
  onNavigate: (path: string) => void;
  proactiveAlerts?: Array<{ type: string; category: string; text: string; priority: number; action?: { type: string } }>;
}

interface AIAction {
  type: string;
  label: string;
  confidence: number;
  params?: Record<string, unknown>;
}

interface PendingAction {
  action: AIAction;
  params: Record<string, unknown>;
  confirmMessage: string;
}

export function DentVisionIntelligence({ onNavigate, proactiveAlerts: initialProactiveAlerts }: DentVisionIntelligenceProps) {
  const { user, clinic, roleInfo } = useAuth();
  const userRole = roleInfo?.role || user?.role || 'doctor';

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [proactive, setProactive] = useState<Array<{ type: string; category: string; text: string; priority: number; action?: { type: string } }>>([]);
  const [initialized, setInitialized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [conversationContext, setConversationContext] = useState<Record<string, unknown>>({});
  const [activeSkill, setActiveSkill] = useState<string>('practice');
  const [showActionConfirm, setShowActionConfirm] = useState(false);

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
          aiChat('Приветствие', []).catch(() => null),
          aiProactive().catch(() => ({ alerts: [] })),
        ]);

        const initialGreeting = greeting?.reply || buildGreeting(user, clinic);
        
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: initialGreeting,
          timestamp: new Date(),
          skill: greeting?.skill || 'practice',
        }]);
        setSuggestions(greeting?.suggestions || getDefaultSuggestions(userRole, clinic));
        setActiveSkill(greeting?.skill || 'practice');

        const allProactive = [...(proactiveData?.alerts || []), ...(initialProactiveAlerts || [])];
        if (allProactive.length) {
          setProactive(allProactive);
        }

        historyRef.current = [
          { role: 'assistant', content: initialGreeting },
        ];
      } catch {
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: buildGreeting(user, clinic),
          timestamp: new Date(),
        }]);
        setSuggestions(getDefaultSuggestions(userRole, clinic));
      }
    })();
  }, [initialized, user, clinic, roleInfo, initialProactiveAlerts]);

  const buildGreeting = (user: any, clinic: any) => {
    const h = new Date().getHours();
    const timeGreeting = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const name = user?.name?.split(' ')[0] || user?.login || '';
    const clinicInfo = clinic ? `\nКлиника: ${clinic.name}` : '';
    
    let contextInfo = '';
    if (clinic) {
      contextInfo = '\n\nСегодня: 18 пациентов, первая запись через 30 мин; 2 лабор. работы готовы; 1 пациент ждёт подтверждения.';
    }
    
    return `${timeGreeting}, доктор ${name}.${clinicInfo}${contextInfo}\n\nЧем могу помочь?`;
  };

  const getDefaultSuggestions = (role: string, clinic: any) => {
    const base = ['Показать расписание', 'Найти пациента', 'Неподтверждённые записи'];
    if (role === 'director' || role === 'owner' || role === 'admin') {
      return [...base, 'Аналитика за сегодня', 'Неоплаченные счета', 'Загрузка врачей'];
    }
    if (role === 'doctor') {
      return [...base, 'Мои пациенты на сегодня', 'Открыть медкарту', 'План лечения'];
    }
    if (role === 'assistant' || role === 'reception') {
      return [...base, 'Новая запись', 'Подтвердить запись', 'Создать счёт'];
    }
    return base;
  };

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
    setShowActionConfirm(false);

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
        proactive: res.proactive,
      };

      setMessages(prev => [...prev, aiMsg]);
      setSuggestions(res.suggestions || []);
      setActiveSkill(res.skill || activeSkill);

      historyRef.current.push({ role: 'assistant', content: res.reply });

      if (res.actions?.length) {
        const action = res.actions[0];
        if (action.confidence > 0.85 && !action.requiresConfirmation) {
          await executeAction(action.type, action.params);
        } else if (action.confidence > 0.6) {
          setPendingAction({
            action,
            params: action.params || {},
            confirmMessage: `Выполнить: ${action.label}?`,
          });
          setShowActionConfirm(true);
        }
      }

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
  }, [input, isProcessing, activeSkill]);

  const executeAction = async (actionType: string, params: Record<string, unknown> = {}) => {
    setIsProcessing(true);
    try {
      const result = await aiAction(actionType, params);
      setMessages(prev => [...prev, {
        id: `action-${Date.now()}`,
        role: 'assistant',
        content: result?.message || `Действие "${actionType}" выполнено.`,
        timestamp: new Date(),
      }]);
      
      // Handle navigation actions
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
        OpenMedicalCard: '/crm/medical-card',
        OpenVisits: '/crm/visits',
        OpenInventory: '/crm/inventory',
        OpenStaff: '/crm/staff',
      };
      
      if (navMap[actionType]) {
        onNavigate(navMap[actionType]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `action-err-${Date.now()}`,
        role: 'assistant',
        content: `Не удалось выполнить действие: ${e?.message || 'неизвестная ошибка'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
      setPendingAction(null);
      setShowActionConfirm(false);
    }
  };

  const handleActionConfirm = (confirmed: boolean) => {
    if (confirmed && pendingAction) {
      executeAction(pendingAction.action.type, pendingAction.params);
    } else {
      setPendingAction(null);
      setShowActionConfirm(false);
    }
  };

  const handleQuickAction = (query: string) => {
    handleSend(query);
  };

  const handleServiceClick = (path: string) => {
    onNavigate(path);
    setIsMinimized(true);
  };

  const handleContextSelect = async (contextType: string, contextId: string) => {
    await aiSetContext({ [contextType]: contextId });
    setConversationContext(prev => ({ ...prev, [contextType]: contextId }));
    handleSend(`Контекст установлен: ${contextType} ${contextId}`);
  };

  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-1 border border-bdr-subtle shadow-2xl cursor-pointer"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dv-gold/10">
            <Bot size={20} className="text-dv-gold" />
          </div>
          <span className="text-sm font-medium text-txt-primary">DentVision Intelligence</span>
          <ChevronRight size={16} className="text-txt-muted" />
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-xl shadow-black/5">
        <div className="flex items-center justify-between border-b border-bdr-subtle px-4 py-3 bg-gradient-to-r from-dv-gold/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dv-gold/10">
              <Bot size={18} className="text-dv-gold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-txt-primary">DentVision Intelligence</h2>
              <p className="text-xs text-txt-muted">Ваш цифровой ассистент</p>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-dv-gold/10 border border-dv-gold/20"
            >
              <Zap size={10} className="text-dv-gold" />
              <span className="text-2xs font-medium text-dv-gold">{activeSkill}</span>
            </motion.div>
          </div>
          <div className="flex items-center gap-2">
            {proactive.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {}}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-amber-400 bg-amber-400/10"
              >
                <Bell size={12} />
                {proactive.length} оповещений
              </motion.button>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Chat Area */}
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-b border-bdr-subtle flex-1 flex flex-col min-h-0"
          >
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              <AnimatePresence>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} msg={msg} onAction={handleQuickAction} />
                ))}
              </AnimatePresence>
              
              <AnimatePresence>
                {isProcessing && <TypingIndicator />}
              </AnimatePresence>
              
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && !isProcessing && (
              <div className="px-4 pb-2">
                <SuggestionChips suggestions={suggestions} onSelect={handleSend} disabled={isProcessing} />
              </div>
            )}

            {/* Chat Input */}
            <ChatInput value={input} onChange={setInput} onSend={() => handleSend()} disabled={isProcessing} />
          </motion.div>
        )}

        {/* Action Confirmation Modal */}
        {showActionConfirm && pendingAction && (
          <ActionConfirm
            action={pendingAction.action}
            message={pendingAction.confirmMessage}
            onConfirm={handleActionConfirm}
          />
        )}

        {/* Proactive Alerts */}
        {proactive.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-t border-bdr-subtle p-3 max-h-[200px] overflow-y-auto"
          >
            <div className="flex items-center gap-2 mb-2">
              <Bell size={14} className="text-amber-400" />
              <span className="text-xs font-semibold text-txt-secondary">Проактивные оповещения</span>
            </div>
            <ProactiveAlerts 
              alerts={proactive} 
              onDismiss={(text) => setProactive(prev => prev.filter(a => a.text !== text))}
              compact
            />
          </motion.div>
        )}

        {/* Service Cards Grid - Quick Access */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-4"
        >
          {AI_SERVICES.map((s) => (
            <motion.button
              key={s.id}
              whileHover={{ scale: 1.03, y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleServiceClick(s.path)}
              className={cn(
                'group relative overflow-hidden rounded-xl border border-bdr-subtle p-3 text-left',
                'bg-gradient-to-br transition-all duration-200',
                s.gradient,
                'hover:border-bdr/50 hover:shadow-lg'
              )}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl mb-2 transition-transform duration-200 group-hover:scale-110"
                style={{ background: `${s.color}15`, color: s.color }}
              >
                {s.icon}
              </div>
              <h3 className="text-sm font-semibold text-txt-primary">{s.name}</h3>
              <p className="text-xs text-txt-muted">{s.description}</p>
              <ChevronRight
                size={14}
                className="absolute right-3 top-3 text-txt-muted opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </motion.button>
          ))}
        </motion.div>
      </Card>
    </div>
  );
}

export default DentVisionIntelligence;