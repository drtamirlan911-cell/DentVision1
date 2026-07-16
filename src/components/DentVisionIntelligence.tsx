import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiChat, aiGreeting, aiProactive } from '@/utils/api';
import { ChatMessage, type ChatMsg } from './intelligence/ChatMessage';
import { TypingIndicator } from './intelligence/TypingIndicator';
import { ChatInput } from './intelligence/ChatInput';
import { SuggestionChips } from './intelligence/SuggestionChips';
import { ProactiveAlerts } from './intelligence/ProactiveAlerts';
import { cn } from '@/lib/utils';

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
  { id: 'crm', name: 'CRM', description: 'Пациенты и расписание', icon: <Stethoscope size={18} />, path: '/crm/schedule', color: '#C9A96E', gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5' },
  { id: 'shop', name: 'Shop', description: 'Маркетплейс товаров', icon: <ShoppingCart size={18} />, path: '/shop', color: '#27AE60', gradient: 'from-[#27AE60]/20 to-[#27AE60]/5' },
  { id: 'school', name: 'School', description: 'Образовательная платформа', icon: <GraduationCap size={18} />, path: '/school', color: '#2980B9', gradient: 'from-[#2980B9]/20 to-[#2980B9]/5' },
  { id: 'analytics', name: 'Аналитика', description: 'Отчёты и метрики', icon: <BarChart3 size={18} />, path: '/analytics', color: '#F39C12', gradient: 'from-[#F39C12]/20 to-[#F39C12]/5' },
  { id: 'lab', name: 'Лаборатория', description: 'Лабораторные заказы', icon: <FlaskConical size={18} />, path: '/crm/lab', color: '#00BCD4', gradient: 'from-[#00BCD4]/20 to-[#00BCD4]/5' },
  { id: 'patients', name: 'Пациенты', description: 'База пациентов', icon: <Users size={18} />, path: '/crm/patients', color: '#E74C3C', gradient: 'from-[#E74C3C]/20 to-[#E74C3C]/5' },
  { id: 'documents', name: 'Документы', description: 'Документооборот', icon: <FileText size={18} />, path: '/crm/documents', color: '#8E44AD', gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5' },
  { id: 'settings', name: 'Настройки', description: 'Конфигурация', icon: <Settings size={18} />, path: '/settings', color: '#64748B', gradient: 'from-[#64748B]/20 to-[#64748B]/5' },
];

interface DentVisionIntelligenceProps {
  onNavigate: (path: string) => void;
}

export function DentVisionIntelligence({ onNavigate }: DentVisionIntelligenceProps) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [proactive, setProactive] = useState<Array<{ type: string; category: string; text: string; priority: number; action?: { type: string } }>>([]);
  const [initialized, setInitialized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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
      onNavigate(navMap[actionType]);
      return;
    }

    setIsProcessing(true);
    try {
      const { aiAction } = await import('@/utils/api');
      const result = await aiAction(actionType, params || {});
      setMessages(prev => [...prev, {
        id: `action-${Date.now()}`,
        role: 'assistant',
        content: result?.message || `Действие "${actionType}" выполнено.`,
        timestamp: new Date(),
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `action-err-${Date.now()}`,
        role: 'assistant',
        content: `Не удалось выполнить действие: ${e?.message || 'неизвестная ошибка'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [onNavigate]);

  const handleQuickAction = (query: string) => {
    handleSend(query);
  };

  const handleServiceClick = (path: string) => {
    onNavigate(path);
    setIsMinimized(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
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
          </div>
          <div className="flex items-center gap-2">
            {proactive.length > 0 && (
              <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">{proactive.length} оповещений</span>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-b border-bdr-subtle"
          >
            <div className="max-h-[40vh] overflow-y-auto px-4 py-3 space-y-3">
              <AnimatePresence>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} msg={msg} />
                ))}
              </AnimatePresence>
              
              <AnimatePresence>
                {isProcessing && <TypingIndicator />}
              </AnimatePresence>
              
              <div ref={messagesEndRef} />
            </div>

            {suggestions.length > 0 && !isProcessing && (
              <div className="px-4 pb-2">
                <SuggestionChips suggestions={suggestions} onSelect={handleSend} disabled={isProcessing} />
              </div>
            )}

            <ChatInput value={input} onChange={setInput} onSend={() => handleSend()} disabled={isProcessing} />
          </motion.div>
        )}
      </Card>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4"
      >
        {SERVICES.map((s) => (
          <motion.button
            key={s.id}
            variants={itemVariants}
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