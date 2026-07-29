import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, User, Heart, AlertTriangle, Pill, FileText, Phone, Shield, Plus, Search, Edit3, Save, X, Activity, Droplets, ThermometerSun } from 'lucide-react';
import { gid, today } from '../../utils/constants';
import { useToast } from '@/components/ui/ds/Toast'
import { useDataQuery } from '../../queries/useDataQuery';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Button } from '../../components/ui/ds/Button';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';
import { Tabs } from '../../components/ui/ds/Misc';
import type { Patient, MedicalCard as MedicalCardType, Visit, Clinic, User as UserType, RoleInfo } from '../../types';
import { usePatientStore } from '@/store/patient.store';

const CARD_SECTIONS = [
  { id: 'personal', label: 'Личные данные', icon: <User size={16} /> },
  { id: 'medical', label: 'Медицинская карта', icon: <Stethoscope size={16} /> },
  { id: 'allergies', label: 'Аллергии и лекарства', icon: <AlertTriangle size={16} /> },
  { id: 'history', label: 'История болезней', icon: <FileText size={16} /> },
  { id: 'emergency', label: 'Экстренный контакт', icon: <Phone size={16} /> },
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface OutletContext {
  clinic: Clinic & { id: string }
  user: UserType
  roleInfo?: RoleInfo
}

interface MedicalCardForm {
  bloodType: string
  allergies: string
  chronicDiseases: string
  medications: string
  pastSurgeries: string
  familyHistory: string
  emergencyContact: string
  emergencyPhone: string
  insuranceProvider: string
  insuranceNumber: string
  notes: string
}

export default function MedicalCard() {
  const { clinic, user } = useOutletContext<OutletContext>();
  const [params] = useSearchParams();
  const { patients, medicalCards, upsertMedicalCard, visits } = useDataQuery(clinic?.id);
  const toast = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(params.get('patient'));

  useEffect(() => {
    const pid = params.get('patient');
    if (pid) {
      setSelectedPatientId(pid);
      void usePatientStore.getState().openPatient(pid);
    }
  }, [params]);

  useEffect(() => {
    if (selectedPatientId) void usePatientStore.getState().openPatient(selectedPatientId);
  }, [selectedPatientId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const [form, setForm] = useState<MedicalCardForm>({
    bloodType: '', allergies: '', chronicDiseases: '', medications: '',
    pastSurgeries: '', familyHistory: '', emergencyContact: '', emergencyPhone: '',
    insuranceProvider: '', insuranceNumber: '', notes: '',
  });

  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    const q = searchQuery.toLowerCase();
    return patients.filter(p => !q || p.name?.toLowerCase().includes(q) || p.phone?.includes(q));
  }, [patients, searchQuery]);

  const selectedPatient = patients?.find(p => p.id === selectedPatientId);
  const existingCard = medicalCards?.find(m => m.patientId === selectedPatientId);
  const patientVisits = useMemo(() => (visits || []).filter(v => v.patientId === selectedPatientId), [visits, selectedPatientId]);

  const startEdit = () => {
    setForm({
      bloodType: existingCard?.bloodType || '',
      allergies: existingCard?.allergies || '',
      chronicDiseases: existingCard?.chronicDiseases || '',
      medications: (existingCard as any)?.medications || '',
      pastSurgeries: existingCard?.pastSurgeries || '',
      familyHistory: existingCard?.familyHistory || '',
      emergencyContact: existingCard?.emergencyContact || '',
      emergencyPhone: existingCard?.emergencyPhone || '',
      insuranceProvider: existingCard?.insuranceProvider || '',
      insuranceNumber: existingCard?.insuranceNumber || '',
      notes: existingCard?.notes || '',
    });
    setEditing(true);
  };

  const saveCard = async () => {
    const data = {
      id: existingCard?.id || gid(),
      patientId: selectedPatientId,
      clinicId: clinic.id,
      ...form,
      userId: user?.id,
    } as any;
    try {
      await upsertMedicalCard(data as any);
      toast.success('Медицинская карта сохранена');
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сохранить медкарту');
    }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-txt-muted">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="dv-page fade-in space-y-6 py-4 md:py-6">
      <PageHeader
        title="Электронная медицинская карта"
        subtitle="Полная медицинская информация пациента (МКБ-10, аллергии, история)"
        icon={<Stethoscope size={24} className="text-dv-gold" />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Patient List */}
        <Card className="p-4">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input
              placeholder="Поиск пациента..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[500px] space-y-1 overflow-y-auto">
            {filteredPatients.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPatientId(p.id); setEditing(false); setActiveSection('personal'); void usePatientStore.getState().openPatient(p.id); }}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-all ${
                  selectedPatientId === p.id
                    ? 'border border-dv-gold/30 bg-dv-gold/10 text-dv-gold'
                    : 'text-txt-secondary hover:bg-white/5 hover:text-txt-primary'
                }`}
              >
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-xs opacity-60">{p.phone || '—'}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Card Content */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedPatientId ? (
            <EmptyState
              icon={<Stethoscope size={48} />}
              title="Выберите пациента"
              description="для просмотра медицинской карты"
            />
          ) : (
            <>
              {/* Patient Header */}
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-txt-primary">{selectedPatient?.name}</h2>
                    <p className="text-sm text-txt-muted">
                      {selectedPatient?.dob ? `Дата рождения: ${selectedPatient.dob}` : ''}
                      {selectedPatient?.gender ? ` · ${selectedPatient.gender === 'M' ? 'Мужской' : 'Женский'}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <Button variant="primary" icon={<Save size={14} />} onClick={saveCard}>Сохранить</Button>
                        <Button variant="secondary" icon={<X size={14} />} onClick={() => setEditing(false)}>Отмена</Button>
                      </>
                    ) : (
                      <Button variant="primary" icon={<Edit3 size={14} />} onClick={startEdit}>
                        {existingCard ? 'Редактировать' : 'Создать карту'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Section Tabs */}
              <Tabs
                tabs={CARD_SECTIONS.map(s => ({ id: s.id, label: s.label, icon: s.icon }))}
                active={activeSection}
                onChange={setActiveSection}
              />

              {/* Section Content */}
              <Card className="p-5">
                {activeSection === 'personal' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary"><User size={16} className="text-dv-gold" /> Личная информация</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-txt-muted">ФИО</p>
                        <p className="text-sm text-txt-primary font-semibold">{selectedPatient?.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-txt-muted">Телефон</p>
                        <p className="text-sm text-txt-primary">{selectedPatient?.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-txt-muted">Дата рождения</p>
                        <p className="text-sm text-txt-primary">{selectedPatient?.dob || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-txt-muted">Адрес</p>
                        <p className="text-sm text-txt-primary">{selectedPatient?.address || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'medical' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary"><Activity size={16} className="text-dv-gold" /> Медицинские данные</h3>
                    {editing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Группа крови">
                          <select className="dv-select" value={form.bloodType} onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))}>
                            <option value="">—</option>
                            {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </Field>
                        <Field label="Страховая компания">
                          <input value={form.insuranceProvider} onChange={e => setForm(f => ({ ...f, insuranceProvider: e.target.value }))} placeholder="Название страховщика" />
                        </Field>
                        <Field label="Номер полиса">
                          <input value={form.insuranceNumber} onChange={e => setForm(f => ({ ...f, insuranceNumber: e.target.value }))} placeholder="Номер полиса" />
                        </Field>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-txt-muted">Группа крови</p>
                          <p className="text-sm text-txt-primary font-bold">{existingCard?.bloodType || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-txt-muted">Страховая</p>
                          <p className="text-sm text-txt-primary">{existingCard?.insuranceProvider || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-txt-muted">Полис</p>
                          <p className="text-sm text-txt-primary">{existingCard?.insuranceNumber || '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'allergies' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary"><AlertTriangle size={16} className="text-error" /> Аллергии и лекарства</h3>
                    {editing ? (
                      <div className="space-y-4">
                        <Field label="Аллергии">
                          <textarea rows={3} value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} placeholder="Перечислите известные аллергии..." />
                        </Field>
                        <Field label="Текущие лекарства">
                          <textarea rows={3} value={form.medications} onChange={e => setForm(f => ({ ...f, medications: e.target.value }))} placeholder="Принимаемые лекарства..." />
                        </Field>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-error/8 border border-error/15 p-3">
                          <p className="text-xs font-semibold text-error mb-1">Аллергии</p>
                          <p className="text-sm text-txt-primary">{existingCard?.allergies || 'Нет известных аллергий'}</p>
                        </div>
                        <div className="rounded-lg bg-sky-500/8 border border-sky-500/15 p-3">
                          <p className="text-xs font-semibold text-sky-400 mb-1">Лекарства</p>
                          <p className="text-sm text-txt-primary">{(existingCard as any)?.medications || 'Не принимает'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'history' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary"><FileText size={16} className="text-sky-400" /> История болезней</h3>
                    {editing ? (
                      <div className="space-y-4">
                        <Field label="Хронические заболевания">
                          <textarea rows={3} value={form.chronicDiseases} onChange={e => setForm(f => ({ ...f, chronicDiseases: e.target.value }))} placeholder="Хронические заболевания..." />
                        </Field>
                        <Field label="Перенесённые операции">
                          <textarea rows={3} value={form.pastSurgeries} onChange={e => setForm(f => ({ ...f, pastSurgeries: e.target.value }))} placeholder="Операции и вмешательства..." />
                        </Field>
                        <Field label="Семейный анамнез">
                          <textarea rows={2} value={form.familyHistory} onChange={e => setForm(f => ({ ...f, familyHistory: e.target.value }))} placeholder="Наследственные заболевания..." />
                        </Field>
                        <Field label="Примечания">
                          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Доп. информация..." />
                        </Field>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-white/5 border border-bdr-subtle p-3">
                          <p className="text-xs font-semibold text-txt-muted mb-1">Хронические заболевания</p>
                          <p className="text-sm text-txt-primary">{existingCard?.chronicDiseases || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-bdr-subtle p-3">
                          <p className="text-xs font-semibold text-txt-muted mb-1">Операции</p>
                          <p className="text-sm text-txt-primary">{existingCard?.pastSurgeries || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-bdr-subtle p-3">
                          <p className="text-xs font-semibold text-txt-muted mb-1">Семейный анамнез</p>
                          <p className="text-sm text-txt-primary">{existingCard?.familyHistory || '—'}</p>
                        </div>
                      </div>
                    )}

                    {/* Visit History */}
                    <div className="mt-4">
                      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-txt-muted mb-2">
                        <ThermometerSun size={14} /> История посещений ({patientVisits.length})
                      </h4>
                      {patientVisits.length === 0 ? (
                        <p className="text-sm text-txt-ghost">Посещений пока нет</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {patientVisits.map(v => (
                            <div key={v.id} className="rounded-lg border border-bdr-subtle bg-surface-raised p-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-txt-muted">{v.visitDate ? new Date(v.visitDate).toLocaleDateString('ru-RU') : '—'}</span>
                                <span className="text-xs font-semibold text-dv-gold">{(v as any).doctor_name || '—'}</span>
                              </div>
                              <p className="text-sm text-txt-primary mt-1">{(v as any).diagnosis || 'Без диагноза'}</p>
                              {v.icd10Codes && <p className="text-xs text-dv-gold mt-0.5">МКБ-10: {v.icd10Codes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === 'emergency' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary"><Phone size={16} className="text-amber-400" /> Экстренный контакт</h3>
                    {editing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Контактное лицо">
                          <input value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} placeholder="ФИО контактного лица" />
                        </Field>
                        <Field label="Телефон">
                          <input value={form.emergencyPhone} onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))} placeholder="+7..." />
                        </Field>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-lg bg-amber-500/8 border border-amber-500/15 p-3">
                          <p className="text-xs font-semibold text-amber-400 mb-1">Контактное лицо</p>
                          <p className="text-sm text-txt-primary">{existingCard?.emergencyContact || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-amber-500/8 border border-amber-500/15 p-3">
                          <p className="text-xs font-semibold text-amber-400 mb-1">Телефон</p>
                          <p className="text-sm text-txt-primary">{existingCard?.emergencyPhone || '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
