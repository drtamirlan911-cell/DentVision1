import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  Sparkles, 
  Loader2, 
  X, 
  Minimize2, 
  Maximize2,
  MessageSquare,
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
  Package,
  ClipboardCheck,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/hooks/useData';
import { actionRegistry, type ActionResult } from '@/lib/actionRegistry';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';

// ─── Types ───

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: DetectedAction[];
  context?: Record<string, unknown>;
}

interface DetectedAction {
  actionId: string;
  confidence: number;
  parameters?: Record<string, unknown>;
}

interface ServiceCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  gradient: string;
}

// ─── AI Skills ───

interface AISkill {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  keywords: string[];
}

const AI_SKILLS: AISkill[] = [
  {
    id: 'clinical',
    name: 'Clinical AI',
    description: 'Диагностика и планы лечения',
    icon: <Microscope size={16} />,
    color: '#E74C3C',
    keywords: ['диагноз', 'лечение', 'протокол', 'снимок', 'кт', 'рентген'],
  },
  {
    id: 'practice',
    name: 'Practice AI',
    description: 'Управление клиникой',
    icon: <Stethoscope size={16} />,
    color: '#C9A96E',
    keywords: ['запись', 'расписание', 'пациент', 'приём', 'визит'],
  },
  {
    id: 'research',
    name: 'Research AI',
    description: 'Научные данные и исследования',
    icon: <Brain size={16} />,
    color: '#8E44AD',
    keywords: ['исследование', 'публикация', 'наука', 'доказательный', 'статья'],
  },
  {
    id: 'shopping',
    name: 'Shopping AI',
    description: 'Подбор оборудования и материалов',
    icon: <ShoppingCart size={16} />,
    color: '#27AE60',
    keywords: ['товар', 'оборудование', 'материал', 'купить', 'заказать', 'сканер'],
  },
  {
    id: 'learning',
    name: 'Learning AI',
    description: 'Обучение и курсы',
    icon: <BookOpen size={16} />,
    color: '#2980B9',
    keywords: ['курс', 'обучение', 'вебинар', 'школа', 'лекция'],
  },
  {
    id: 'analytics',
    name: 'Analytics AI',
    description: 'Финансы и метрики',
    icon: <TrendingUp size={16} />,
    color: '#F39C12',
    keywords: ['финанс', 'отчёт', 'выручка', 'чек', 'аналитика', 'доход'],
  },
  {
    id: 'patient',
    name: 'Patient AI',
    description: 'Работа с пациентами',
    icon: <Users size={16} />,
    color: '#00BCD4',
    keywords: ['пациент', 'карта', 'история', 'жалоба', 'осмотр'],
  },
  {
    id: 'automation',
    name: 'Automation AI',
    description: 'Автоматизация процессов',
    icon: <Zap size={16} />,
    color: '#E91E8C',
    keywords: ['автоматизация', 'напоминание', 'уведомление', 'триггер'],
  },
];

// ─── Service Cards ───

const SERVICES: ServiceCard[] = [
  {
    id: 'crm',
    name: 'CRM',
    description: 'Пациенты и расписание',
    icon: <Stethoscope size={20} />,
    path: '/crm/schedule',
    color: '#C9A96E',
    gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5',
  },
  {
    id: 'shop',
    name: 'Shop',
    description: 'Маркетплейс товаров',
    icon: <ShoppingCart size={20} />,
    path: '/shop',
    color: '#27AE60',
    gradient: 'from-[#27AE60]/20 to-[#27AE60]/5',
  },
  {
    id: 'school',
    name: 'School',
    description: 'Образовательная платформа',
    icon: <GraduationCap size={20} />,
    path: '/school',
    color: '#2980B9',
    gradient: 'from-[#2980B9]/20 to-[#2980B9]/5',
  },
  {
    id: 'analytics',
    name: 'Аналитика',
    description: 'Отчёты и метрики',
    icon: <BarChart3 size={20} />,
    path: '/analytics',
    color: '#F39C12',
    gradient: 'from-[#F39C12]/20 to-[#F39C12]/5',
  },
  {
    id: 'finance',
    name: 'Финансы',
    description: 'Доходы и расходы',
    icon: <DollarSign size={20} />,
    path: '/crm/cashier',
    color: '#27AE60',
    gradient: 'from-[#27AE60]/20 to-[#27AE60]/5',
  },
  {
    id: 'lab',
    name: 'Лаборатория',
    description: 'Лабораторные заказы',
    icon: <FlaskConical size={20} />,
    path: '/crm/lab',
    color: '#00BCD4',
    gradient: 'from-[#00BCD4]/20 to-[#00BCD4]/5',
  },
  {
    id: 'patients',
    name: 'Пациенты',
    description: 'База пациентов',
    icon: <Users size={20} />,
    path: '/crm/patients',
    color: '#E74C3C',
    gradient: 'from-[#E74C3C]/20 to-[#E74C3C]/5',
  },
  {
    id: 'settings',
    name: 'Настройки',
    description: 'Конфигурация системы',
    icon: <Settings size={20} />,
    path: '/settings',
    color: '#64748B',
    gradient: 'from-[#64748B]/20 to-[#64748B]/5',
  },
];

