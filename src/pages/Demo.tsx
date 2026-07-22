// ═══════════════════════════════════════════════════════════════
// Demo Clinic Page — showcases DentVision for guests
// ═══════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope,
  Calendar,
  Users,
  Clock,
  UserPlus,
  ArrowRight,
  Sparkles,
  Star,
} from 'lucide-react';
import { useGuestStore } from '@/store/guest.store';

const DEMO_STEPS = [
  {
    icon: Calendar,
    title: 'Расписание',
    desc: 'Умное расписание с drag&drop, автоматическими напоминаниями и AI-планированием',
    color: '#C9A96E',
  },
  {
    icon: Users,
    title: 'Пациенты',
    desc: 'Картотека пациентов с историей визитов, медкартами и фотофиксацией',
    color: '#8E44AD',
  },
  {
    icon: Stethoscope,
    title: 'CRM & Клиника',
    desc: 'Полный контроль: касса, склад, аналитика, документы и ICД-10',
    color: '#16A085',
  },
  {
    icon: Sparkles,
    title: 'AI Ассистент',
    desc: 'Ваш персональный AI-ассистент для анализа данных, генерации отчётов и помощи с решениями',
    color: '#E67E22',
  },
];

const STATS = [
  { value: 'CRM', label: 'Клиника' },
  { value: 'Shop', label: 'Маркет' },
  { value: 'AI', label: 'Jarvis' },
  { value: 'Academy', label: 'Обучение' },
];

export default function Demo() {
  const navigate = useNavigate();
  const { setRegistrationModal } = useGuestStore();
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-dv-gold/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dv-gold/10 border border-dv-gold/20 mb-6">
              <Star size={14} className="text-dv-gold" />
              <span className="text-xs font-semibold text-dv-gold">Демо клиника</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-txt-primary mb-4">
              DentVision <span className="text-dv-gold">Intelligence</span>
            </h1>
            <p className="text-base md:text-lg text-txt-secondary max-w-2xl mx-auto mb-8">
              Полнофункциональная стоматологическая платформа с AI-интеграцией.
              Попробуйте демо-режим без регистрации.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/crm/schedule?demo=1')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-dv-gold text-surface-0 font-semibold text-sm hover:bg-dv-gold/90 transition-colors"
              >
                Войти в демо
                <ArrowRight size={16} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setRegistrationModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-bdr-subtle bg-surface-1 text-txt-primary font-semibold text-sm hover:bg-surface-2 transition-colors"
              >
                <UserPlus size={16} />
                Зарегистрироваться
              </motion.button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16"
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl bg-surface-1 border border-bdr-subtle">
                <p className="text-2xl font-bold text-dv-gold">{stat.value}</p>
                <p className="text-xs text-txt-muted mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-xl md:text-2xl font-bold text-txt-primary text-center mb-10">
          Возможности платформы
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {DEMO_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = activeStep === i;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.01 }}
                onMouseEnter={() => setActiveStep(i)}
                className={`p-6 rounded-2xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-surface-1 border-dv-gold/30 shadow-lg shadow-dv-gold/5'
                    : 'bg-surface-1/50 border-bdr-subtle hover:border-dv-gold/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${step.color}15` }}
                  >
                    <Icon size={20} style={{ color: step.color }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-txt-primary mb-1">{step.title}</h3>
                    <p className="text-sm text-txt-secondary leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center p-8 md:p-12 rounded-2xl bg-gradient-to-br from-dv-gold/10 via-surface-1 to-surface-1 border border-dv-gold/20"
        >
          <h2 className="text-xl md:text-2xl font-bold text-txt-primary mb-3">
            Готовы начать?
          </h2>
          <p className="text-sm text-txt-secondary mb-6 max-w-lg mx-auto">
            Создайте аккаунт бесплатно и получите 30 дней Enterprise-доступа
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setRegistrationModal(true)}
              className="px-6 py-3 rounded-xl bg-dv-gold text-surface-0 font-semibold text-sm hover:bg-dv-gold/90 transition-colors"
            >
              Начать бесплатно
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/shop')}
              className="px-6 py-3 rounded-xl border border-bdr-subtle bg-surface-1 text-txt-primary font-semibold text-sm hover:bg-surface-2 transition-colors"
            >
              Смотреть маркетплейс
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
