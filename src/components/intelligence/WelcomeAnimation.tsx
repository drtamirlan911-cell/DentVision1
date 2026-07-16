import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Bot,
  Shield,
  Sparkles,
  ChevronRight,
  Calendar,
  Users,
  DollarSign,
  FileText,
  FlaskConical,
  ShoppingCart,
  GraduationCap,
  BarChart3,
  Settings,
  X,
  Brain,
  Zap,
  LayoutGrid,
  Microscope,
  BookOpen,
  TrendingUp,
  Package,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiGreeting, aiProactive } from '@/utils/api';
import { cn } from '@/lib/utils';

interface ServiceCardDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  gradient: string;
  category: 'crm' | 'shop' | 'school' | 'platform';
}

const SERVICES: ServiceCardDef[] = [
  { id: 'crm', name: 'CRM', description: 'Пациенты и расписание', icon: <Stethoscope size={18} />, path: '/crm/schedule', color: '#C9A96E', gradient: 'from-[#C9A96E]/20 to-[#C9A96E]/5', category: 'crm' },
  { id: 'patients', name: 'Пациенты', description: 'База пациентов', icon: <Users size={18} />, path: '/crm/patients', color: '#E74C3C', gradient: 'from-[#E74C3C]/20 to-[#E74C3C]/5', category: 'crm' },
  { id: 'schedule', name: 'Расписание', description: 'Записи и календарь', icon: <Calendar size={18} />, path: '/crm/schedule', color: '#27AE60', gradient: 'from-[#27AE60]/20 to-[#27AE60]/5', category: 'crm' },
  { id: 'cashier', name: 'Касса', description: 'Финансы и оплаты', icon: <DollarSign size={18} />, path: '/crm/cashier', color: '#2980B9', gradient: 'from-[#2980B9]/20 to-[#2980B9]/5', category: 'crm' },
  { id: 'lab', name: 'Лаборатория', description: 'Лабораторные заказы', icon: <FlaskConical size={18} />, path: '/crm/lab', color: '#00BCD4', gradient: 'from-[#00BCD4]/20 to-[#00BCD4]/5', category: 'crm' },
  { id: 'shop', name: 'Shop', description: 'Маркетплейс товаров', icon: <ShoppingCart size={18} />, path: '/shop', color: '#8E44AD', gradient: 'from-[#8E44AD]/20 to-[#8E44AD]/5', category: 'shop' },
  { id: 'school', name: 'School', description: 'Образовательная платформа', icon: <GraduationCap size={18} />, path: '/school', color: '#16A085', gradient: 'from-[#16A085]/20 to-[#16A085]/5', category: 'school' },
  { id: 'analytics', name: 'Аналитика', description: 'Отчёты и метрики', icon: <BarChart3 size={18} />, path: '/analytics', color: '#F39C12', gradient: 'from-[#F39C12]/20 to-[#F39C12]/5', category: 'platform' },
  { id: 'documents', name: 'Документы', description: 'Документооборот', icon: <FileText size={18} />, path: '/crm/documents', color: '#E91E8C', gradient: 'from-[#E91E8C]/20 to-[#E91E8C]/5', category: 'crm' },
];

interface WelcomeAnimationProps {
  onComplete: () => void;
}

