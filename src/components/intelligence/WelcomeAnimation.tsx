import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { aiProactive } from '@/utils/api';

interface WelcomeScreenProps {
  onComplete: () => void;
}

type LineItem = { text: string; delay: number };

export function WelcomeAnimation({ onComplete }: WelcomeScreenProps) {
  const { user, clinic } = useAuth();
  const [phase, setPhase] = useState(0);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [visibleLines, setVisibleLines] = useState(0);
  const [dataReady, setDataReady] = useState(false);
  const [stats, setStats] = useState<string[]>([]);
  const [cursorVisible, setCursorVisible] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    aiProactive()
      .then(d => {
        if (d?.alerts?.length) {
          setStats(d.alerts.slice(0, 4).map((a: any) => a.text));
        }
      })
      .catch(() => {})
      .finally(() => setDataReady(true));
  }, []);

  // Phase 0: empty screen (immediate)
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 200);
    return () => clearTimeout(t);
  }, []);

  // Phase 1 → 2: logo pause → move up
  useEffect(() => {
    if (phase !== 1) return;
    timerRef.current = setTimeout(() => setPhase(2), 1200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase]);

  // Phase 2: build greeting lines when data is ready
  useEffect(() => {
    if (phase !== 2) return;
    if (!dataReady) return;

    const h = new Date().getHours();
    const timeWord = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const name = user?.name?.split(' ')[0] || user?.login || '';
    const roleLabel = user?.spec || 'стоматолог';

    const dataLines = stats.length
      ? stats
      : ['18 пациентов', '2 лабораторные работы', '1 новая запись'];

    const allLines: LineItem[] = [
      { text: `${timeWord}.`, delay: 400 },
      ...dataLines.map((s, i) => ({ text: s, delay: 1200 + i * 800 })),
      { text: 'Чем помочь?', delay: 1200 + dataLines.length * 800 + 600 },
    ];

    setLines(allLines);
    setVisibleLines(0);
    setCursorVisible(true);

    allLines.forEach((_, i) => {
      setTimeout(() => setVisibleLines(i + 1), allLines[i].delay);
    });

    const lastDelay = allLines[allLines.length - 1].delay + 2000;
    timerRef.current = setTimeout(() => {
      setCursorVisible(false);
      setTimeout(() => onComplete(), 1000);
    }, lastDelay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, dataReady, stats, user, onComplete]);

  const skip = () => {
    sessionStorage.setItem('dv_welcomed', '1');
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none bg-[#0a0a12]"
    >
      {/* Subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/[0.03] via-transparent to-transparent pointer-events-none" />

      {/* Skip */}
      <button
        onClick={skip}
        className="fixed top-5 right-5 z-50 px-4 py-2 rounded-full text-xs text-white/30 hover:text-white/70 border border-white/[0.06] hover:border-white/20 transition-all bg-black/20 backdrop-blur-sm"
      >
        Пропустить →
      </button>

      {/* Logo — always centered in phase 0, shifts up in phase 2+ */}
      <motion.div
        initial={false}
        animate={
          phase === 0
            ? { scale: 1, y: 0 }
            : phase === 1
            ? { scale: 1, y: 0 }
            : { scale: 0.5, y: -160 }
        }
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Rings */}
        {phase >= 1 && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
              className="absolute rounded-full border border-dv-gold/[0.05] pointer-events-none"
              style={{ width: 140, height: 140 }}
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="absolute rounded-full border-t border-dv-gold/[0.10] pointer-events-none"
              style={{ width: 110, height: 110 }}
            />
          </>
        )}

        {/* Logo icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
          className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-dv-gold/[0.10] to-dv-gold/[0.03] border border-dv-gold/[0.18] shadow-[0_0_40px_rgba(201,169,110,0.08)]"
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v2" />
            <path d="M12 11v7" />
            <path d="M8 15h8" />
            <path d="M18 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
            <circle cx="18" cy="13" r="3" />
            <path d="M18 16v3" />
          </svg>
        </motion.div>

        {/* "DentVision" text */}
        <AnimatePresence>
          {phase >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-3 text-center"
            >
              <h1 className="text-lg font-bold text-white/90 tracking-tight">DentVision</h1>
              <p className="text-[10px] text-white/20 tracking-widest uppercase">Intelligence</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* AI Intelligence area — appears below logo in phase 2 */}
      <AnimatePresence>
        {phase >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative z-10 mt-12 w-full max-w-lg mx-auto px-6"
          >
            {/* Large intelligence area — not a chat window */}
            <div className="relative">
              {/* Subtle background glow */}
              <div className="absolute -inset-4 bg-dv-gold/[0.02] blur-3xl rounded-3xl pointer-events-none" />

              {/* Intelligence text area */}
              <div className="relative min-h-[200px]">
                {lines.slice(0, visibleLines).map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="mb-2"
                  >
                    {i === 0 ? (
                      <p className="text-xl md:text-2xl font-light text-white/90 tracking-wide">
                        {line.text}
                      </p>
                    ) : i === lines.length - 1 ? (
                      <p className="text-base md:text-lg text-dv-gold/80 mt-4">
                        {line.text}
                      </p>
                    ) : (
                      <div className="flex items-start gap-3">
                        <span className="text-dv-gold/40 mt-1.5 shrink-0">
                          <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
                            <circle cx="3" cy="3" r="3" />
                          </svg>
                        </span>
                        <p className="text-base md:text-lg text-white/60 font-light tracking-wide">
                          {line.text}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Cursor */}
                {cursorVisible && (
                  <motion.div
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                    className="inline-block w-[2px] h-5 bg-dv-gold/70 ml-1 align-text-bottom"
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default WelcomeAnimation;
