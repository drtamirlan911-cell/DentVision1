import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiProactive } from '@/utils/api';
import { AI_SERVICES } from './AIServiceCards';

interface WelcomeAnimationProps {
  onComplete: () => void;
}

export function WelcomeAnimation({ onComplete }: WelcomeAnimationProps) {
  const { user, clinic } = useAuth();
  const [phase, setPhase] = useState(0);
  const [greetingLines, setGreetingLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);
  const [cardPhase, setCardPhase] = useState<'hidden' | 'ring' | 'sidebar'>('hidden');
  const [proactiveItems, setProactiveItems] = useState<string[]>([]);
  const [fetched, setFetched] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const typingRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const clearTyping = () => { if (typingRef.current) { clearTimeout(typingRef.current); typingRef.current = null; } };

  const h = new Date().getHours();
  const timeWord = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = user?.name?.split(' ')[0] || user?.login || '';
  const roleLabel = user?.spec || 'стоматолог';

  // Fetch real proactive data
  useEffect(() => {
    if (fetched) return;
    setFetched(true);
    aiProactive()
      .then(d => {
        if (d?.alerts?.length) {
          setProactiveItems(d.alerts.slice(0, 3).map((a: any) => a.text));
        }
      })
      .catch(() => {});
  }, [fetched]);

  // Phase progression
  useEffect(() => { const t = setTimeout(() => setPhase(1), 400); return () => clearTimeout(t); }, []);
  useEffect(() => { if (phase === 1) { timerRef.current = setTimeout(() => setPhase(2), 900); return clearTimer; } }, [phase]);
  useEffect(() => { if (phase === 2) { timerRef.current = setTimeout(() => setPhase(3), 600); return clearTimer; } }, [phase]);

  // Phase 3: typing
  useEffect(() => {
    if (phase !== 3) return;
    setTypingComplete(false);
    setGreetingLines([]);

    const ctx = proactiveItems.length
      ? `\n\n${proactiveItems.join(', ')}.`
      : '\n\nСегодня: 18 пациентов, первая запись через 30 мин, 2 лабораторные работы готовы.';

    const lines = [
      `${timeWord}, ${roleLabel} ${name}.`,
      ctx,
      'Чем могу помочь?',
    ];

    let li = 0, ci = 0;
    const type = () => {
      if (li >= lines.length) { setTypingComplete(true); timerRef.current = setTimeout(() => setPhase(4), 700); return; }
      const line = lines[li];
      if (ci <= line.length) {
        setCurrentLine(line.slice(0, ci));
        typingRef.current = setTimeout(type, 25 + Math.random() * 20);
        ci++;
      } else {
        setGreetingLines(prev => [...prev, line]);
        setCurrentLine('');
        li++; ci = 0;
        typingRef.current = setTimeout(type, 300);
      }
    };
    const d = setTimeout(type, 200);
    return () => { clearTimeout(d); clearTimer(); clearTyping(); };
  }, [phase, timeWord, roleLabel, name, proactiveItems]);

  // Phase 4: ring → sidebar
  useEffect(() => {
    if (phase !== 4) return;
    setCardPhase('ring');
    timerRef.current = setTimeout(() => setPhase(5), 1600);
    return clearTimer;
  }, [phase]);

  useEffect(() => {
    if (phase !== 5) return;
    setCardPhase('sidebar');
    timerRef.current = setTimeout(() => onComplete(), 1200);
    return clearTimer;
  }, [phase, onComplete]);

  const skip = () => {
    clearTimer(); clearTyping();
    sessionStorage.setItem('dv_welcomed', '1');
    onComplete();
  };

  const ringRadius = 190;
  const angles = AI_SERVICES.map((_, i) => (i / AI_SERVICES.length) * 2 * Math.PI - Math.PI / 2);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden select-none bg-[#0a0a12]"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/[0.04] via-transparent to-transparent pointer-events-none" />

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
        {phase >= 1 && (
          <motion.div
            key="content"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            className="relative flex flex-col items-center gap-6 z-10"
          >
            {/* Logo with rings */}
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
              {phase >= 2 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
                  className="absolute -top-1 -right-1 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-dv-gold shadow-lg"
                >
                  <Bot size={16} className="text-white" />
                </motion.div>
              )}
            </div>

            {/* Phase 2+: Title */}
            {phase >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
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

            {/* Phase 3: Chat greeting */}
            {phase === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full max-w-sm mx-auto"
              >
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 min-h-[120px] backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-dv-gold/[0.12]">
                      <Bot size={14} className="text-dv-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-white/80">DentVision Intelligence</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-dv-gold/[0.15] text-dv-gold font-medium">AI</span>
                      </div>
                      <div className="space-y-1.5">
                        {greetingLines.map((line, i) => (
                          <motion.p key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="text-sm text-white/80 leading-relaxed">
                            {line}
                          </motion.p>
                        ))}
                        {!typingComplete && (
                          <p className="text-sm text-white/80 leading-relaxed min-h-[20px]">
                            {currentLine}<motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.7, repeat: Infinity }} className="inline-block w-[2px] h-4 bg-dv-gold ml-0.5 align-text-bottom" />
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 4-5: Service cards ring → sidebar */}
      <AnimatePresence>
        {phase >= 4 && (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {AI_SERVICES.map((s, i) => {
              const angle = angles[i];
              const ringX = Math.cos(angle) * ringRadius;
              const ringY = Math.sin(angle) * ringRadius;
              const cols = 3;
              const sideX = -380 + (i % cols) * 110;
              const sideY = -120 + Math.floor(i / cols) * 100;

              return (
                <motion.div
                  key={s.id}
                  initial={false}
                  animate={
                    cardPhase === 'ring'
                      ? { x: ringX, y: ringY, scale: 1, opacity: 1 }
                      : { x: sideX, y: sideY, scale: 0.35, opacity: 0.6 }
                  }
                  transition={{
                    type: 'spring',
                    stiffness: cardPhase === 'ring' ? 120 : 200,
                    damping: cardPhase === 'ring' ? 18 : 22,
                    delay: cardPhase === 'ring' ? i * 0.05 : (AI_SERVICES.length - i) * 0.02,
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                >
                  <div
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-300 bg-gradient-to-br"
                    style={{
                      borderColor: cardPhase === 'ring' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                      backgroundImage: cardPhase === 'ring' ? undefined : undefined,
                      width: cardPhase === 'ring' ? 110 : 100,
                    }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${s.color}18`, color: s.color }}>
                      {s.icon}
                    </div>
                    <span className="text-xs font-semibold text-white text-center leading-tight">{s.name}</span>
                    {cardPhase === 'ring' && (
                      <span className="text-[9px] text-white/40 text-center leading-tight">{s.description}</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particles */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.08, 0], x: [0, (i % 2 ? 1 : -1) * 30], y: [0, -40 - i * 15] }}
          transition={{ duration: 4 + i * 0.5, delay: 0.5 + i * 0.3, repeat: Infinity, repeatDelay: 3 + i }}
          className="absolute pointer-events-none"
          style={{ left: `${20 + i * 12}%`, top: `${35 + (i % 3) * 12}%` }}
        >
          <Sparkles size={10 + i * 2} className="text-dv-gold/20" />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default WelcomeAnimation;
