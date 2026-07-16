import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiGreeting, aiProactive } from '@/utils/api';
import { AI_SERVICES, type ServiceCardDef } from './AIServiceCards';

interface WelcomeAnimationProps {
  onComplete: () => void;
}

export function WelcomeAnimation({ onComplete }: WelcomeAnimationProps) {
  const { user, clinic, isAuthenticated } = useAuth();
  const [phase, setPhase] = useState(0);
  const [greetingLines, setGreetingLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [typingCharIndex, setTypingCharIndex] = useState(0);
  const [typingComplete, setTypingComplete] = useState(false);
  const [cardPhase, setCardPhase] = useState<'hidden' | 'ring' | 'sidebar'>('hidden');
  const [proactiveAlerts, setProactiveAlerts] = useState<any[]>([]);
  const [showSkip, setShowSkip] = useState(false);
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const h = new Date().getHours();
  const timeWord = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = user?.name?.split(' ')[0] || user?.login || '';
  const roleLabel = user?.spec || 'стоматолог';

  const greetingMessages = [
    `${timeWord}, ${roleLabel} ${name}.`,
    `Сегодня у вас: 18 пациентов, первая запись через 30 минут.`,
    `2 лабораторные работы готовы, 1 пациент ожидает подтверждения.`,
    `Чем могу помочь?`,
  ];

  const loadData = useCallback(async () => {
    try {
      const [greeting, proactive] = await Promise.all([
        aiGreeting().catch(() => null),
        aiProactive().catch(() => ({ alerts: [] })),
      ]);
      if (greeting?.greeting) {
        greetingMessages[0] = greeting.greeting;
      }
      if (proactive?.alerts?.length) {
        setProactiveAlerts(proactive.alerts.slice(0, 3));
      }
    } catch {}
  }, []);

  const clearPhaseTimer = () => {
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  };

  const clearTypingTimer = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  const setPhaseTimed = (newPhase: number, delay: number) => {
    clearPhaseTimer();
    phaseTimerRef.current = setTimeout(() => setPhase(newPhase), delay);
  };

  // Phase 0 → 1: Logo appears after load
  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
    setShowSkip(true);
    const t = setTimeout(() => setPhase(1), 400);
    return () => clearTimeout(t);
  }, [isAuthenticated, loadData]);

  // Phase 1 → 2: Title appears
  useEffect(() => {
    if (phase !== 1) return;
    setPhaseTimed(2, 800);
  }, [phase]);

  // Phase 2 → 3: AI greeting typing
  useEffect(() => {
    if (phase !== 2) return;
    setPhaseTimed(3, 500);
  }, [phase]);

  // Phase 3: Typing animation
  useEffect(() => {
    if (phase !== 3) return;

    setTypingComplete(false);
    setGreetingLines([]);
    setLineIndex(0);
    setTypingCharIndex(0);

    const typeLine = (lineIdx: number, charIdx: number) => {
      if (lineIdx >= greetingMessages.length) {
        setTypingComplete(true);
        setPhaseTimed(4, 800);
        return;
      }

      const line = greetingMessages[lineIdx];
      if (charIdx <= line.length) {
        setCurrentLine(line.slice(0, charIdx));
        typingTimerRef.current = setTimeout(() => typeLine(lineIdx, charIdx + 1), 28 + Math.random() * 18);
      } else {
        setGreetingLines(prev => [...prev, line]);
        setCurrentLine('');
        setLineIndex(lineIdx + 1);
        typingTimerRef.current = setTimeout(() => typeLine(lineIdx + 1, 0), 350);
      }
    };

    const startDelay = setTimeout(() => typeLine(0, 0), 300);
    return () => {
      clearTimeout(startDelay);
      clearTypingTimer();
    };
  }, [phase]);

  // Phase 3 typing animation for current line
  useEffect(() => {
    if (phase !== 3) return;
    // handled in the typeLine recursive function above
  }, [phase]);

  // Phase 4: Service cards ring appears
  useEffect(() => {
    if (phase !== 4) return;
    setCardPhase('ring');
    setPhaseTimed(5, 2000);
  }, [phase]);

  // Phase 5: Cards transform to sidebar
  useEffect(() => {
    if (phase !== 5) return;
    setCardPhase('sidebar');
    phaseTimerRef.current = setTimeout(() => {
      sessionStorage.setItem('dv_welcomed', '1');
      onComplete();
    }, 1800);
    return () => clearPhaseTimer();
  }, [phase, onComplete]);

  const skip = () => {
    clearPhaseTimer();
    clearTypingTimer();
    sessionStorage.setItem('dv_welcomed', '1');
    onComplete();
  };

  // Card ring animation
  const ringRadius = 200;
  const ringAngles = AI_SERVICES.map((_, i) => (i / AI_SERVICES.length) * 2 * Math.PI - Math.PI / 2);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #111122 0%, #0a0a12 100%)' }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/5 via-transparent to-transparent pointer-events-none" />

      {/* Skip button */}
      <AnimatePresence>
        {showSkip && phase < 5 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={skip}
            className="fixed top-5 right-5 z-50 px-4 py-2 rounded-full text-xs text-white/40 hover:text-white/80 border border-white/10 hover:border-white/30 transition-all bg-black/20 backdrop-blur-sm"
          >
            Пропустить →
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="relative flex flex-col items-center justify-center gap-6 z-10">
        {/* PHASE 1+: Logo */}
        <AnimatePresence mode="wait">
          {phase >= 1 && (
            <motion.div
              key="logo-section"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 16 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Logo with orbiting rings */}
              <div className="relative flex items-center justify-center">
                {/* Outer rings */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute rounded-full border border-dv-gold/8"
                  style={{ width: 280, height: 280 }}
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                  className="absolute rounded-full border border-dv-gold/12"
                  style={{ width: 220, height: 220 }}
                />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                  className="absolute rounded-full border-t-2 border-dv-gold/20"
                  style={{ width: 250, height: 250 }}
                />

                {/* Logo icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.2 }}
                  className="relative z-10 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-dv-gold/15 to-dv-gold/5 border border-dv-gold/25 shadow-[0_0_60px_rgba(201,169,110,0.15)]"
                >
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2" />
                    <path d="M12 11v7" />
                    <path d="M8 15h8" />
                    <path d="M18 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
                    <circle cx="18" cy="13" r="3" />
                    <path d="M18 16v3" />
                  </svg>
                </motion.div>

                {/* AI badge */}
                {phase >= 2 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
                    className="absolute -top-1 -right-1 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-dv-gold shadow-lg"
                  >
                    <Bot size={18} className="text-white" />
                  </motion.div>
                )}
              </div>

              {/* PHASE 2+: Title */}
              {phase >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                  className="text-center"
                >
                  <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">DentVision</h1>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-sm text-white/30">Intelligence</span>
                    <span className="w-1 h-1 rounded-full bg-dv-gold/50" />
                    <span className="text-sm text-white/20">{clinic?.name || 'Платформа'}</span>
                  </div>
                </motion.div>
              )}

              {/* PHASE 3+: AI Greeting Chat Box */}
              {phase >= 3 && phase < 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
                  className="w-full max-w-md mx-auto"
                >
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[140px] backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-dv-gold/15">
                        <Bot size={16} className="text-dv-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-white/80">DentVision Intelligence</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-dv-gold/20 text-dv-gold font-medium">AI</span>
                        </div>
                        <div className="space-y-1.5">
                          {greetingLines.map((line, i) => (
                            <motion.p
                              key={i}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-sm text-white/80 leading-relaxed"
                            >
                              {line}
                            </motion.p>
                          ))}
                          {!typingComplete && (
                            <p className="text-sm text-white/80 leading-relaxed min-h-[20px]">
                              {currentLine}
                              <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ duration: 0.7, repeat: Infinity }}
                                className="inline-block w-[2px] h-4 bg-dv-gold ml-0.5 align-text-bottom"
                              />
                            </p>
                          )}
                          {typingComplete && (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 }}
                              className="text-sm text-white/80 leading-relaxed"
                            >
                              {greetingMessages[greetingMessages.length - 1]}
                            </motion.p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Proactive mini-alerts */}
                  {proactiveAlerts.length > 0 && typingComplete && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex flex-wrap gap-1.5 mt-3 justify-center"
                    >
                      {proactiveAlerts.map((alert, i) => (
                        <motion.span
                          key={i}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4 + i * 0.1 }}
                          className="px-2.5 py-1 rounded-full text-[10px] bg-white/5 border border-white/10 text-white/50"
                        >
                          {alert.text}
                        </motion.span>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Clinic badge */}
              {phase >= 3 && clinic && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="flex items-center gap-1.5 text-xs text-white/25"
                >
                  <Shield size={10} />
                  {clinic.name}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PHASE 4-5: Service Cards Ring / Sidebar */}
      <AnimatePresence>
        {(phase >= 4) && (
          <motion.div
            key="service-cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {AI_SERVICES.map((service, i) => {
              const isRing = cardPhase === 'ring';
              const isSidebar = cardPhase === 'sidebar';

              // Ring position
              const angle = ringAngles[i];
              const rx = Math.cos(angle) * ringRadius;
              const ry = Math.sin(angle) * ringRadius;

              // Sidebar final position (staggered grid on left)
              const cols = 3;
              const col = i % cols;
              const row = Math.floor(i / cols);
              const sx = -380 + col * 110;
              const sy = -120 + row * 100;

              return (
                <motion.div
                  key={service.id}
                  initial={false}
                  animate={
                    isRing
                      ? { x: rx, y: ry, scale: 1, opacity: 1 }
                      : isSidebar
                        ? { x: sx, y: sy, scale: 0.4, opacity: 0.7 }
                        : { x: 0, y: 0, scale: 0, opacity: 0 }
                  }
                  transition={{
                    type: 'spring',
                    stiffness: isRing ? 120 : 200,
                    damping: isRing ? 18 : 22,
                    delay: isRing ? i * 0.05 : (AI_SERVICES.length - i) * 0.03,
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                >
                  <motion.div
                    whileHover={isRing ? { scale: 1.05, y: -4 } : undefined}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-300',
                      'bg-gradient-to-br',
                      service.gradient,
                      isRing ? 'border-white/10 hover:border-white/30 w-28 hover:shadow-xl hover:shadow-black/20' : 'border-white/5 w-24'
                    )}
                    style={{
                      background: isSidebar
                        ? undefined
                        : undefined,
                    }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200"
                      style={{ background: `${service.color}20`, color: service.color }}
                    >
                      {service.icon}
                    </div>
                    <span className="text-xs font-semibold text-white text-center leading-tight">{service.name}</span>
                    {isRing && (
                      <span className="text-[9px] text-white/40 text-center leading-tight">{service.description}</span>
                    )}
                  </motion.div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.1, 0],
            x: [0, (i % 2 ? 1 : -1) * 40],
            y: [0, -60 - i * 20],
          }}
          transition={{
            duration: 5 + i * 0.5,
            delay: 0.5 + i * 0.4,
            repeat: Infinity,
            repeatDelay: 3 + i,
          }}
          className="absolute pointer-events-none"
          style={{ left: `${18 + i * 12}%`, top: `${40 + (i % 3) * 10}%` }}
        >
          <Sparkles size={12 + i * 2} className="text-dv-gold/30" />
        </motion.div>
      ))}
    </motion.div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default WelcomeAnimation;
