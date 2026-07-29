import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, DollarSign, Stethoscope, Calendar, Check, ArrowLeft } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Button } from '@/components/ui/ds/Button';

interface FollowUpWizardProps {
  open: boolean;
  onClose: () => void;
  patient: { id: string; name: string };
  appointmentId?: string;
  onAction: (action: string, data?: any) => void;
}

type Step = 'select' | 'treatment_plan' | 'estimate' | 'diagnostics' | 'next_visit' | 'done';

export function FollowUpWizard({ open, onClose, patient, appointmentId, onAction }: FollowUpWizardProps) {
  const [step, setStep] = useState<Step>('select');
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: string) => {
    setLoading(true);
    onAction(action, { patientId: patient.id, appointmentId });
    setStep('done');
    setLoading(false);
  };

  const options = [
    {
      id: 'treatment_plan',
      icon: FileText,
      title: 'Создать план лечения',
      desc: 'Сформировать план процедур и реставраций',
      color: 'text-dv-gold border-dv-gold/30 hover:bg-dv-gold/10',
    },
    {
      id: 'estimate',
      icon: DollarSign,
      title: 'Создать смету',
      desc: 'Рассчитать стоимость лечения',
      color: 'text-success border-success/30 hover:bg-success/10',
    },
    {
      id: 'diagnostics',
      icon: Stethoscope,
      title: 'Направить на диагностику',
      desc: 'Выдать направление в диагностический центр',
      color: 'text-info border-info/30 hover:bg-info/10',
    },
    {
      id: 'next_visit',
      icon: Calendar,
      title: 'Записать на следующий приём',
      desc: 'Выбрать дату и время следующего визита',
      color: 'text-warning border-warning/30 hover:bg-warning/10',
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard padding="lg">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-dv-gold/10 flex items-center justify-center">
                    {step === 'done' ? <Check size={16} className="text-success" /> : <FileText size={16} className="text-dv-gold" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-txt-primary">
                      {step === 'select' && 'После приёма'}
                      {step === 'done' && 'Готово'}
                    </h3>
                    <p className="text-[10px] text-txt-muted">{patient.name}</p>
                  </div>
                </div>
                <button aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-1 text-txt-muted">
                  <X size={16} />
                </button>
              </div>

              {step === 'select' && (
                <div className="space-y-2">
                  <p className="text-xs text-txt-muted mb-3">Что делаем дальше с пациентом?</p>
                  {options.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleAction(opt.id)}
                      disabled={loading}
                      className={`w-full p-3 rounded-xl text-left transition-all border ${opt.color} ${loading ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-1 flex items-center justify-center flex-shrink-0">
                          <opt.icon size={15} className={opt.color.split(' ')[0]} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-txt-primary">{opt.title}</p>
                          <p className="text-[11px] text-txt-muted mt-0.5">{opt.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {step === 'done' && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                    <Check size={24} className="text-success" />
                  </div>
                  <p className="text-sm font-bold text-txt-primary">Действие отправлено AI</p>
                  <p className="text-xs text-txt-muted mt-1">AI обрабатывает запрос и вернётся с результатом</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-bdr-subtle/50">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Закрыть
                </Button>
                {step === 'done' && (
                  <Button variant="primary" size="sm" onClick={onClose}>
                    <Check size={14} className="mr-1" /> Готово
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
