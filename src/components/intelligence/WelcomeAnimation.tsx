import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Brain } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiProactive } from '@/utils/api';
import { AI_SERVICES } from './AIServiceCards';
import { cn } from '@/lib/utils';

interface WelcomeFlowProps {
  onComplete: () => void;
}

const GRID_COLS = 5;

export function WelcomeAnimation({ onComplete }: WelcomeFlowProps) {
  const { user, clinic } = useAuth();
  const [phase, setPhase] = useState(0);
  const [greetingText, setGreetingText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [proactiveText, setProactiveText] = useState('');
  const [fetched, setFetched] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [transformStart, setTransformStart] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const typingRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const clearTyping = () => { if (typingRef.current) { clearTimeout(typingRef.current); typingRef.current = null; } };

  const h = new Date().getHours();
  const timeWord = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = user?.name?.split(' ')[0] || user?.login || '';
  const roleLabel = user?.spec || 'стоматолог';

  useEffect(() => {
    if (fetched) return;
    setFetched(true);
    aiProactive()
      .then(d => {
        if (d?.alerts?.length) {
          setProactiveText(d.alerts.slice(0, 4).map((a: any) => a.text).join('\n'));
        }
      })
      .catch(() => {});
  }, [fetched]);

  // Phase progression
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase === 1) {
      timerRef.current = setTimeout(() => setPhase(2), 1500);
      return clearTimer;
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 2) return;
    const proactive = proactiveText || '18 пациентов\nпервая запись через 30 минут\n2 лабораторные работы готовы\n1 пациент ожидает подтверждения';
    const fullText = `${timeWord}, ${roleLabel} ${name}.\n\nСегодня у вас:\n${proactive}\n\nЧем могу помочь?`;
    let i = 0;
    const type = () => {
      if (i <= fullText.length) {
        setGreetingText(fullText.slice(0, i));
        typingRef.current = setTimeout(type, 20 + Math.random() * 25);
        i++;
      } else {
        setTypingDone(true);
        timerRef.current = setTimeout(() => setPhase(3), 1000);
      }
    };
    const d = setTimeout(type, 400);
    return () => { clearTimeout(d); clearTyping(); clearTimer(); };
  }, [phase, timeWord, roleLabel, name, proactiveText]);

  useEffect(() => {
    if (phase !== 3) return;
    setCardVisible(true);
    timerRef.current = setTimeout(() => setPhase(4), 700);
    return clearTimer;
  }, [phase]);

  useEffect(() => {
    if (phase !== 4) return;
    setTransformStart(true);
    timerRef.current = setTimeout(() => {
      setPhase(5);
    }, 1300);
    return clearTimer;
  }, [phase]);

  useEffect(() => {
    if (phase !== 5) return;
    const t = setTimeout(() => onComplete(), 300);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const skip = () => {
    clearTimer(); clearTyping();
    sessionStorage.setItem('dv_welcomed', '1');
    onComplete();
  };

  // Calculate sidebar target positions for each card
  const sidebarTargets = useMemo(() => {
    const startX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    const startY = typeof window !== 'undefined' ? window.innerHeight / 2 + 100 : 300;
    return AI_SERVICES.map((_, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const sidebarItemHeight = 44;
      const sidebarY = 240 + row * 3 * sidebarItemHeight + col * sidebarItemHeight;
      return { x: -startX + 130, y: -startY + sidebarY };
    });
  }, []);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none transition-all duration-700',
        phase < 4 ? 'bg-[#0a0a12]' : 'bg-[#0a0a12]'
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/[0.04] via-transparent to-transparent pointer-events-none" />

      {/* Particles */}
      {phase < 3 && [...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.06, 0], x: [0, (i % 2 ? 1 : -1) * 40], y: [0, -50 - i * 15] }}
          transition={{ duration: 5 + i * 0.5, delay: 0.5 + i * 0.3, repeat: Infinity, repeatDelay: 3 + i }}
          className="absolute pointer-events-none"
          style={{ left: `${15 + i * 14}%`, top: `${30 + (i % 3) * 15}%` }}
        >
          <Sparkles size={10 + i * 2} className="text-dv-gold/20" />
        </motion.div>
      ))}

      {/* Skip */}
      <AnimatePresence>
        {phase < 5 && (
          <motion.button
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={skip}
            className="fixed top-5 right-5 z-50 px-4 py-2 rounded-full text-xs text-white/40 hover:text-white/80 border border-white/10 hover:border-white/30 transition-all bg-black/20 backdrop-blur-sm"
          >
            Пропустить →
          </motion.button>
        )}
      </AnimatePresence>

      {/* Phase 1: Logo */}
      <AnimatePresence mode="wait">
        {phase >= 1 && phase < 3 && (
          <motion.div
            key="logo"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            className="relative flex flex-col items-center gap-6 z-10"
          >
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute rounded-full border border-dv-gold/[0.06]" style={{ width: 260, height: 260 }}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                className="absolute rounded-full border border-dv-gold/[0.10]" style={{ width: 200, height: 200 }}
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute rounded-full border-t-2 border-dv-gold/[0.15]" style={{ width: 230, height: 230 }}
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.2 }}
                className="relative z-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-dv-gold/[0.12] to-dv-gold/[0.04] border border-dv-gold/[0.20] shadow-[0_0_60px_rgba(201,169,110,0.12)]"
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2" />
                  <path d="M12 11v7" />
                  <path d="M8 15h8" />
                  <path d="M18 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
                  <circle cx="18" cy="13" r="3" />
                  <path d="M18 16v3" />
                </svg>
              </motion.div>
            </div>
            {phase >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
                className="text-center"
              >
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">DentVision</h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-sm text-white/30">Intelligence</span>
                  <span className="w-1 h-1 rounded-full bg-dv-gold/50" />
                  <span className="text-sm text-white/20">{clinic?.name || 'Платформа'}</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2-3: Greeting */}
      <AnimatePresence>
        {phase >= 2 && phase < 4 && (
          <motion.div
            key="greeting"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-md mx-auto px-4 mt-8"
          >
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 backdrop-blur-sm shadow-xl">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-dv-gold/[0.12]">
                  <Brain size={16} className="text-dv-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-white/80">DentVision Intelligence</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-dv-gold/[0.15] text-dv-gold font-medium">AI</span>
                  </div>
                  <div className="space-y-1.5 whitespace-pre-wrap text-sm text-white/80 leading-relaxed">
                    {greetingText}
                    {!typingDone && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                        className="inline-block w-[2px] h-4 bg-dv-gold ml-0.5 align-text-bottom"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 3: Cards Grid */}
      <AnimatePresence>
        {cardVisible && !transformStart && (
          <motion.div
            key="cards"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="relative z-10 px-4 mt-8"
          >
            <div
              className="grid gap-3 mx-auto"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                maxWidth: GRID_COLS * 140 + (GRID_COLS - 1) * 12,
              }}
            >
              {AI_SERVICES.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.8, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{
                    type: 'spring', stiffness: 300, damping: 22,
                    delay: i * 0.04,
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/[0.06] bg-gradient-to-br transition-all"
                  style={{ background: `linear-gradient(135deg, ${s.color}12, ${s.color}06)` }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${s.color}18`, color: s.color }}>
                    {s.icon}
                  </div>
                  <span className="text-xs font-semibold text-white/90">{s.name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 4: Transform — cards fly to sidebar */}
      <AnimatePresence>
        {transformStart && phase < 5 && (
          <motion.div
            key="transform"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 pointer-events-none"
          >
            {AI_SERVICES.map((s, i) => {
              const col = i % GRID_COLS;
              const row = Math.floor(i / GRID_COLS);
              const cardW = 110;
              const cardH = 66;
              const gapX = 12;
              const gapY = 12;
              const gridW = GRID_COLS * cardW + (GRID_COLS - 1) * gapX;
              const gridStartX = -gridW / 2 + cardW / 2;
              const gridStartY = -40;
              const gridX = gridStartX + col * (cardW + gapX);
              const gridY = gridStartY + row * (cardH + gapY);

              const sidebarX = -window.innerWidth / 2 + 130;
              const sidebarItemH = 44;
              const sidebarY = 240 + i * sidebarItemH;

              return (
                <motion.div
                  key={s.id}
                  initial={{ x: gridX, y: gridY, scale: 1, opacity: 1 }}
                  animate={{
                    x: sidebarX,
                    y: sidebarY,
                    scale: 0.5,
                    opacity: 0.7,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 180,
                    damping: 24,
                    delay: i * 0.03,
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.04]"
                    style={{ background: `${s.color}10`, width: cardW }}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ color: s.color }}>
                      {s.icon}
                    </div>
                    <span className="text-xs font-medium text-white/80 truncate">{s.name}</span>
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
