import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { aiProactive } from '@/utils/api';

interface WelcomeScreenProps {
  onComplete: () => void;
}

interface CardData {
  id: string;
  name: string;
  description: string;
  event: string;
  icon: React.ReactNode;
  color: string;
  angle: number;
  radius: number;
}

const StethoscopeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2" /><path d="M12 11v7" /><path d="M8 15h8" />
    <path d="M18 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" /><circle cx="18" cy="13" r="3" /><path d="M18 16v3" />
  </svg>
);

const ShoppingCartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const GraduationCapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.1 2.2 2 6 2s6-.9 6-2v-5" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><path d="M8 12h8" /><path d="M8 16h6" />
  </svg>
);

const BarChart3Icon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" /><path d="M2 20h20" />
  </svg>
);

const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const CARD_DEFS: CardData[] = [
  { id: 'school', name: 'Academy', description: 'Обучение и вебинары', event: '2 новых курса', icon: <GraduationCapIcon />, color: '#16A085', angle: -90, radius: 200 },
  { id: 'crm', name: 'CRM', description: 'Пациенты и расписание', event: '18 пациентов сегодня', icon: <StethoscopeIcon />, color: '#C9A96E', angle: 160, radius: 200 },
  { id: 'shop', name: 'Shop', description: 'Маркетплейс товаров', event: '15 новых товаров', icon: <ShoppingCartIcon />, color: '#8E44AD', angle: 20, radius: 200 },
  { id: 'jobs', name: 'Jobs', description: 'Поиск сотрудников', event: '3 вакансии', icon: <BriefcaseIcon />, color: '#E67E22', angle: -140, radius: 200 },
  { id: 'analytics', name: 'Analytics', description: 'Отчёты и метрики', event: 'Отчет готов', icon: <BarChart3Icon />, color: '#F39C12', angle: -40, radius: 200 },
  { id: 'community', name: 'Community', description: 'Сообщество', event: '12 в сети', icon: <UsersIcon />, color: '#00BCD4', angle: -90, radius: 310 },
  { id: 'profile', name: 'Profile', description: 'Ваш профиль', event: '', icon: <UserIcon />, color: '#5DADE2', angle: -90, radius: 390 },
];