export function WelcomeAnimation({ onComplete }: WelcomeAnimationProps) {
  const { user, clinic, isAuthenticated } = useAuth();
  const [phase, setPhase] = useState(0);
  const [greetingText, setGreetingText] = useState('');
  const [proactiveAlerts, setProactiveAlerts] = useState<any[]>([]);
  const [ringRotation, setRingRotation] = useState(0);
  const [cardPositions, setCardPositions] = useState<Record<string, { x: number; y: number; scale: number; opacity: number }>>({});
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const h = new Date().getHours();
  const timeWord = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const name = user?.name?.split(' ')[0] || user?.login || '';

  const loadData = useCallback(async () => {
    try {
      const [greeting, proactive] = await Promise.all([
        aiGreeting().catch(() => null),
        aiProactive().catch(() => ({ alerts: [] })),
      ]);
      setGreetingText(greeting?.greeting || `${timeWord}, ${name}.`);
      if (proactive?.alerts?.length) setProactiveAlerts(proactive.alerts);
    } catch {
      setGreetingText(`${timeWord}, ${name}.`);
    }
  }, [timeWord, name]);

  const clearPhaseTimer = () => {
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  };

  const setPhaseTimed = (newPhase: number, delay: number) => {
    clearPhaseTimer();
    phaseTimerRef.current = setTimeout(() => setPhase(newPhase), delay);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
    setPhaseTimed(1, 800);    // logo → title
  }, [isAuthenticated, loadData]);

  useEffect(() => {
    if (phase !== 1) return;
    setPhaseTimed(2, 600);    // title → greeting
  }, [phase]);

  useEffect(() => {
    if (phase !== 2) return;
    setPhaseTimed(3, 800);    // greeting → cards ring
  }, [phase]);

  useEffect(() => {
    if (phase !== 3) return;
    setPhaseTimed(4, 1200);   // cards ring settle
  }, [phase]);

  useEffect(() => {
    if (phase !== 4) return;
    setPhaseTimed(5, 1000);   // fly to sidebar
  }, [phase]);

  useEffect(() => {
    if (phase !== 5) return;
    phaseTimerRef.current = setTimeout(() => {
      sessionStorage.setItem('dv_welcomed', '1');
      onComplete();
    }, 1200);
    return () => clearPhaseTimer();
  }, [phase, onComplete]);

  useEffect(() => {
    if (phase >= 3) {
      const angleStep = (2 * Math.PI) / SERVICES.length;
      const radius = 200;
      const positions: Record<string, { x: number; y: number; scale: number; opacity: number }> = {};
      SERVICES.forEach((s, i) => {
        const angle = i * angleStep - Math.PI / 2;
        positions[s.id] = {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          scale: 1,
          opacity: 1,
        };
      });
      setCardPositions(positions);
      setRingRotation(360);
    }
    if (phase === 5) {
      const positions: Record<string, { x: number; y: number; scale: number; opacity: number }> = {};
      SERVICES.forEach((s, i) => {
        positions[s.id] = {
          x: (i % 4) * 80 - 120,
          y: Math.floor(i / 4) * 80 - 40,
          scale: 0.25,
          opacity: 0,
        };
      });
      setCardPositions(positions);
    }
  }, [phase]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-surface-0 flex items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1a 100%)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/3 via-transparent to-transparent pointer-events-none" />

      <AnimatePresence mode="wait">
        {phase >= 1 && phase <= 5 && (
          <motion.div
            key="ai-core"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18 }}
            className="relative flex flex-col items-center gap-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 12 }}
              className="relative"
            >
              <motion.div
                animate={{ rotate: ringRotation }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute inset-0"
              >
                <div className="absolute inset-0 rounded-full border border-dv-gold/10" style={{ transform: 'scale(1.6)' }} />
                <div className="absolute inset-0 rounded-full border-t-2 border-dv-gold/20" style={{ transform: 'scale(2)' }} />
                <div className="absolute inset-0 rounded-full border-b-2 border-dv-gold/10" style={{ transform: 'scale(2.4)' }} />
              </motion.div>

              <div className="relative z-10 flex h-32 w-32 items-center justify-center rounded-3xl bg-dv-gold/10 border border-dv-gold/20 shadow-[0_0_80px_rgba(201,169,110,0.15)]">
                <Stethoscope size={56} className="text-dv-gold" />
              </div>

              {phase >= 2 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
                  className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-dv-gold"
                >
                  <Bot size={16} className="text-white" />
                </motion.div>
              )}

              {phase >= 3 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.4 }}
                  className="absolute -bottom-2 -left-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 border border-dv-gold/30"
                >
                  <Brain size={14} className="text-dv-gold" />
                </motion.div>
              )}
            </motion.div>

            {phase >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
                className="text-center"
              >
                <h1 className="text-5xl font-bold text-white tracking-tight">DentVision</h1>
                <p className="text-sm text-white/40 mt-1">Intelligence</p>
              </motion.div>
            )}

            {phase >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.5 }}
                className="text-center max-w-md px-4"
              >
                <p className="text-lg text-white/80 leading-relaxed">{greetingText}</p>
                {clinic && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-xs text-white/30 mt-2 flex items-center justify-center gap-1.5"
                  >
                    <Shield size={11} />
                    {clinic.name || 'Клиника'}
                  </motion.p>
                )}
              </motion.div>
            )}

            {phase >= 3 && proactiveAlerts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="flex flex-wrap gap-1.5 justify-center max-w-md px-4"
              >
                {proactiveAlerts.slice(0, 3).map((alert, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + i * 0.1, type: 'spring', stiffness: 300 }}
                    className="px-3 py-1.5 rounded-full text-[11px] bg-white/5 border border-white/10 text-white/70"
                  >
                    {alert.text}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        {phase >= 3 && (
          <motion.div
            key="cards-ring"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {SERVICES.map((service) => {
              const pos = cardPositions[service.id] || { x: 0, y: 0, scale: 1, opacity: 0 };
              return (
                <motion.div
                  key={service.id}
                  initial={false}
                  animate={{
                    x: pos.x,
                    y: pos.y,
                    scale: pos.scale,
                    opacity: pos.opacity,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: phase === 5 ? 200 : 150,
                    damping: 20,
                    delay: phase === 5 ? 0 : 0.1 * SERVICES.indexOf(service),
                  }}
                  className="pointer-events-auto"
                >
                  <motion.button
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {}}
                    className={cn(
                      'group relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300',
                      'bg-gradient-to-br',
                      service.gradient,
                      'hover:border-white/20 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]'
                    )}
                    style={{ width: 150, height: 120 }}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl mb-2 transition-transform duration-200 group-hover:scale-110"
                      style={{ background: `${service.color}20`, color: service.color }}
                    >
                      {service.icon}
                    </div>
                    <h3 className="text-sm font-semibold text-white truncate w-full text-center">{service.name}</h3>
                    <p className="text-[11px] text-white/40 truncate w-full text-center">{service.description}</p>
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: phase >= 4 ? 1 : 0, x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="absolute right-3 top-3 text-white/30 group-hover:text-dv-gold transition-colors"
                    >
                      <ChevronRight size={12} />
                    </motion.div>
                  </motion.button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.15, 0],
            x: [0, (i % 2 ? 1 : -1) * 50],
            y: [0, -80 - i * 25],
          }}
          transition={{
            duration: 4,
            delay: 0.5 + i * 0.3,
            repeat: Infinity,
            repeatDelay: 5,
          }}
          className="absolute pointer-events-none"
          style={{
            left: `${15 + i * 10}%`,
            top: `${50 + (i % 3) * 12}%`,
          }}
        >
          <Sparkles size={14 + i * 2} className="text-dv-gold" />
        </motion.div>
      ))}
    </motion.div>
  );
}

export default WelcomeAnimation;