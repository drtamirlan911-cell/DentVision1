import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, Bot, Shield, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiGreeting, aiProactive } from '@/utils/api';

interface WelcomeAnimationProps {
  onComplete: () => void;
}

const PHASES = [
  { delay: 0, duration: 800 },
  { delay: 900, duration: 600 },
  { delay: 1700, duration: 500 },
  { delay: 2400, duration: 400 },
  { delay: 3000, duration: 300 },
];

export function WelcomeAnimation({ onComplete }: WelcomeAnimationProps) {
  const { user, clinic } = useAuth();
  const [phase, setPhase] = useState(0);
  const [greetingText, setGreetingText] = useState('');

  const h = new Date().getHours();
  const timeWord = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = user?.name?.split(' ')[0] || user?.login || '';

  useEffect(() => {
    (async () => {
      try {
        const g = await aiGreeting();
        setGreetingText(g.greeting);
      } catch {
        setGreetingText(`${timeWord}, ${name}.`);
      }
    })();
  }, []);

  useEffect(() => {
    const timers = PHASES.map((p, i) =>
      setTimeout(() => setPhase(i + 1), p.delay)
    );
    const finalTimer = setTimeout(onComplete, 3800);
    return () => { timers.forEach(clearTimeout); clearTimeout(finalTimer); };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-surface-0 flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/3 via-transparent to-transparent pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6 max-w-lg px-6">
        <AnimatePresence mode="wait">
          {phase >= 1 && (
            <motion.div
              key="logo"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="relative"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-dv-gold/10 border border-dv-gold/20">
                <Stethoscope size={44} className="text-dv-gold" />
              </div>
              {phase >= 2 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-dv-gold"
                >
                  <Bot size={14} className="text-white" />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {phase >= 2 && (
            <motion.div
              key="title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="text-center"
            >
              <h1 className="text-3xl font-bold text-txt-primary tracking-tight">
                DentVision
              </h1>
              <p className="text-sm text-txt-muted mt-1">Intelligence</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {phase >= 3 && (
            <motion.div
              key="greeting"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="text-center"
            >
              <p className="text-base text-txt-secondary leading-relaxed">
                {greetingText || `${timeWord}, ${name}.`}
              </p>
              {clinic && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs text-txt-muted mt-2 flex items-center justify-center gap-1.5"
                >
                  <Shield size={11} />
                  {clinic.name || 'Клиника'}
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              key="enter"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <button
                onClick={onComplete}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-dv-gold text-white font-medium text-sm hover:bg-dv-gold/90 transition-colors shadow-lg shadow-dv-gold/20"
              >
                <Sparkles size={16} />
                Начать
                <ChevronRight size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.15, 0],
            x: [0, (i % 2 ? 1 : -1) * 40],
            y: [0, -60 - i * 20],
          }}
          transition={{
            duration: 3,
            delay: 0.5 + i * 0.3,
            repeat: Infinity,
            repeatDelay: 4,
          }}
          className="absolute pointer-events-none"
          style={{
            left: `${20 + i * 12}%`,
            top: `${55 + (i % 3) * 10}%`,
          }}
        >
          <Sparkles size={12 + i * 2} className="text-dv-gold" />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default WelcomeAnimation;
