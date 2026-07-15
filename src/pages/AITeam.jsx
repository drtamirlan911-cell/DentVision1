import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast, useData } from '../hooks/useData';
import { Button } from '../components/ui/ds/Button';
import { Card, CardContent } from '../components/ui/ds/Card';
import { buildAiReply } from '../utils/aiHelpers';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Calendar,
  BarChart3,
  Megaphone,
  Bot,
  TrendingUp,
  Target,
  Trash2,
  Send,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '../components/ui/ds/StatCard';

const ASSISTANTS = [
  {
    id: 'consultant',
    name: 'Консультант',
    Icon: MessageSquare,
    color: 'text-sky-400',
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/50',
    dot: 'bg-sky-400',
    role: 'Отвечает на вопросы пациентов',
    quickActions: ['Услуги и цены', 'О врачах', 'Текущие акции', 'Контакты клиники'],
  },
  {
    id: 'scheduler',
    name: 'Администратор',
    Icon: Calendar,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/50',
    dot: 'bg-emerald-400',
    role: 'Управляет расписанием и записями',
    quickActions: ['Записаться на приём', 'Отменить запись', 'Перенести время', 'Свободные слоты'],
  },
  {
    id: 'analyst',
    name: 'Аналитик',
    Icon: BarChart3,
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/50',
    dot: 'bg-purple-400',
    role: 'Анализирует показатели клиники',
    quickActions: ['Отчёт за сегодня', 'Отчёт за месяц', 'KPI врачей', 'Прогноз доходов'],
  },
  {
    id: 'marketing',
    name: 'Маркетолог',
    Icon: Megaphone,
    color: 'text-pink-400',
    bg: 'bg-pink-500/15',
    border: 'border-pink-500/50',
    dot: 'bg-pink-400',
    role: 'Продвижение и работа с отзывами',
    quickActions: ['Статистика рекламы', 'Предложения по акциям', 'Работа с отзывами', 'Контент-план'],
  },
];

const FEATURES = [
  { Icon: Bot, title: 'Автоответы', desc: 'Мгновенные ответы на вопросы пациентов 24/7' },
  { Icon: Calendar, title: 'Умное расписание', desc: 'Автозаполнение окон в расписании' },
  { Icon: TrendingUp, title: 'Прогнозы', desc: 'Предсказание загрузки и доходов клиники' },
  { Icon: Target, title: 'Персонализация', desc: 'Индивидуальные предложения для каждого пациента' },
];

const AI_FEATURES = [
  { Icon: Bot, text: 'Автоответы 24/7' },
  { Icon: Calendar, text: 'Умное расписание' },
  { Icon: TrendingUp, text: 'Прогнозы доходов' },
  { Icon: MessageSquare, text: 'WhatsApp-рассылки' },
  { Icon: Target, text: 'Персонализация' },
];

