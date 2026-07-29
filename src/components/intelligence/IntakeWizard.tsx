import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, Check, Phone, User, FileText, AlertCircle, Calendar } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { useAIWorkspaceStore } from '@/store/workspace.store';
import * as api from '@/utils/api';

interface IntakeWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (data: any) => void;
}

const SOURCES = ['Instagram', 'Google', '2GIS', 'Сайт', 'Рекомендация', 'Повторный пациент', 'Другое'];
const COMPLAINT_OPTIONS = ['Боль', 'Отек', 'Разрушение зуба', 'Кровоточивость', 'Подвижность', 'Имплантация', 'Протезирование', 'Эстетика', 'Брекеты', 'Профосмотр', 'Другое'];

type StepId =
  | 'patient_info'
  | 'source'
  | 'complaints'
  | 'pain_location'
  | 'pain_duration'
  | 'pain_type'
  | 'pain_intensity'
  | 'extra_symptoms'
  | 'tooth_destruction'
  | 'trauma'
  | 'pregnancy'
  | 'allergies'
  | 'medications'
  | 'anticoagulants'
  | 'chronic'
  | 'triage'
  | 'doctor_selection'
  | 'booking';

interface StepConfig {
  id: StepId;
  title: string;
  component: React.FC<{ data: any; update: (k: string, v: any) => void; next: () => void; back: () => void }>;
}

