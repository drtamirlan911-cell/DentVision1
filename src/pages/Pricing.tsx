// ═══════════════════════════════════════════════════════════════
// Pricing Page — plan comparison for guests
// ═══════════════════════════════════════════════════════════════
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, X, Star, Zap, Crown, Building2 } from 'lucide-react';
import { useGuestStore } from '@/store/guest.store';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '0',
    period: 'навсегда',
    icon: Star,
    color: '#64748B',
    features: [
      { text: 'До 100 пациентов', included: true },
      { text: 'Базовое расписание', included: true },
      { text: '1 пользователь', included: true },
      { text: 'Маркетплейс + Академия', included: true },
      { text: 'AI-ассистент', included: false },
      { text: 'Аналитика', included: false },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '49 900',
    period: '/месяц',
    icon: Zap,
    color: '#C9A96E',
    popular: true,
    features: [
      { text: 'Безлимит пациентов', included: true },
      { text: 'До 10 пользователей', included: true },
      { text: 'AI-ассистент (100 запросов/мес)', included: true },
      { text: 'Аналитика + отчёты', included: true },
      { text: 'Маркетплейс + Академия', included: true },
      { text: 'Мульти-клиника', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '149 900',
    period: '/месяц',
    icon: Crown,
    color: '#8E44AD',
    features: [
      { text: 'Всё из Professional', included: true },
      { text: 'Безлимит пользователей и AI', included: true },
      { text: 'Мульти-клиника', included: true },
      { text: 'Приоритетная поддержка', included: true },
      { text: 'Кастомная интеграция', included: true },
      { text: 'SLA 99.9%', included: true },
    ],
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { setRegistrationModal } = useGuestStore();

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dv-gold/10 border border-dv-gold/20 mb-4">
            <Crown size={14} className="text-dv-gold" />
            <span className="text-xs font-semibold text-dv-gold">Тарифы</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-txt-primary mb-3">
            Выберите свой план
          </h1>
          <p className="text-base text-txt-secondary max-w-lg mx-auto">
            Все планы включают 30-дневный бесплатный период Enterprise
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border p-6 transition-all ${
                  plan.popular
                    ? 'bg-surface-1 border-dv-gold/30 shadow-lg shadow-dv-gold/10'
                    : 'bg-surface-1/50 border-bdr-subtle hover:border-dv-gold/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-dv-gold text-surface-0 text-[10px] font-bold uppercase tracking-wider">
                    Популярный
                  </div>
                )}
                <div className="text-center mb-6 pt-2">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: `${plan.color}15` }}
                  >
                    <Icon size={22} style={{ color: plan.color }} />
                  </div>
                  <h3 className="text-lg font-bold text-txt-primary">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-txt-primary">{plan.price}</span>
                    <span className="text-sm text-txt-muted"> ₸{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2.5">
                      {f.included ? (
                        <Check size={14} className="text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <X size={14} className="text-txt-ghost mt-0.5 shrink-0" />
                      )}
                      <span className={`text-sm ${f.included ? 'text-txt-secondary' : 'text-txt-ghost'}`}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setRegistrationModal(true)}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    plan.popular
                      ? 'bg-dv-gold text-surface-0 hover:bg-dv-gold/90'
                      : 'bg-surface-2 text-txt-primary border border-bdr-subtle hover:bg-surface-3'
                  }`}
                >
                  Начать бесплатно
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12 p-6 rounded-2xl bg-surface-1 border border-bdr-subtle"
        >
          <Building2 size={20} className="text-txt-muted mx-auto mb-2" />
          <p className="text-sm text-txt-secondary">
            Для клиник с особыми требованиями —{' '}
            <button onClick={() => navigate('/community')} className="text-dv-gold hover:underline">
              свяжитесь с нами
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