const QUICK_ACTIONS = [
  { label: 'Расписание', icon: <Calendar size={14} />, query: 'Покажи расписание на сегодня' },
  { label: 'Пациенты', icon: <Users size={14} />, query: 'Список пациентов' },
  { label: 'Финансы', icon: <DollarSign size={14} />, query: 'Финансовый отчёт за сегодня' },
  { label: 'Запись', icon: <MessageSquare size={14} />, query: 'Создать новую запись' },
];

// ─── AI Personality & Greetings ───

function generateGreeting(user: { name?: string; role?: string }, data: ReturnType<typeof useData>): string {
  const hour = new Date().getHours();
  const timeGreeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  
  const name = user?.name?.split(' ')[0] || user?.login || '';
  const roleLabel = user?.role === 'doctor' ? 'доктор' : user?.role === 'admin' ? 'администратор' : '';
  
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = (data.appointments || []).filter(a => a.date === today);
  const pendingConfirmations = todayAppts.filter(a => a.status === 'pending').length;
  const labReady = (data.labOrders || []).filter(o => o.status === 'ready').length;
  
  const lines = [`${timeGreeting}${name ? `, ${roleLabel} ${name}` : ''}.`];
  
  if (todayAppts.length > 0) {
    const firstAppt = todayAppts.sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0];
    if (firstAppt?.time) {
      lines.push(`Первая запись через ${getMinutesUntil(firstAppt.time)} минут.`);
    }
    lines.push(`Сегодня ${todayAppts.length} пациентов.`);
  }
  
  if (pendingConfirmations > 0) {
    lines.push(`${pendingConfirmations} записей ожидают подтверждения.`);
  }
  
  if (labReady > 0) {
    lines.push(`${labReady} лабораторных работ готовы.`);
  }
  
  lines.push('Чем могу помочь?');
  
  return lines.join(' ');
}

function getMinutesUntil(timeStr: string): number {
  const now = new Date();
  const [hours, minutes] = timeStr.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  const diff = Math.floor((target.getTime() - now.getTime()) / 60000);
  return Math.max(0, diff);
}

// ─── Intent Detection ───