export default function AITeam() {
  const { clinic } = useOutletContext();
  const { showToast } = useToast();
  const { patients, appointments, receipts, doctors } = useData(clinic?.id);
  const [activeId, setActiveId] = useState('consultant');
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Здравствуйте! Я AI-ассистент DentVision. Готов помочь автоматизировать вашу клинику. Чем могу помочь?' },
  ]);
  const [userInput, setUserInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const chatEndRef = useRef(null);

  const activeAssistant = ASSISTANTS.find(a => a.id === activeId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, processing]);

  const sendMessage = (text) => {
    const msg = text || userInput.trim();
    if (!msg) return;
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setUserInput('');
    setProcessing(true);

    const delay = 600 + Math.random() * 300;
    setTimeout(() => {
      const reply = buildAiReply({
        message: msg,
        clinicName: clinic?.name || 'DentVision',
        patients,
        appointments,
        receipts,
        doctors,
      });
      setChatHistory(prev => [...prev, { role: 'assistant', content: reply }]);
      setProcessing(false);
    }, delay);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const switchAssistant = (id) => {
    if (id === activeId) return;
    setActiveId(id);
    const assistant = ASSISTANTS.find(a => a.id === id);
    setChatHistory([{
      role: 'assistant',
      content: `Привет! Я ${assistant.name}. ${assistant.role}. Чем могу помочь?`,
    }]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <PageHeader
        title="AI Команда"
        subtitle="Виртуальные ассистенты для автоматизации клиники"
        icon={<Bot size={24} className="text-dv-gold" />}
      />

      <div className="grid grid-cols-[240px_1fr] gap-4 max-lg:grid-cols-1">
        {/* Assistants sidebar */}
        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-txt-muted mb-3">
              Выберите ассистента
            </div>
            <div className="flex flex-col gap-1">
              {ASSISTANTS.map(a => {
                const isActive = activeId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => switchAssistant(a.id)}
                    className={`flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all duration-150 border-l-[3px] ${
                      isActive
                        ? 'bg-white/5'
                        : 'border-l-transparent hover:bg-white/[0.03]'
                    }`}
                    style={{ borderLeftColor: isActive ? undefined : 'transparent' }}
                  >
                    <a.Icon size={20} className={isActive ? a.color : 'text-txt-muted'} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-[13px] font-semibold ${isActive ? a.color : 'text-txt-secondary'}`}>
                        {a.name}
                      </div>
                      <div className="text-[10px] text-txt-muted truncate">{a.role}</div>
                    </div>
                    {isActive && (
                      <div className={`w-2 h-2 rounded-full shrink-0 ${a.dot}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-dv-gold mb-2.5">
              Возможности AI
            </div>
            <div className="flex flex-col gap-1.5">
              {AI_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs text-txt-secondary">
                  <f.Icon size={14} className="text-dv-gold" />
                  {f.text}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Chat panel */}
        <Card padding="none" className="flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-bdr-subtle">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-11 h-11 rounded-full border-2 ${activeAssistant.bg} ${activeAssistant.border}`}>
                <activeAssistant.Icon size={20} className={activeAssistant.color} />
              </div>
              <div>
                <div className="text-[15px] font-bold text-txt-primary">{activeAssistant.name}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <div className={`w-1.5 h-1.5 rounded-full ${activeAssistant.dot}`} />
                  Онлайн · {activeAssistant.role}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={() =>
                setChatHistory([
                  { role: 'assistant', content: `Привет! Я ${activeAssistant.name}. Чем могу помочь?` },
                ])
              }
            >
              Очистить
            </Button>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 flex-wrap px-5 py-3 border-b border-bdr-subtle">
            {activeAssistant.quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => sendMessage(action)}
                className="px-3 py-1.5 rounded-full text-xs border border-bdr-subtle bg-white/[0.04] text-txt-secondary transition-all duration-150 whitespace-nowrap hover:border-dv-gold hover:text-dv-gold"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-4 max-h-[420px]">
            <AnimatePresence initial={false}>
              {chatHistory.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 mr-2 mt-0.5 ${activeAssistant.bg}`}>
                      <activeAssistant.Icon size={16} className={activeAssistant.color} />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-dv-gold to-dv-gold-light text-surface-0 rounded-[14px_14px_4px_14px] shadow-[0_4px_12px_rgba(201,169,110,0.3)]'
                        : 'bg-white/[0.07] text-txt-primary border border-bdr-subtle rounded-[14px_14px_14px_4px]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {processing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2.5"
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${activeAssistant.bg}`}>
                  <activeAssistant.Icon size={16} className={activeAssistant.color} />
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3 rounded-[14px_14px_14px_4px] bg-white/[0.07] border border-bdr-subtle">
                  <Loader2 size={16} className={`animate-spin ${activeAssistant.color}`} />
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2.5 items-end px-5 py-4 border-t border-bdr-subtle">
            <input
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Написать ${activeAssistant.name.toLowerCase()}у\u2026 (Enter для отправки)`}
              disabled={processing}
              className="flex-1"
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => sendMessage()}
              disabled={processing || !userInput.trim()}
              loading={processing}
              icon={!processing ? <Send size={14} /> : undefined}
              className="shrink-0"
            >
              Отправить
            </Button>
          </div>
        </Card>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        {FEATURES.map((f, i) => (
          <Card key={i} className="p-4 text-center">
            <div className="flex justify-center mb-2.5">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-dv-gold/10 text-dv-gold">
                <f.Icon size={24} />
              </div>
            </div>
            <div className="text-sm font-bold text-txt-primary mb-1.5">{f.title}</div>
            <div className="text-xs text-txt-muted leading-relaxed">{f.desc}</div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
