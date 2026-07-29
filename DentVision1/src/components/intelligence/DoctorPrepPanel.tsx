import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, Calendar, FileText, Activity, Heart, AlertCircle, Check, Syringe, Stethoscope, ClipboardList } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Button } from '@/components/ui/ds/Button';

interface PatientBrief {
  id: string;
  name: string;
  phone?: string;
  iin?: string;
  birthDate?: string;
}

interface AppointmentBrief {
  id: string;
  date: string;
  status?: string;
  doctorName?: string;
}

interface DoctorPrepPanelProps {
  open: boolean;
  onClose: () => void;
  data: {
    patient: PatientBrief;
    appointment?: AppointmentBrief | null;
    complaints: string[];
    triage?: { specialty?: string; diagnosis?: string; reason?: string; urgency?: string } | null;
    diagnosis?: string;
    instruments: string[];
    hasCBCT?: boolean;
    imagesCount?: number;
    treatmentPlansCount?: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  'Срочно': 'bg-red-500/10 text-red-400 border-red-500/30',
  'Экстренно': 'bg-red-500/20 text-red-400 border-red-500/40',
  'Сегодня': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  'Обычная': 'bg-green-500/10 text-green-400 border-green-500/30',
};

export function DoctorPrepPanel({ open, onClose, data }: DoctorPrepPanelProps) {
  const { patient, appointment, complaints, triage, diagnosis, instruments, hasCBCT, imagesCount, treatmentPlansCount } = data;
  const urgencyClass = STATUS_COLORS[triage?.urgency || ''] || 'bg-surface-1 text-txt-muted';

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
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard padding="lg">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-dv-gold/10 flex items-center justify-center">
                    <Stethoscope size={18} className="text-dv-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-txt-primary">Подготовка к приёму</h3>
                    <p className="text-[10px] text-txt-muted">Брифинг AI</p>
                  </div>
                </div>
                <button aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-1 text-txt-muted">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Patient info */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-1">
                  <div className="w-10 h-10 rounded-full bg-dv-gold/10 flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-dv-gold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-txt-primary truncate">{patient.name}</p>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {patient.phone && (
                        <span className="flex items-center gap-1 text-[11px] text-txt-muted">
                          <Phone size={11} /> {patient.phone}
                        </span>
                      )}
                      {patient.iin && (
                        <span className="text-[11px] text-txt-muted">ИИН: {patient.iin}</span>
                      )}
                      {patient.birthDate && (
                        <span className="text-[11px] text-txt-muted">
                          {new Date(patient.birthDate).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Appointment time */}
                {appointment && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-dv-gold/5 border border-dv-gold/10">
                    <Calendar size={14} className="text-dv-gold" />
                    <span className="text-xs text-txt-primary">
                      Запись: <strong>{new Date(appointment.date).toLocaleString('ru-RU')}</strong>
                      {appointment.doctorName && ` • ${appointment.doctorName}`}
                    </span>
                  </div>
                )}

                {/* Complaints */}
                {complaints.length > 0 && (
                  <div>
                    <p className="text-[11px] text-txt-muted font-medium mb-2 flex items-center gap-1">
                      <FileText size={12} /> Жалобы пациента
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {complaints.map((c, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-warning/10 text-warning text-[11px] font-medium">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Triage result */}
                {triage && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-dv-gold/5 border border-dv-gold/20">
                      <p className="text-[10px] text-txt-muted mb-0.5">Специалист</p>
                      <p className="text-sm font-bold text-dv-gold">{triage.specialty}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${urgencyClass}`}>
                      <p className="text-[10px] text-txt-muted mb-0.5">Срочность</p>
                      <p className="text-sm font-bold">{triage.urgency}</p>
                    </div>
                  </div>
                )}

                {/* Diagnosis */}
                {(diagnosis || triage?.diagnosis) && (
                  <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                    <p className="text-[10px] text-txt-muted mb-0.5">Предварительный диагноз AI</p>
                    <p className="text-sm font-bold text-txt-primary">{diagnosis || triage?.diagnosis}</p>
                    {triage?.reason && (
                      <p className="text-[11px] text-txt-muted mt-1">{triage.reason}</p>
                    )}
                  </div>
                )}

                {/* Media indicators */}
                <div className="flex gap-2">
                  {hasCBCT && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-info/10 text-info text-[11px]">
                      <Activity size={12} /> КТ доступна
                    </span>
                  )}
                  {imagesCount != null && imagesCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-info/10 text-info text-[11px]">
                      <Heart size={12} /> {imagesCount} снимков
                    </span>
                  )}
                  {treatmentPlansCount != null && treatmentPlansCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-info/10 text-info text-[11px]">
                      <ClipboardList size={12} /> {treatmentPlansCount} планов
                    </span>
                  )}
                </div>

                {/* Instruments */}
                {instruments.length > 0 && (
                  <div>
                    <p className="text-[11px] text-txt-muted font-medium mb-2 flex items-center gap-1">
                      <Syringe size={12} /> Рекомендуемые инструменты
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {instruments.map((inst, i) => (
                        <span key={i} className="px-2.5 py-1.5 rounded-lg bg-surface-1 text-txt-primary text-[11px] border border-bdr-subtle">
                          {inst}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-bdr-subtle/50">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Закрыть
                </Button>
                <div className="flex gap-2">
                  {hasCBCT && (
                    <Button variant="outline" size="sm" onClick={onClose}>
                      <Activity size={14} className="mr-1" /> КТ
                    </Button>
                  )}
                  <Button variant="primary" size="sm" onClick={onClose}>
                    <Check size={14} className="mr-1" /> Начать приём
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