export function WelcomeAnimation({ onComplete }: WelcomeScreenProps) {
  const { user, clinic } = useAuth();
  const [phase, setPhase] = useState(0);
  const [stats, setStats] = useState<string[]>([]);
  const [dataReady, setDataReady] = useState(false);

  // Greeting typing state
  const [greetingLines, setGreetingLines] = useState<string[]>([]);
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [typingLine, setTypingLine] = useState('');
  const [greetingFullyDone, setGreetingFullyDone] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  const [cardsVisible, setCardsVisible] = useState(false);
  const [transform, setTransform] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const typingRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (typingRef.current) { clearTimeout(typingRef.current); typingRef.current = null; }
  };

  // Fetch real data
  useEffect(() => {
    aiProactive()
      .then(d => {
        if (d?.alerts?.length) {
          setStats(d.alerts.slice(0, 5).map((a: any) => a.text));
        }
      })
      .catch(() => {})
      .finally(() => setDataReady(true));
  }, []);

  // Phase 0: empty screen with logo
  useEffect(() => { const t = setTimeout(() => setPhase(1), 200); return () => clearTimeout(t); }, []);

  // Phase 1: rings appear around logo
  useEffect(() => {
    if (phase !== 1) return;
    timerRef.current = setTimeout(() => setPhase(2), 1000);
    return clearAllTimers;
  }, [phase]);

  // Phase 2: logo shrinks up, digital intelligence area types out greeting
  useEffect(() => {
    if (phase !== 2 || !dataReady) return;

    const h = new Date().getHours();
    const timeWord = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const name = user?.name?.split(' ')[0] || user?.login || '';
    const roleLabel = user?.spec || 'доктор';

    const dataLines = stats.length ? stats : ['18 пациентов', '2 лабораторные работы готовы', '1 пациент ожидает подтверждения'];

    const lines: string[] = [
      `${timeWord}, ${roleLabel} ${name}.`,
      ...dataLines,
      'Чем помочь?',
    ];

    setGreetingLines(lines);
    setVisibleLineCount(0);
    setTypingLine('');
    setGreetingFullyDone(false);
    setShowCursor(true);

    let lineIdx = 0;
    let charIdx = 0;
    let currentLine = lines[0] || '';

    const typeChar = () => {
      if (lineIdx >= lines.length) {
        setGreetingFullyDone(true);
        clearAllTimers();
        // Pause then proceed to cards
        timerRef.current = setTimeout(() => setPhase(3), 1500);
        return;
      }

      if (charIdx <= currentLine.length) {
        setTypingLine(currentLine.slice(0, charIdx));
        typingRef.current = setTimeout(typeChar, 18 + Math.random() * 25);
        charIdx++;
      } else {
        // Line complete
        setVisibleLineCount(lineIdx + 1);
        setTypingLine('');
        lineIdx++;
        charIdx = 0;
        currentLine = lines[lineIdx] || '';
        typingRef.current = setTimeout(typeChar, 350 + Math.random() * 150);
      }
    };

    const startDelay = setTimeout(typeChar, 600);
    return () => { clearTimeout(startDelay); clearAllTimers(); };
  }, [phase, dataReady, stats, user]);

  // Phase 3: cards appear around AI
  useEffect(() => {
    if (phase !== 3) return;
    setCardsVisible(true);
    timerRef.current = setTimeout(() => setPhase(4), 2500);
    return clearAllTimers;
  }, [phase]);

  // Phase 4: cards transform to sidebar
  useEffect(() => {
    if (phase !== 4) return;
    setTransform(true);
    timerRef.current = setTimeout(() => setPhase(5), 1500);
    return clearAllTimers;
  }, [phase]);

  // Phase 5: done
  useEffect(() => {
    if (phase !== 5) return;
    const t = setTimeout(() => onComplete(), 300);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const skip = () => {
    clearAllTimers();
    sessionStorage.setItem('dv_welcomed', '1');
    onComplete();
  };

  // Logo position: centered (phase 0-1), top area (phase 2+)
  const logoCentered = phase <= 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-hidden select-none bg-[#0a0a12]"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* Skip */}
      {phase < 5 && (
        <button onClick={skip} className="fixed top-5 right-5 z-50 px-4 py-2 rounded-full text-xs text-white/30 hover:text-white/70 border border-white/[0.06] hover:border-white/20 transition-all bg-black/20 backdrop-blur-sm">
          Пропустить →
        </button>
      )}

      {/* LOGO — centered -> top */}
      <motion.div
        initial={false}
        animate={
          logoCentered
            ? { scale: 1, y: 0 }
            : { scale: 0.45, y: -200 }
        }
        transition={{ type: 'spring', stiffness: 160, damping: 16 }}
        className={`absolute z-10 flex flex-col items-center ${logoCentered ? 'top-1/2 -translate-y-1/2' : 'top-[12%]'}`}
      >
        {phase >= 1 && (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} className="absolute rounded-full border border-dv-gold/[0.05] pointer-events-none" style={{ width: 130, height: 130 }} />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} className="absolute rounded-full border-t border-dv-gold/[0.10] pointer-events-none" style={{ width: 100, height: 100 }} />
          </>
        )}
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/[0.10] to-dv-gold/[0.03] border border-dv-gold/[0.18] shadow-[0_0_40px_rgba(201,169,110,0.08)]"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2" /><path d="M12 11v7" /><path d="M8 15h8" />
            <path d="M18 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" /><circle cx="18" cy="13" r="3" /><path d="M18 16v3" />
          </svg>
        </motion.div>
        {phase >= 1 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="mt-2 text-[10px] text-white/20 tracking-widest uppercase">
            DentVision Intelligence
          </motion.p>
        )}
      </motion.div>

      {/* PHASE 2: DIGITAL INTELLIGENCE AREA — large, not a chat, not a window */}
      <AnimatePresence>
        {phase === 2 && (
          <motion.div
            key="intelligence"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="absolute z-20 w-full max-w-2xl mx-auto px-8"
            style={{ top: '32%' }}
          >
            <div className="relative">
              {/* Background glow */}
              <div className="absolute -inset-8 bg-dv-gold/[0.015] blur-3xl rounded-3xl pointer-events-none" />

              {/* Lines */}
              <div className="relative min-h-[260px]">
                {greetingLines.slice(0, visibleLineCount).map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="mb-3"
                  >
                    {i === 0 ? (
                      <p className="text-2xl md:text-3xl font-light text-white/90 tracking-wide">{line}</p>
                    ) : i === greetingLines.length - 1 ? (
                      <p className="text-xl md:text-2xl text-dv-gold/80 mt-5 font-light">{line}</p>
                    ) : (
                      <div className="flex items-start gap-3">
                        <span className="text-dv-gold/30 mt-2 shrink-0">
                          <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                        </span>
                        <p className="text-lg md:text-xl text-white/50 font-light tracking-wide">{line}</p>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Currently typing line */}
                {!greetingFullyDone && visibleLineCount < greetingLines.length && (
                  <p className="text-lg md:text-xl text-white/50 font-light tracking-wide mb-3 min-h-[28px]">
                    {typingLine}
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                      className="inline-block w-[2px] h-5 bg-dv-gold/70 ml-0.5 align-text-bottom"
                    />
                  </p>
                )}

                {/* Blinking cursor after done */}
                {greetingFullyDone && showCursor && (
                  <motion.div
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                    className="inline-block w-[2px] h-6 bg-dv-gold/50 mt-2"
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHASE 3: CARDS AROUND AI */}
      <AnimatePresence>
        {cardsVisible && !transform && (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-15 flex items-center justify-center"
          >
            {CARD_DEFS.map((card) => {
              const rad = (card.angle * Math.PI) / 180;
              const x = Math.cos(rad) * card.radius;
              const y = Math.sin(rad) * card.radius;

              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
                  animate={{ opacity: 1, scale: 1, x, y, transition: { type: 'spring', stiffness: 200, damping: 20, delay: CARD_DEFS.indexOf(card) * 0.1 } }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  className="absolute"
                  style={{ transform: 'translate(-50%, -50%)' }}
                >
                  <div
                    className="group relative overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-300"
                    style={{
                      width: 190,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
                    <div className="relative p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${card.color}18`, color: card.color }}>
                          {card.icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white/90">{card.name}</h3>
                          <p className="text-[10px] text-white/40">{card.description}</p>
                        </div>
                      </div>

                      {/* Event badge */}
                      {card.event && (
                        <div
                          className="text-xs font-medium px-2.5 py-1 rounded-lg inline-block"
                          style={{ background: `${card.color}12`, color: card.color }}
                        >
                          {card.event}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PHASE 4: TRANSFORM TO SIDEBAR */}
      <AnimatePresence>
        {transform && phase < 5 && (
          <motion.div
            key="transform"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 pointer-events-none"
          >
            {CARD_DEFS.map((card, i) => {
              const rad = (card.angle * Math.PI) / 180;
              const startX = Math.cos(rad) * card.radius;
              const startY = Math.sin(rad) * card.radius;
              const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
              const sidebarX = -winW / 2 + 110;
              const sidebarY = 180 + i * 48;

              return (
                <motion.div
                  key={card.id}
                  initial={{ x: startX, y: startY, scale: 1, opacity: 1 }}
                  animate={{ x: sidebarX, y: sidebarY, scale: 0.45, opacity: 0.6 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20, delay: i * 0.04 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ width: 170, background: `${card.color}08`, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ color: card.color }}>
                      {card.icon}
                    </div>
                    <span className="text-xs font-medium text-white/70 truncate">{card.name}</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default WelcomeAnimation;
