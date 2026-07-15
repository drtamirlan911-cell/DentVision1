import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast, useData } from '../hooks/useData';
import { Button } from '../components/ui/ds/Button';
import { Card } from '../components/ui/ds/Card';
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

const ASSISTANTS = [
  {
    id: 'consultant',
    name: 'Консультант',
    Icon: MessageSquare,
    color: '#2980B9',
    role: 'Отвечает на вопросы пациентов',
    quickActions: ['Услуги и цены', 'О врачах', 'Текущие акции', 'Контакты клиники'],
    replies: [
      'Наши услуги включают: терапию, ортопедию, имплантацию, ортодонтию и гигиену. Какое направление вас интересует?',
      'Стоимость лечения кариеса — от 15 000 ₸. Стоимость имплантации — от 200 000 ₸. Уточните, что именно вас интересует?',
      'Мы работаем ежедневно с 9:00 до 20:00. Запись онлайн или по телефону.',
    ],
  },
  {
    id: 'scheduler',
    name: 'Администратор',
    Icon: Calendar,
    color: '#27AE60',
    role: 'Управляет расписанием и записями',
    quickActions: ['Записаться на приём', 'Отменить запись', 'Перенести время', 'Свободные слоты'],
    replies: [
      'Свободные слоты на этой неделе: Вт 10:00, Чт 14:30, Пт 11:00. Какое время удобно?',
      'Запись создана! Ждём вас. Напоминание придёт за 24 часа.',
      'Запись перенесена. Новое время подтверждено в WhatsApp.',
    ],
  },
  {
    id: 'analyst',
    name: 'Аналитик',
    Icon: BarChart3,
    color: '#8E44AD',
    role: 'Анализирует показатели клиники',
    quickActions: ['Отчёт за сегодня', 'Отчёт за месяц', 'KPI врачей', 'Прогноз доходов'],
    replies: [
      'За сегодня: 14 пациентов, доход 125 000 ₸, конверсия 68%. Загрузка врачей: 85%.',
      'За месяц доход вырос на +12%. Топ-услуга: имплантация (3 000 000 ₸). Рекомендую усилить маркетинг по ортопедии.',
      'Прогноз на следующий месяц: +18% при текущей динамике записей. Рекомендую запустить акцию на профгигиену.',
    ],
  },
  {
    id: 'marketing',
    name: 'Маркетолог',
    Icon: Megaphone,
    color: '#E91E8C',
    role: 'Продвижение и работа с отзывами',
    quickActions: ['Статистика рекламы', 'Предложения по акциям', 'Работа с отзывами', 'Контент-план'],
    replies: [
      'Лучший канал: рекомендации (+32 пациента). Instagram приносит +24. Предлагаю увеличить бюджет на Instagram на 20%.',
      'Рекомендую запустить акцию «Чистка + консультация = 15 000 ₸». Прогнозируем +15 пациентов.',
      'Выявлено 3 негативных отзыва на Google. Рекомендую ответить в течение 24 часов — это повышает рейтинг.',
    ],
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
      className="p-6"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-serif text-white">AI Команда</h1>
        <p className="text-xs text-[var(--slate)] mt-1">
          Виртуальные ассистенты для автоматизации клиники
        </p>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-4 max-lg:grid-cols-1">
        {/* Assistants sidebar */}
        <div className="flex flex-col gap-3">
          <Card padding="md">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--slate)] mb-3">
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
                    style={{
                      color: isActive ? a.color : undefined,
                      borderLeftColor: isActive ? a.color : 'transparent',
                    }}
                  >
                    <a.Icon size={20} style={{ color: a.color }} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-[13px] font-semibold ${isActive ? '' : 'text-[var(--slate-light)]'}`}
                        style={isActive ? { color: a.color } : undefined}
                      >
                        {a.name}
                      </div>
                      <div className="text-[10px] text-[var(--slate)] truncate">{a.role}</div>
                    </div>
                    {isActive && (
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: a.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card padding="md">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--gold)] mb-2.5">
              Возможности AI
            </div>
            <div className="flex flex-col gap-1.5">
              {AI_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs text-[var(--slate-light)]">
                  <f.Icon size={14} className="text-[var(--gold)]" />
                  {f.text}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Chat panel */}
        <Card padding="none" className="flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-11 h-11 rounded-full border-2"
                style={{
                  background: `${activeAssistant.color}20`,
                  borderColor: `${activeAssistant.color}50`,
                }}
              >
                <activeAssistant.Icon size={20} style={{ color: activeAssistant.color }} />
              </div>
              <div>
                <div className="text-[15px] font-bold text-white">{activeAssistant.name}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--emerald)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--emerald)]" />
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
          <div className="flex gap-2 flex-wrap px-5 py-3 border-b border-[var(--border-subtle)]">
            {activeAssistant.quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => sendMessage(action)}
                className="quick-action-btn px-3 py-1.5 rounded-full text-xs border border-[var(--border-subtle)] bg-white/[0.04] text-[var(--slate-light)] transition-all duration-150 whitespace-nowrap hover:border-[var(--gold)] hover:text-[var(--gold)]"
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
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 mr-2 mt-0.5"
                      style={{ background: `${activeAssistant.color}20` }}
                    >
                      <activeAssistant.Icon size={16} style={{ color: activeAssistant.color }} />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dim)] text-[var(--bg)] rounded-[14px_14px_4px_14px] shadow-[0_4px_12px_rgba(201,169,110,0.3)]'
                        : 'bg-white/[0.07] text-white border border-[var(--border-subtle)] rounded-[14px_14px_14px_4px]'
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
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full"
                  style={{ background: `${activeAssistant.color}20` }}
                >
                  <activeAssistant.Icon size={16} style={{ color: activeAssistant.color }} />
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3 rounded-[14px_14px_14px_4px] bg-white/[0.07] border border-[var(--border-subtle)]">
                  <Loader2 size={16} className="animate-spin" style={{ color: activeAssistant.color }} />
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2.5 items-end px-5 py-4 border-t border-[var(--border-subtle)]">
            <input
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Написать ${activeAssistant.name.toLowerCase()}у\u2026 (Enter для отправки)`}
              disabled={processing}
              className="flex-1 bg-white/[0.06] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-[13px] text-white placeholder:text-[var(--slate)] outline-none transition-all duration-200 disabled:opacity-50 focus:border-[var(--gold)]/50 focus:ring-1 focus:ring-[var(--gold)]/20"
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5 mt-5">
        {FEATURES.map((f, i) => (
          <Card key={i} padding="md" className="text-center">
            <div className="flex justify-center mb-2.5">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)]">
                <f.Icon size={24} />
              </div>
            </div>
            <div className="text-sm font-bold text-white mb-1.5">{f.title}</div>
            <div className="text-xs text-[var(--slate)] leading-relaxed">{f.desc}</div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
