import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Badge, Toast, Input } from '../components/ui/BaseComponents';
import { T } from '../utils/constants';

const ASSISTANTS = [
  {
    id: 'consultant',
    name: 'Консультант',
    icon: '💬',
    color: T.sapphire,
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
    icon: '📅',
    color: T.emerald,
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
    icon: '📊',
    color: T.purple,
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
    icon: '📣',
    color: T.pink,
    role: 'Продвижение и работа с отзывами',
    quickActions: ['Статистика рекламы', 'Предложения по акциям', 'Работа с отзывами', 'Контент-план'],
    replies: [
      'Лучший канал: рекомендации (+32 пациента). Instagram приносит +24. Предлагаю увеличить бюджет на Instagram на 20%.',
      'Рекомендую запустить акцию «Чистка + консультация = 15 000 ₸». Прогнозируем +15 пациентов.',
      'Выявлено 3 негативных отзыва на Google. Рекомендую ответить в течение 24 часов — это повышает рейтинг.',
    ],
  },
];

export default function AITeam({ clinic }) {
  const { toast, showToast, clearToast } = useToast();
  const [activeId, setActiveId] = useState('consultant');
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Здравствуйте! Я AI-ассистент DentVision. Готов помочь автоматизировать вашу клинику. Чем могу помочь?' }
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

    const delay = 800 + Math.random() * 600;
    setTimeout(() => {
      const replies = activeAssistant.replies;
      const reply = replies[Math.floor(Math.random() * replies.length)];
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
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>AI Команда</h1>
        <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>Виртуальные ассистенты для автоматизации клиники</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 18 }} className="grid-2">
        {/* Assistants panel */}
        <div>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Выберите ассистента
            </div>
            {ASSISTANTS.map(a => (
              <button
                key={a.id}
                onClick={() => switchAssistant(a.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  marginBottom: 4, transition: 'all .12s', textAlign: 'left',
                  background: activeId === a.id ? `${a.color}18` : 'transparent',
                  borderLeft: `3px solid ${activeId === a.id ? a.color : 'transparent'}`,
                }}
              >
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: activeId === a.id ? a.color : T.slateL }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: T.slate }}>{a.role}</div>
                </div>
                {activeId === a.id && (
                  <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: a.color }} />
                )}
              </button>
            ))}
          </Card>

          <Card>
            <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Возможности AI
            </div>
            {[
              { icon: '🤖', text: 'Автоответы 24/7' },
              { icon: '📅', text: 'Умное расписание' },
              { icon: '📈', text: 'Прогнозы доходов' },
              { icon: '💬', text: 'WhatsApp-рассылки' },
              { icon: '🎯', text: 'Персонализация' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: T.slateL }}>
                <span>{f.icon}</span>{f.text}
              </div>
            ))}
          </Card>
        </div>

        {/* Chat panel */}
        <Card style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          {/* Chat header */}
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${T.borderSub}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `${activeAssistant.color}20`, border: `2px solid ${activeAssistant.color}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                {activeAssistant.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.white }}>{activeAssistant.name}</div>
                <div style={{ fontSize: 11, color: T.emerald, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.emerald }} />
                  Онлайн · {activeAssistant.role}
                </div>
              </div>
            </div>
            <GBtn size="sm" onClick={() => setChatHistory([{ role: 'assistant', content: `Привет! Я ${activeAssistant.name}. Чем могу помочь?` }])}>
              🗑 Очистить
            </GBtn>
          </div>

          {/* Quick actions */}
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.borderSub}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {activeAssistant.quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => sendMessage(action)}
                style={{
                  padding: '5px 12px', borderRadius: 20, border: `1px solid ${T.borderSub}`,
                  background: 'rgba(255,255,255,0.04)', color: T.slateL, fontSize: 12,
                  cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.target.style.borderColor = activeAssistant.color; e.target.style.color = activeAssistant.color; }}
                onMouseLeave={e => { e.target.style.borderColor = T.borderSub; e.target.style.color = T.slateL; }}
              >
                {action}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px',
            display: 'flex', flexDirection: 'column', gap: 16,
            maxHeight: 420,
          }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', minWidth: 32,
                    background: `${activeAssistant.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, marginRight: 8, marginTop: 2,
                  }}>
                    {activeAssistant.icon}
                  </div>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: msg.role === 'user'
                    ? `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`
                    : 'rgba(255,255,255,0.07)',
                  color: msg.role === 'user' ? T.bg : T.white,
                  boxShadow: msg.role === 'user' ? `0 4px 12px ${T.gold}30` : 'none',
                  border: msg.role === 'assistant' ? `1px solid ${T.borderSub}` : 'none',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {processing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `${activeAssistant.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {activeAssistant.icon}
                </div>
                <div style={{
                  padding: '12px 16px', borderRadius: '14px 14px 14px 4px',
                  background: 'rgba(255,255,255,0.07)', border: `1px solid ${T.borderSub}`,
                  display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: activeAssistant.color,
                      animation: `pulse 1.2s ${delay}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '16px 20px', borderTop: `1px solid ${T.borderSub}`,
            display: 'flex', gap: 10, alignItems: 'flex-end',
          }}>
            <div style={{ flex: 1 }}>
              <input
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Написать ${activeAssistant.name.toLowerCase()}у… (Enter для отправки)`}
                disabled={processing}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${T.border}`, borderRadius: 10,
                  padding: '11px 14px', fontSize: 13, color: T.white,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  opacity: processing ? 0.5 : 1,
                }}
              />
            </div>
            <PBtn
              onClick={() => sendMessage()}
              disabled={processing || !userInput.trim()}
              style={{ flexShrink: 0 }}
            >
              {processing ? '⏳' : '▶ Отправить'}
            </PBtn>
          </div>
        </Card>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 20 }}>
        {[
          { icon: '🤖', title: 'Автоответы',     desc: 'Мгновенные ответы на вопросы пациентов 24/7' },
          { icon: '📅', title: 'Умное расписание', desc: 'Автозаполнение окон в расписании' },
          { icon: '📈', title: 'Прогнозы',        desc: 'Предсказание загрузки и доходов клиники' },
          { icon: '🎯', title: 'Персонализация',  desc: 'Индивидуальные предложения для каждого пациента' },
        ].map((f, i) => (
          <Card key={i} style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: T.slate, lineHeight: 1.5 }}>{f.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
