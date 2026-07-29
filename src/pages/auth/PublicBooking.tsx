import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Loader2,
  Stethoscope,
  MapPin,
  Phone,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import { ALL_SERVICES } from '@/utils/constants';
import { getPublicClinic, getPublicSlots, submitBooking, type PublicClinicPayload } from '@/utils/api';
import { rateLimit, validatePhone, validateEmail, sanitizeInput } from '@/utils/security';

type Step = 'service' | 'doctor' | 'datetime' | 'contact' | 'success';

const STEPS: Array<{ id: Step; label: string; icon: React.ReactNode }> = [
  { id: 'service', label: 'Услуга', icon: <Sparkles size={14} /> },
  { id: 'doctor', label: 'Врач', icon: <User size={14} /> },
  { id: 'datetime', label: 'Дата', icon: <Calendar size={14} /> },
  { id: 'contact', label: 'Контакты', icon: <Phone size={14} /> },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function formatPrice(price: number, currency = 'KZT'): string {
  if (!price) return 'По запросу';
  const suffix = currency === 'KZT' ? ' ₸' : ` ${currency}`;
  return `${Math.round(price).toLocaleString('ru-RU')}${suffix}`;
}

function nextDays(count = 14): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function formatDayLabel(iso: string): { dow: string; day: string; month: string } {
  const d = new Date(`${iso}T12:00:00`);
  return {
    dow: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
    day: d.toLocaleDateString('ru-RU', { day: 'numeric' }),
    month: d.toLocaleDateString('ru-RU', { month: 'short' }),
  };
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
}

export default function PublicBooking() {
  const { clinicId } = useParams();
  const [payload, setPayload] = useState<PublicClinicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('service');
  const [submitting, setSubmitting] = useState(false);

  const [serviceName, setServiceName] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [workingDay, setWorkingDay] = useState(true);

  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const dates = useMemo(() => nextDays(14), []);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        const data = await getPublicClinic(clinicId);
        setPayload(data);
        setDate((prev) => prev || nextDays(14)[0]);
      } catch (e: any) {
        setError(e?.message || 'Клиника не найдена');
      } finally {
        setLoading(false);
      }
    })();
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId || !date || step !== 'datetime') return;
    (async () => {
      setSlotsLoading(true);
      try {
        const res = await getPublicSlots(clinicId, date, doctorId || undefined);
        setSlots(res.slots);
        setWorkingDay(res.workingDay);
        if (time && !res.slots.includes(time)) setTime('');
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [clinicId, date, doctorId, step, time]);

  const services = useMemo(() => {
    if (payload?.services?.length) return payload.services;
    return ALL_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      category: s.cat,
    }));
  }, [payload]);

  const servicesByCategory = useMemo(() => {
    const map = new Map<string, typeof services>();
    for (const s of services) {
      const cat = s.category || 'Услуги';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return Array.from(map.entries());
  }, [services]);

  const selectedDoctor = payload?.doctors.find((d) => d.id === doctorId);
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goNext = () => {
    setFormError('');
    if (step === 'service' && !serviceName) {
      setFormError('Выберите услугу');
      return;
    }
    if (step === 'datetime' && (!date || !time)) {
      setFormError('Выберите дату и время');
      return;
    }
    const order: Step[] = ['service', 'doctor', 'datetime', 'contact'];
    const idx = order.indexOf(step);
    if (idx >= 0 && idx < order.length - 1) setStep(order[idx + 1]);
  };

  const goBack = () => {
    setFormError('');
    const order: Step[] = ['service', 'doctor', 'datetime', 'contact'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!rateLimit('booking', { maxAttempts: 5, windowMs: 60000 })) {
      setFormError('Слишком много заявок. Подождите минуту.');
      return;
    }
    if (!patientName.trim()) {
      setFormError('Введите ваше имя');
      return;
    }
    if (!validatePhone(phone)) {
      setFormError('Введите корректный номер телефона');
      return;
    }
    if (email && !validateEmail(email)) {
      setFormError('Введите корректный email');
      return;
    }
    if (!clinicId || !date || !time) return;

    setSubmitting(true);
    try {
      await submitBooking({
        clinicId,
        patientName: sanitizeInput(patientName),
        phone: sanitizeInput(phone),
        email: sanitizeInput(email),
        doctorId: doctorId || undefined,
        serviceName: sanitizeInput(serviceName),
        date,
        time,
        notes: sanitizeInput(notes),
      });
      setStep('success');
    } catch (e: any) {
      setFormError(e?.message || 'Ошибка при отправке. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setStep('service');
    setServiceName('');
    setDoctorId('');
    setDate(dates[0]);
    setTime('');
    setPatientName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setFormError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-dv-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle size={48} className="mx-auto text-amber-400" />
          <h1 className="font-serif text-2xl text-txt-primary">Запись недоступна</h1>
          <p className="text-sm text-txt-muted">{error}</p>
        </div>
      </div>
    );
  }

  const clinic = payload?.clinic;

  if (step === 'success') {
    return (
      <div className="relative min-h-screen bg-surface-0 flex items-center justify-center p-5 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-dv-gold/10 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 max-w-md w-full text-center bg-white/[0.03] border border-dv-gold/20 rounded-2xl p-8 shadow-[0_40px_80px_rgba(0,0,0,0.45)]"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="mb-5 flex justify-center"
          >
            <CheckCircle2 size={72} className="text-emerald-400 drop-shadow-[0_4px_20px_rgba(52,211,153,0.4)]" />
          </motion.div>
          <h1 className="font-serif text-2xl text-txt-primary mb-2">Заявка отправлена!</h1>
          <p className="text-sm text-txt-muted mb-1">
            {clinic?.name}
          </p>
          <p className="text-sm text-txt-secondary mb-6">
            {serviceName} · {date.split('-').reverse().join('.')} в {time}
            {selectedDoctor ? ` · ${selectedDoctor.name}` : ''}
          </p>
          <p className="text-xs text-txt-muted mb-6">
            Администратор свяжется с вами для подтверждения записи в ближайшее время.
          </p>
          <Button onClick={resetBooking} className="w-full">
            Записаться ещё раз
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-surface-0 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.12) 0%, transparent 70%)' }}
          animate={{ x: [0, 40, -20, 60, 0], y: [0, -30, 50, -10, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(41,128,185,0.08) 0%, transparent 70%)' }}
          animate={{ x: [0, -50, 30, -20, 0], y: [0, 40, -30, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 sm:py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-3 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-dv-gold/20 blur-2xl rounded-full" />
              {clinic?.logo ? (
                <img src={clinic.logo} alt="" className="relative h-14 w-14 rounded-2xl object-cover border border-dv-gold/30" />
              ) : (
                <Stethoscope size={44} className="relative text-dv-gold drop-shadow-[0_4px_12px_rgba(201,169,110,0.4)]" />
              )}
            </div>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-txt-primary tracking-tight">
            {clinic?.name || 'Онлайн-запись'}
          </h1>
          <p className="text-xs text-txt-muted mt-1">Запишитесь на приём за пару минут</p>
          {(clinic?.address || clinic?.phone) && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-xs text-txt-muted">
              {clinic.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-dv-gold" />
                  {clinic.address}{clinic.city ? `, ${clinic.city}` : ''}
                </span>
              )}
              {clinic.phone && (
                <a href={`tel:${clinic.phone}`} className="inline-flex items-center gap-1 hover:text-dv-gold transition-colors">
                  <Phone size={12} className="text-dv-gold" />
                  {clinic.phone}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => i < stepIndex && setStep(s.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-2xs font-semibold transition-all',
                  step === s.id
                    ? 'bg-dv-gold/20 text-dv-gold border border-dv-gold/40'
                    : i < stepIndex
                      ? 'text-txt-secondary hover:text-dv-gold cursor-pointer'
                      : 'text-txt-muted',
                )}
              >
                <span className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                  step === s.id ? 'bg-dv-gold text-surface-0' : 'bg-white/5',
                )}>
                  {i < stepIndex ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('w-4 sm:w-8 h-px', i < stepIndex ? 'bg-dv-gold/50' : 'bg-white/10')} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-dv-gold/20 rounded-2xl p-5 sm:p-7 shadow-[0_40px_80px_rgba(0,0,0,0.45)]">
          {formError && (
            <div className="mb-4 flex items-start gap-2 bg-error/10 border border-error/25 rounded-xl px-3 py-2.5 text-xs text-error">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              {formError}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'service' && (
              <motion.div key="service" variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="space-y-4">
                <h2 className="font-serif text-lg text-txt-primary">Выберите услугу</h2>
                <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
                  {servicesByCategory.map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-2xs font-bold uppercase tracking-wider text-txt-muted mb-2">{cat}</p>
                      <div className="grid gap-2">
                        {items.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setServiceName(s.name)}
                            className={cn(
                              'w-full text-left rounded-xl border px-4 py-3 transition-all',
                              serviceName === s.name
                                ? 'border-dv-gold/60 bg-dv-gold/10 shadow-[0_0_0_1px_rgba(201,169,110,0.2)]'
                                : 'border-bdr-subtle bg-white/[0.02] hover:border-dv-gold/30 hover:bg-white/[0.04]',
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-txt-primary">{s.name}</span>
                              <span className="text-xs font-semibold text-dv-gold whitespace-nowrap">
                                {formatPrice(s.price, payload?.settings?.currency)}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'doctor' && (
              <motion.div key="doctor" variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="space-y-4">
                <h2 className="font-serif text-lg text-txt-primary">Выберите врача</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDoctorId('')}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-all',
                      !doctorId
                        ? 'border-dv-gold/60 bg-dv-gold/10'
                        : 'border-bdr-subtle bg-white/[0.02] hover:border-dv-gold/30',
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-dv-gold/20 text-dv-gold font-bold text-sm mb-2">
                      ?
                    </div>
                    <p className="text-sm font-semibold text-txt-primary">Любой врач</p>
                    <p className="text-2xs text-txt-muted mt-0.5">Подберём свободного специалиста</p>
                  </button>
                  {(payload?.doctors || []).map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setDoctorId(doc.id)}
                      className={cn(
                        'rounded-xl border p-4 text-left transition-all',
                        doctorId === doc.id
                          ? 'border-dv-gold/60 bg-dv-gold/10'
                          : 'border-bdr-subtle bg-white/[0.02] hover:border-dv-gold/30',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {doc.avatar ? (
                          <img src={doc.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-dv-gold/30 to-dv-gold/10 text-dv-gold font-bold text-sm">
                            {initials(doc.name)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-txt-primary">{doc.name}</p>
                          {doc.spec && <p className="text-2xs text-txt-muted">{doc.spec}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'datetime' && (
              <motion.div key="datetime" variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="space-y-5">
                <h2 className="font-serif text-lg text-txt-primary">Дата и время</h2>
                <div>
                  <p className="text-2xs font-semibold text-txt-muted mb-2 uppercase tracking-wide">День</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {dates.map((d) => {
                      const lbl = formatDayLabel(d);
                      const active = date === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => { setDate(d); setTime(''); }}
                          className={cn(
                            'shrink-0 flex flex-col items-center min-w-[56px] rounded-xl border px-2 py-2 transition-all',
                            active
                              ? 'border-dv-gold bg-dv-gold/15 text-dv-gold'
                              : 'border-bdr-subtle text-txt-secondary hover:border-dv-gold/30',
                          )}
                        >
                          <span className="text-[10px] uppercase">{lbl.dow}</span>
                          <span className="text-base font-bold leading-tight">{lbl.day}</span>
                          <span className="text-[10px]">{lbl.month}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-2xs font-semibold text-txt-muted mb-2 uppercase tracking-wide flex items-center gap-1">
                    <Clock size={12} /> Время
                  </p>
                  {slotsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-dv-gold" />
                    </div>
                  ) : !workingDay ? (
                    <p className="text-sm text-txt-muted text-center py-6">В этот день клиника не работает</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-txt-muted text-center py-6">Нет свободных слотов — выберите другой день</p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                      {slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTime(slot)}
                          className={cn(
                            'rounded-lg border py-2 text-xs font-semibold transition-all',
                            time === slot
                              ? 'border-dv-gold bg-dv-gold text-surface-0 shadow-glow-sm'
                              : 'border-bdr-subtle text-txt-secondary hover:border-dv-gold/40 hover:text-dv-gold',
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 'contact' && (
              <motion.div key="contact" variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="space-y-4">
                <h2 className="font-serif text-lg text-txt-primary">Ваши контакты</h2>
                <div className="rounded-xl border border-dv-gold/20 bg-dv-gold/5 p-3 text-xs text-txt-secondary space-y-1">
                  <p><span className="text-txt-muted">Услуга:</span> {serviceName || '—'}</p>
                  <p>
                    <span className="text-txt-muted">Когда:</span> {date.split('-').reverse().join('.')} в {time}
                    {selectedDoctor ? ` · ${selectedDoctor.name}` : ' · любой врач'}
                  </p>
                </div>
                <Input
                  label="ФИО *"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    label="Телефон *"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 777 000 00 00"
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-txt-muted mb-1.5">Комментарий</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Опишите жалобы или пожелания..."
                    className="w-full bg-white/[0.04] border border-bdr-subtle rounded-lg px-3.5 py-2.5 text-sm text-txt-primary outline-none focus:border-dv-gold transition-colors resize-y"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nav */}
          <div className="flex gap-3 mt-6 pt-5 border-t border-white/5">
            {stepIndex > 0 && (
              <Button type="button" variant="secondary" onClick={goBack} icon={<ChevronLeft size={16} />}>
                Назад
              </Button>
            )}
            {step !== 'contact' ? (
              <Button type="button" className="flex-1" onClick={goNext} icon={<ChevronRight size={16} />}>
                Далее
              </Button>
            ) : (
              <Button type="button" className="flex-1" loading={submitting} onClick={handleSubmit}>
                Записаться на приём
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-txt-muted mt-6">
          Powered by <span className="text-dv-gold font-semibold">DentVision</span>
        </p>
      </div>
    </div>
  );
}