function detectIntent(message: string): { intent: string; confidence: number; params?: Record<string, unknown> } {
  const text = message.toLowerCase();
  
  // Patient-related intents
  if (text.includes('пациент') && (text.includes('открой') || text.includes('найди') || text.includes('покажи'))) {
    const patientName = text.match(/(?:пациент[ау]|имя)?\s*([а-яёa-z]+\s*[а-яёa-z]*)/i)?.[1];
    return { intent: 'openPatient', confidence: 0.9, params: { patientName } };
  }
  
  // Appointment intents
  if (text.includes('запись') && (text.includes('создай') || text.includes('добавь') || text.includes('запиши'))) {
    return { intent: 'createAppointment', confidence: 0.85 };
  }
  
  if (text.includes('расписание') || text.includes('график')) {
    return { intent: 'openSchedule', confidence: 0.9 };
  }
  
  // Finance intents
  if (text.includes('финанс') || text.includes('доход') || text.includes('выручк') || text.includes('отчёт')) {
    return { intent: 'getFinancialReport', confidence: 0.85 };
  }
  
  if (text.includes('средний чек')) {
    return { intent: 'getAverageCheck', confidence: 0.9 };
  }
  
  // Navigation intents
  if (text.includes('открой') && text.includes('раздел')) {
    const section = text.match(/раздел\s*([а-яё]+)/i)?.[1];
    return { intent: 'navigateTo', confidence: 0.7, params: { section } };
  }
  
  // Shop intents
  if (text.includes('товар') || text.includes('купить') || text.includes('заказать') || text.includes('материал')) {
    return { intent: 'searchShop', confidence: 0.8 };
  }
  
  // School intents
  if (text.includes('курс') || text.includes('обучен') || text.includes('вебинар')) {
    return { intent: 'recommendCourse', confidence: 0.8 };
  }
  
  // Lab intents
  if (text.includes('лаборатор') || text.includes('техник') || text.includes('работа')) {
    return { intent: 'trackLabOrder', confidence: 0.8 };
  }
  
  // Default
  return { intent: 'general', confidence: 0.5 };
}

// ─── Main Component ───

