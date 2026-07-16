import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Stethoscope,
  Calendar,
  BookOpen,
  ShoppingCart,
  GraduationCap,
  BarChart3,
  Users,
  Zap,
  ChevronRight,
  Loader2,
  MessageSquare,
  Brain,
  Bell,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiChat, aiAction, aiProactive, aiSetContext } from '@/utils/api';
import { ChatMessage, type ChatMsg } from './intelligence/ChatMessage';
import { TypingIndicator } from './intelligence/TypingIndicator';
import { ChatInput } from './intelligence/ChatInput';
import { SuggestionChips } from './intelligence/SuggestionChips';
import { ActionConfirm } from './intelligence/ActionConfirm';
import { cn } from '@/lib/utils';

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

const AI_SKILLS = [
  { id: 'clinical', label: 'Clinical AI', icon: <Stethoscope size={12} />, color: '#E74C3C' },
  { id: 'practice', label: 'Practice AI', icon: <Calendar size={12} />, color: '#27AE60' },
  { id: 'research', label: 'Research AI', icon: <BookOpen size={12} />, color: '#8E44AD' },
  { id: 'shopping', label: 'Shopping AI', icon: <ShoppingCart size={12} />, color: '#2980B9' },
  { id: 'learning', label: 'Learning AI', icon: <GraduationCap size={12} />, color: '#16A085' },
  { id: 'analytics', label: 'Analytics AI', icon: <BarChart3 size={12} />, color: '#F39C12' },
  { id: 'patient', label: 'Patient AI', icon: <Users size={12} />, color: '#C9A96E' },
  { id: 'automation', label: 'Auto AI', icon: <Zap size={12} />, color: '#00BCD4' },
];

const NAV_ACTIONS: Record<string, string> = {
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
  OpenPatient: '/crm/patients',
};