export function IntakeWizard({ open, onClose, onComplete }: IntakeWizardProps) {
  const [step, setStep] = useState<StepId>('patient_info');
  const [data, setData] = useState<any>({
    name: '', phone: '', iin: '', birthDate: '', gender: '', address: '', email: '',
    source: '', complaints: [], painDetails: {}, painIntensity: undefined,
    extraSymptoms: [], toothDestruction: '', trauma: null, pregnancy: null,
    allergies: null, medications: null, anticoagulants: null, chronic: null,
  });
  const [triageResult, setTriageResult] = useState<any>(null);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  const handleComplete = useCallback(() => {
    onComplete?.({
      ...data,
      triage: triageResult,
      doctor: selectedDoctor,
      booking: bookingResult,
    })
    onClose()
  }, [data, triageResult, selectedDoctor, bookingResult, onComplete, onClose])

  const update = useCallback((key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  }, []);

  const handleTriage = useCallback(async () => {
    setLoading(true);
    try {
      const complaints = data.complaints;
      const pd = data.painDetails || {};
      let specialty = 'Терапевт';
      let reason = 'Общий осмотр и диагностика';
      let urgency = 'Обычная';
      let diagnosis = 'Осмотр';

      if (complaints.includes('Боль')) {
        if (pd.type?.includes('Острая') || pd.type?.includes('Пульсирующая') || pd.type?.includes('Ночная') || pd.type?.includes('Самопроизвольная')) {
          specialty = 'Эндодонтист'; reason = 'Острая боль — вероятный пульпит'; urgency = 'Срочно'; diagnosis = 'Острый пульпит / периодонтит';
        } else if (pd.type?.includes('При накусывании')) {
          specialty = 'Эндодонтист'; reason = 'Боль при накусывании'; urgency = 'Сегодня'; diagnosis = 'Хронический периодонтит';
        }
      }
      if (complaints.includes('Имплантация')) { specialty = 'Имплантолог'; reason = 'Имплантация'; diagnosis = 'Адентия'; }
      if (complaints.includes('Протезирование')) { specialty = 'Ортопед'; reason = 'Протезирование'; diagnosis = 'Адентия'; }
      if (complaints.includes('Брекеты')) { specialty = 'Ортодонт'; reason = 'Ортодонтия'; diagnosis = 'Аномалия прикуса'; }
      if (complaints.includes('Кровоточивость')) { specialty = 'Пародонтолог'; reason = 'Пародонтит'; diagnosis = 'Пародонтит'; }
      if (complaints.includes('Отек') || data.extraSymptoms?.includes('Отек')) { urgency = 'Срочно'; specialty = 'Хирург'; diagnosis = 'Абсцесс'; }
      if (complaints.includes('Профосмотр')) { specialty = 'Гигиенист'; reason = 'Профосмотр'; diagnosis = 'Профосмотр'; }

      setTriageResult({ specialty, reason, urgency, diagnosis });
      setStep('triage');
    } catch { /* ignore */ }
    setLoading(false);
  }, [data]);

  const next = useCallback(() => {
    const steps: StepId[] = ['patient_info', 'source', 'complaints', 'pain_location', 'pain_duration', 'pain_type', 'pain_intensity', 'extra_symptoms', 'tooth_destruction', 'trauma', 'pregnancy', 'allergies', 'medications', 'anticoagulants', 'chronic', 'triage', 'doctor_selection', 'booking'];

    if (step === 'complaints' && !data.complaints.includes('Боль')) {
      setStep('extra_symptoms');
      return;
    }

    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) {
      if (step === 'chronic') {
        handleTriage();
        return;
      }
      setStep(steps[idx + 1]);
    }
  }, [step, data, handleTriage]);

  const back = useCallback(() => {
    const steps: StepId[] = ['patient_info', 'source', 'complaints', 'pain_location', 'pain_duration', 'pain_type', 'pain_intensity', 'extra_symptoms', 'tooth_destruction', 'trauma', 'pregnancy', 'allergies', 'medications', 'anticoagulants', 'chronic', 'triage', 'doctor_selection', 'booking'];
    const idx = steps.indexOf(step);
    if (idx > 0) {
      if (steps[idx - 1] === 'pain_intensity' && !data.complaints.includes('Боль')) {
        setStep('complaints');
        return;
      }
      setStep(steps[idx - 1]);
    }
  }, [step, data]);

  const progress = {
    patient_info: 1, source: 2, complaints: 3, pain_location: 4, pain_duration: 5,
    pain_type: 6, pain_intensity: 7, extra_symptoms: 8, tooth_destruction: 9,
    trauma: 10, pregnancy: 11, allergies: 12, medications: 13, anticoagulants: 14,
    chronic: 15, triage: 16, doctor_selection: 17, booking: 18,
  };

  const totalSteps = data.complaints.includes('Боль') ? 18 : 13;
  const currentStep = progress[step] || 1;
  const pct = Math.round((currentStep / totalSteps) * 100);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
            onClick={(e: any) => e.stopPropagation()}
          >
            <GlassCard padding="lg">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-dv-gold/10 flex items-center justify-center">
                    <User size={16} className="text-dv-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-txt-primary">Запись нового пациента</h3>
                    <p className="text-[10px] text-txt-muted">Шаг {currentStep} из {totalSteps}</p>
                  </div>
                </div>
                <button aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-1 text-txt-muted"><X size={16} /></button>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-surface-1 rounded-full mb-5 overflow-hidden">
                <motion.div
                  className="h-full bg-dv-gold rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Step content */}
              {step === 'patient_info' && (
                <div className="space-y-3">
                  <p className="text-xs text-txt-muted font-medium">Информация о пациенте</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] text-txt-muted block mb-1">ФИО *</label>
                      <input value={data.name} onChange={e => update('name', e.target.value)}
                        className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" placeholder="Иванов Иван Иванович" />
                    </div>
                    <div>
                      <label className="text-[10px] text-txt-muted block mb-1">ИИН</label>
                      <input value={data.iin} onChange={e => update('iin', e.target.value)}
                        className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" placeholder="12 цифр" />
                    </div>
                    <div>
                      <label className="text-[10px] text-txt-muted block mb-1">Телефон *</label>
                      <input value={data.phone} onChange={e => update('phone', e.target.value)}
                        className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" placeholder="+7 (7__) ___ ____" />
                    </div>
                    <div>
                      <label className="text-[10px] text-txt-muted block mb-1">Дата рождения</label>
                      <input type="date" value={data.birthDate} onChange={e => update('birthDate', e.target.value)}
                        className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                    </div>
                    <div>
                      <label className="text-[10px] text-txt-muted block mb-1">Пол</label>
                      <select value={data.gender} onChange={e => update('gender', e.target.value)}
                        className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold">
                        <option value="">Не указан</option>
                        <option value="male">Мужской</option>
                        <option value="female">Женский</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-txt-muted block mb-1">Email</label>
                      <input value={data.email} onChange={e => update('email', e.target.value)}
                        className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" placeholder="email@example.com" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-txt-muted block mb-1">Адрес</label>
                      <input value={data.address} onChange={e => update('address', e.target.value)}
                        className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                    </div>
                  </div>
                </div>
              )}

              {step === 'source' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Откуда пациент узнал о клинике?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCES.map(s => (
                      <button key={s} onClick={() => { update('source', s); next(); }}
                        className={`p-3 rounded-xl text-left text-sm transition-all border ${data.source === s ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'complaints' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Что беспокоит пациента?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COMPLAINT_OPTIONS.map(c => (
                      <button key={c} onClick={() => {
                        const next = data.complaints.includes(c)
                          ? data.complaints.filter((x: string) => x !== c)
                          : [...data.complaints, c];
                        update('complaints', next);
                      }}
                        className={`p-3 rounded-xl text-left text-sm transition-all border ${data.complaints.includes(c) ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'pain_location' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Где болит?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['Верхняя челюсть', 'Нижняя челюсть', 'Слева', 'Справа', 'Передние зубы', 'Жевательные', 'Не знает'].map(l => (
                      <button key={l} onClick={() => { update('painDetails', { ...data.painDetails, location: l }); next(); }}
                        className={`p-3 rounded-xl text-left text-sm transition-all border ${data.painDetails?.location === l ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'pain_duration' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Как давно болит?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['Сегодня', 'Несколько дней', 'Неделю', 'Месяц', 'Больше месяца'].map(d => (
                      <button key={d} onClick={() => { update('painDetails', { ...data.painDetails, duration: d }); next(); }}
                        className={`p-3 rounded-xl text-left text-sm transition-all border ${data.painDetails?.duration === d ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'pain_type' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Какая боль?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['Ноющая', 'Острая', 'Пульсирующая', 'При накусывании', 'От холодного', 'От горячего', 'Самопроизвольная', 'Ночная'].map(t => (
                      <button key={t} onClick={() => { update('painDetails', { ...data.painDetails, type: t }); next(); }}
                        className={`p-3 rounded-xl text-left text-sm transition-all border ${data.painDetails?.type === t ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'pain_intensity' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Интенсивность боли (0 — нет, 10 — невыносимо)</p>
                  <input type="range" min="0" max="10" value={data.painIntensity ?? 5} onChange={e => update('painIntensity', Number(e.target.value))}
                    className="w-full accent-dv-gold" />
                  <p className="text-center text-2xl font-bold text-dv-gold mt-2">{data.painIntensity ?? 5}/10</p>
                </div>
              )}

              {step === 'extra_symptoms' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Есть дополнительные симптомы?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['Отек', 'Температура', 'Свищ', 'Неприятный запах', 'Кровотечение', 'Нет'].map(s => (
                      <button key={s} onClick={() => {
                        const next = s === 'Нет' ? [] :
                          (data.extraSymptoms || []).includes(s)
                            ? data.extraSymptoms.filter((x: string) => x !== s)
                            : [...(data.extraSymptoms || []), s];
                        update('extraSymptoms', next);
                      }}
                        className={`p-3 rounded-xl text-left text-sm transition-all border ${(data.extraSymptoms || []).includes(s) ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'tooth_destruction' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Разрушение зуба?</p>
                  <div className="grid grid-cols-1 gap-2">
                    {['Нет', 'Скол', 'Большая кариозная полость', 'Почти полностью разрушен', 'Остался только корень'].map(d => (
                      <button key={d} onClick={() => { update('toothDestruction', d); next(); }}
                        className={`p-3 rounded-xl text-left text-sm transition-all border ${data.toothDestruction === d ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'trauma' && (() => {
                const options = ['Да', 'Нет'];
                return (
                  <div>
                    <p className="text-xs text-txt-muted font-medium mb-3">Была ли травма?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {options.map(o => (
                        <button key={o} onClick={() => { update('trauma', o === 'Да' ? true : false); next(); }}
                          className={`p-3 rounded-xl text-left text-sm transition-all border ${(o === 'Да' && data.trauma === true) || (o === 'Нет' && data.trauma === false) ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {(['pregnancy', 'allergies'] as const).map(stepKey => (
                step === stepKey && (
                  <div key={stepKey}>
                    <p className="text-xs text-txt-muted font-medium mb-3">
                      {stepKey === 'pregnancy' ? 'Беременность?' : 'Есть аллергия?'}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {['Да', 'Нет', 'Не относится'].map(o => (
                        <button key={o} onClick={() => { update(stepKey, o); next(); }}
                          className={`p-3 rounded-xl text-center text-sm transition-all border ${data[stepKey] === o ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}

              {(['medications', 'anticoagulants', 'chronic'] as const).map(stepKey => (
                step === stepKey && (
                  <div key={stepKey}>
                    <p className="text-xs text-txt-muted font-medium mb-3">
                      {stepKey === 'medications' ? 'Принимает антибиотики?' :
                       stepKey === 'anticoagulants' ? 'Принимает антикоагулянты (кроверазжижающие)?' :
                       'Есть хронические заболевания?'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Да', 'Нет'].map(o => (
                        <button key={o} onClick={() => { update(stepKey, o); next(); }}
                          className={`p-3 rounded-xl text-center text-sm transition-all border ${data[stepKey] === o ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}

              {step === 'triage' && triageResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                    <p className="text-xs text-txt-muted mb-1">Вероятная причина</p>
                    <p className="text-sm font-bold text-txt-primary">{triageResult.diagnosis}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-dv-gold/5 border border-dv-gold/20">
                      <p className="text-[10px] text-txt-muted mb-1">Специалист</p>
                      <p className="text-sm font-semibold text-dv-gold">{triageResult.specialty}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-warning/5 border border-warning/20">
                      <p className="text-[10px] text-txt-muted mb-1">Срочность</p>
                      <p className="text-sm font-semibold text-warning">{triageResult.urgency}</p>
                    </div>
                  </div>
                  <p className="text-xs text-txt-muted">{triageResult.reason}</p>
                </div>
              )}

              {step === 'doctor_selection' && (
                <div>
                  <p className="text-xs text-txt-muted font-medium mb-3">Выберите врача</p>
                  <div className="space-y-2">
                    {[
                      { id: 1, name: 'Ахметов А.А.', specialty: triageResult?.specialty || 'Терапевт' },
                      { id: 2, name: 'Ким Н.В.', specialty: triageResult?.specialty || 'Терапевт' },
                      { id: 3, name: 'Сидоров П.П.', specialty: triageResult?.specialty || 'Терапевт' },
                    ].map(doc => (
                      <button key={doc.id} onClick={() => { setSelectedDoctor(doc); next() }}
                        className={`w-full p-3 rounded-xl text-left text-sm transition-all border ${selectedDoctor?.id === doc.id ? 'border-dv-gold bg-dv-gold/10 text-dv-gold' : 'border-bdr-subtle text-txt-primary hover:border-dv-gold/40'}`}>
                        <span className="font-medium">{doc.name}</span>
                        <span className="text-txt-muted ml-2">{doc.specialty}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'booking' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                    <p className="text-xs text-txt-muted mb-1">Пациент</p>
                    <p className="text-sm font-bold text-txt-primary">{data.name || 'Не указан'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-txt-muted mb-1">Врач</p>
                      <p className="text-sm font-semibold text-txt-primary">{selectedDoctor?.name || 'Не выбран'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-txt-muted mb-1">Специализация</p>
                      <p className="text-sm font-semibold text-txt-primary">{triageResult?.specialty || '—'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-txt-muted">{triageResult?.diagnosis}</p>
                  <p className="text-xs text-txt-muted">Срочность: {triageResult?.urgency || '—'}</p>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-bdr-subtle/50">
                <Button variant="ghost" size="sm" onClick={back} disabled={step === 'patient_info'}>
                  <ArrowLeft size={14} className="mr-1" /> Назад
                </Button>
                {step === 'chronic' && (
                  <Button variant="primary" size="sm" onClick={handleTriage} disabled={loading}>
                    {loading ? 'Анализ...' : 'Проанализировать жалобы'}
                  </Button>
                )}
                {step === 'triage' && (
                  <Button variant="primary" size="sm" onClick={() => setStep('doctor_selection')}>
                    Выбрать врача <ArrowRight size={14} className="ml-1" />
                  </Button>
                )}
                {!['source', 'pain_location', 'pain_duration', 'pain_type', 'trauma', 'pregnancy', 'allergies', 'medications', 'anticoagulants', 'chronic', 'triage', 'doctor_selection', 'booking'].includes(step) && step !== 'patient_info' && (
                  <Button variant="primary" size="sm" onClick={next}>
                    Далее <ArrowRight size={14} className="ml-1" />
                  </Button>
                )}
                {step === 'patient_info' && (
                  <Button variant="primary" size="sm" onClick={next} disabled={!data.name || !data.phone}>
                    Далее <ArrowRight size={14} className="ml-1" />
                  </Button>
                )}
                {step === 'extra_symptoms' && (
                  <Button variant="primary" size="sm" onClick={next}>
                    Далее <ArrowRight size={14} className="ml-1" />
                  </Button>
                )}
                {step === 'pain_intensity' && (
                  <Button variant="primary" size="sm" onClick={next}>
                    Далее <ArrowRight size={14} className="ml-1" />
                  </Button>
                )}
                {step === 'tooth_destruction' && (
                  <Button variant="primary" size="sm" onClick={next}>
                    Далее <ArrowRight size={14} className="ml-1" />
                  </Button>
                )}
                {step === 'booking' && (
                  <Button variant="primary" size="sm" onClick={handleComplete}>
                    <Check size={14} className="mr-1" /> Подтвердить запись
                  </Button>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