export function DentVisionIntelligence() {
  const navigate = useNavigate();
  const { user, roleInfo } = useAuth();
  const data = useData(user?.clinicId);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showServices, setShowServices] = useState(true);
  const [hasAnimated, setHasAnimated] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Initial greeting animation
  useEffect(() => {
    if (!hasAnimated && user) {
      const timer = setTimeout(() => {
        const greeting = generateGreeting(user, data);
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: greeting,
          timestamp: new Date(),
        }]);
        setHasAnimated(true);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [user, data, hasAnimated]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Focus input on mount
  useEffect(() => {
    if (!isMinimized) {
      inputRef.current?.focus();
    }
  }, [isMinimized]);
  
  const processMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    
    // Detect intent
    const detection = detectIntent(text);
    
    // Find matching action
    const action = actionRegistry.get(detection.intent) || actionRegistry.search(text)[0];
    
    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
    
    let aiResponse: ChatMessage;
    
    if (action) {
      // Execute action
      const result: ActionResult = await actionRegistry.execute(action.id, detection.params || {}, user?.role);
      
      if (result.navigateTo) {
        navigate(result.navigateTo);
      }
      
      aiResponse = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.message || `Выполняю действие: ${action.name}`,
        timestamp: new Date(),
        actions: [{ actionId: action.id, confidence: detection.confidence }],
      };
    } else {
      // General response
      aiResponse = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: generateGeneralResponse(text, data, user),
        timestamp: new Date(),
      };
    }
    
    setMessages(prev => [...prev, aiResponse]);
    setIsProcessing(false);
  }, [navigate, user, data]);
  
  const handleSend = () => {
    if (input.trim() && !isProcessing) {
      processMessage(input);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleQuickAction = (query: string) => {
    processMessage(query);
  };
  
  const handleServiceClick = (path: string) => {
    navigate(path);
    setIsMinimized(true);
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };
  
  const serviceCardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    show: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    },
    hover: { scale: 1.03, y: -4, transition: { duration: 0.2 } },
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-surface-0/95 backdrop-blur-xl">
      {/* Welcome Logo Animation */}
      <AnimatePresence>
        {!hasAnimated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex h-20 w-20 items-center justify-center rounded-2xl bg-dv-gold/15"
              >
                <Stethoscope size={40} className="text-dv-gold" />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-txt-primary tracking-tight"
              >
                DentVision
              </motion.h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main Content */}
      <div className="flex h-full flex-col items-center justify-center p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="w-full max-w-4xl"
        >
          {/* AI Chat Card */}
          <Card className="overflow-hidden shadow-2xl shadow-black/10">
            {/* Header */}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
              </div>
            </div>
            
            {/* Messages */}
            {!isMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="border-b border-bdr-subtle"
              >
                <div className="max-h-[40vh] overflow-y-auto px-6 py-4 space-y-4">
                  <AnimatePresence>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                          'flex gap-3',
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {msg.role === 'assistant' && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10">
                            <Bot size={16} className="text-dv-gold" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                            msg.role === 'user'
                              ? 'bg-dv-gold text-white rounded-br-md'
                              : 'bg-surface-2 border border-bdr-subtle rounded-bl-md'
                          )}
                        >
                          {msg.content}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10">
                        <Loader2 size={16} className="animate-spin text-dv-gold" />
                      </div>
                      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface-2 border border-bdr-subtle px-4 py-3">
                        <span className="text-sm text-txt-muted">Думаю</span>
                        <div className="flex gap-1">
                          <motion.span
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                            className="w-1.5 h-1.5 rounded-full bg-dv-gold"
                          />
                          <motion.span
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                            className="w-1.5 h-1.5 rounded-full bg-dv-gold"
                          />
                          <motion.span
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                            className="w-1.5 h-1.5 rounded-full bg-dv-gold"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Quick Actions */}
                <div className="px-6 py-3 bg-surface-2/50 border-t border-bdr-subtle">
                  <div className="flex flex-wrap gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.query)}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-bdr-subtle text-txt-secondary hover:border-dv-gold hover:text-dv-gold transition-colors disabled:opacity-50"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Input */}
            {!isMinimized && (
              <div className="flex items-center gap-3 px-6 py-4 bg-surface-1">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Спросите о чём угодно или попросите выполнить действие..."
                  className="flex-1 bg-transparent text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none"
                  disabled={isProcessing}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim() || isProcessing}
                  icon={<Send size={14} />}
                  className="shrink-0"
                >
                  Отправить
                </Button>
              </div>
            )}
          </Card>
          
          {/* Service Cards - Transform to Sidebar */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={cn(
              'grid gap-3 mt-6',
              showServices 
                ? 'grid-cols-2 md:grid-cols-4' 
                : 'grid-cols-1 md:hidden'
            )}
          >
            {SERVICES.map((service) => (
              <motion.button
                key={service.id}
                variants={serviceCardVariants}
                whileHover="hover"
                onClick={() => handleServiceClick(service.path)}
                className={cn(
                  'group relative overflow-hidden rounded-xl border border-bdr-subtle p-4 text-left',
                  'bg-gradient-to-br transition-all duration-300',
                  service.gradient,
                  'hover:border-bdr/50 hover:shadow-lg'
                )}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl mb-3 transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `${service.color}20`, color: service.color }}
                >
                  {service.icon}
                </div>
                <h3 className="text-sm font-semibold text-txt-primary mb-0.5">{service.name}</h3>
                <p className="text-xs text-txt-muted">{service.description}</p>
                <ChevronRight
                  size={14}
                  className="absolute right-3 top-3 text-txt-muted opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </motion.button>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Helper Functions ───

function generateGeneralResponse(message: string, data: ReturnType<typeof useData>, user: { name?: string; role?: string } | null): string {
  const text = message.toLowerCase();
  
  // Contextual responses based on data
  if (text.includes('сколько') && text.includes('пациент')) {
    return `В базе ${(data.patients || []).length} активных пациентов.`;
  }
  
  if (text.includes('запис') && text.includes('сегодня')) {
    const today = new Date().toISOString().split('T')[0];
    const count = (data.appointments || []).filter(a => a.date === today).length;
    return `Сегодня ${count} записей.`;
  }
  
  if (text.includes('помоги') || text.includes('что умеешь')) {
    return `Я могу:\n• Показать расписание и записи\n• Открыть карту пациента\n• Создать счёт или принять оплату\n• Показать финансовую аналитику\n• Рекомендовать товары или курсы\n• Помочь с документами\n\nПросто попросите!`;
  }
  
  // Default helpful response
  return `Понял ваш запрос. Я могу помочь с управлением клиникой, работой с пациентами, финансами и обучением. Попробуйте спросить:\n• «Покажи расписание на сегодня»\n• «Открой пациента Иванова»\n• «Какой доход за месяц?»\n• «Рекомендуй курс по имплантации»`;
}

export default DentVisionIntelligence;