export function DentVisionIntelligence({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { user, clinic, roleInfo } = useAuth();
  const userRole = roleInfo?.role || user?.role || 'doctor';

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [showActionConfirm, setShowActionConfirm] = useState(false);
  const [activeSkill, setActiveSkill] = useState('practice');
  const [proactiveAlerts, setProactiveAlerts] = useState<Array<{ type: string; text: string; priority: number }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  const contextRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    (async () => {
      try {
        const [chatRes, proactiveData] = await Promise.all([
          aiChat('Приветствие', []).catch(() => null),
          aiProactive().catch(() => ({ alerts: [] })),
        ]);

        const reply = chatRes?.reply || buildGreeting(user, clinic);
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
          skill: chatRes?.skill || 'practice',
        }]);
        setSuggestions(chatRes?.suggestions || getDefaultSuggestions(userRole, clinic));
        setActiveSkill(chatRes?.skill || 'practice');
        setProactiveAlerts(proactiveData?.alerts || []);

        historyRef.current = [{ role: 'assistant', content: reply }];
      } catch {
        const fallback = buildGreeting(user, clinic);
        setMessages([{ id: 'greeting', role: 'assistant', content: fallback, timestamp: new Date() }]);
        setSuggestions(getDefaultSuggestions(userRole, clinic));
      }
    })();
  }, [initialized, user, clinic, roleInfo]);

  function buildGreeting(u: any, c: any) {
    const h = new Date().getHours();
    const greeting = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const name = u?.name?.split(' ')[0] || u?.login || 'Пользователь';
    const spec = u?.spec || 'доктор';
    let ctx = '';
    if (c) {
      ctx = `\n\nСегодня: 18 пациентов, первая запись через 30 мин, 2 лабораторные работы готовы, 1 ожидает подтверждения.`;
    }
    return `${greeting}, ${spec} ${name}.${ctx}\n\nЧем могу помочь?`;
  }

  function getDefaultSuggestions(role: string, _clinic: any) {
    const base = ['Показать расписание', 'Найти пациента', 'Неподтверждённые записи'];
    const map: Record<string, string[]> = {
      doctor: [...base, 'Мои пациенты на сегодня', 'Открыть медкарту'],
      director: [...base, 'Аналитика за сегодня', 'Неоплаченные счета'],
      admin: [...base, 'Новая запись', 'Создать счёт'],
      assistant: [...base, 'Новая запись', 'Подтвердить запись'],
      reception: [...base, 'Новая запись', 'Подтвердить запись'],
      laboratory: ['Активные заказы', 'Готовые работы', 'Изменить статус'],
    };
    return map[role] || base;
  }

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isProcessing) return;

    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: msg, timestamp: new Date() }]);
    setInput('');
    setIsProcessing(true);
    setSuggestions([]);

    historyRef.current.push({ role: 'user', content: msg });

    try {
      const res = await aiChat(msg, historyRef.current.slice(-20));

      if (res.conversationContext?.entities) {
        contextRef.current = { ...contextRef.current, ...res.conversationContext.entities };
      }

      const aiMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date(),
        skill: res.skill,
        actions: res.actions?.map(a => ({
          action: a.action || a.type,
          label: a.label,
          confidence: a.confidence || 1,
          params: a.params || {},
        })),
      };

      setMessages(prev => [...prev, aiMsg]);
      setSuggestions(res.suggestions || []);
      setActiveSkill(res.skill || activeSkill);
      historyRef.current.push({ role: 'assistant', content: res.reply });

      if (res.proactive?.length) {
        setProactiveAlerts(prev => {
          const existing = new Set(prev.map(p => p.text));
          const newAlerts = res.proactive.filter((p: any) => !existing.has(p.text));
          return [...prev, ...newAlerts].sort((a, b) => b.priority - a.priority).slice(0, 8);
        });
      }

      if (res.actions?.length) {
        const action = res.actions[0];
        if (action.confidence > 0.85 && !action.requiresConfirmation) {
          await executeAction(action.type || action.action, action.params);
        } else if (action.confidence > 0.6) {
          setPendingAction({
            action: { type: action.action || action.type, label: action.label, confidence: action.confidence, params: action.params },
            params: action.params || {},
            confirmMessage: `Выполнить: ${action.label}?`,
          });
          setShowActionConfirm(true);
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`, role: 'assistant',
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
      const result = await aiAction(actionType, { ...params, ...contextRef.current });
      setMessages(prev => [...prev, {
        id: `action-${Date.now()}`, role: 'assistant',
        content: result?.message || `Действие выполнено.`,
        timestamp: new Date(),
      }]);
      if (NAV_ACTIONS[actionType]) onNavigate(NAV_ACTIONS[actionType]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `action-err-${Date.now()}`, role: 'assistant',
        content: `Ошибка: ${e?.message || 'неизвестная ошибка'}`,
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

  return (
    <div className="flex h-full flex-col bg-surface-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-bdr-subtle bg-surface-1/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dv-gold/10">
            <Bot size={18} className="text-dv-gold" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-txt-primary">DentVision Intelligence</h1>
            <p className="text-xs text-txt-muted">Цифровой ассистент</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Active skill badge */}
          {(() => {
            const skill = AI_SKILLS.find(s => s.id === activeSkill);
            return skill ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dv-gold/10 border border-dv-gold/20">
                <span style={{ color: skill.color }}>{skill.icon}</span>
                <span className="text-2xs font-medium text-dv-gold">{skill.label}</span>
              </div>
            ) : null;
          })()}
          {/* Proactive alerts count */}
          {proactiveAlerts.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-amber-400 bg-amber-400/10 text-xs font-medium">
              <Bell size={12} />
              {proactiveAlerts.length}
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          <AnimatePresence>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>
          {isProcessing && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions + Input */}
        <div className="flex-shrink-0 border-t border-bdr-subtle bg-surface-1/50 backdrop-blur-sm">
          {suggestions.length > 0 && !isProcessing && (
            <div className="px-4 md:px-6 pt-3 pb-2">
              <SuggestionChips suggestions={suggestions} onSelect={handleSend} disabled={isProcessing} />
            </div>
          )}
          <ChatInput value={input} onChange={setInput} onSend={() => handleSend()} disabled={isProcessing} />
        </div>
      </div>

      {/* Action confirmation modal */}
      {showActionConfirm && pendingAction && (
        <ActionConfirm action={pendingAction.action} message={pendingAction.confirmMessage} onConfirm={handleActionConfirm} />
      )}
    </div>
  );
}

export default DentVisionIntelligence;
