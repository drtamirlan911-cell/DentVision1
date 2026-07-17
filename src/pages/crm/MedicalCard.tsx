import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, User, Heart, AlertTriangle, Pill, FileText, Phone, Shield, Plus, Search, Edit3, Save, X, Activity, Droplets, ThermometerSun } from 'lucide-react';
import { gid, today } from '../../utils/constants';
import { useToast } from '@/components/ui/ds/Toast'
import { useData } from '../../hooks/useData';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Button } from '../../components/ui/ds/Button';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';
import { Tabs } from '../../components/ui/ds/Misc';
import type { Patient, MedicalCard as MedicalCardType, Visit, Clinic, User as UserType, RoleInfo } from '../../types';

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
  blood_type: string
  allergies: string
  chronic_diseases: string
  medications: string
  past_surgeries: string
  family_history: string
  emergency_contact: string
  emergency_phone: string
  insurance_provider: string
  insurance_number: string
  notes: string
}

export default function MedicalCard() {
  const { clinic, user } = useOutletContext<OutletContext>();
  const { patients, medicalCards, upsertMedicalCard, visits } = useData(clinic?.id);
  const toast = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const [form, setForm] = useState<MedicalCardForm>({
    blood_type: '', allergies: '', chronic_diseases: '', medications: '',
    past_surgeries: '', family_history: '', emergency_contact: '', emergency_phone: '',
    insurance_provider: '', insurance_number: '', notes: '',
  });

  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    const q = searchQuery.toLowerCase();
    return patients.filter(p => !q || p.name?.toLowerCase().includes(q) || p.phone?.includes(q));
  }, [patients, searchQuery]);

  const selectedPatient = patients?.find(p => p.id === selectedPatientId);
  const existingCard = medicalCards?.find(m => m.patient_id === selectedPatientId || m.patientId === selectedPatientId);
  const patientVisits = useMemo(() => (visits || []).filter(v => v.patient_id === selectedPatientId || v.patientId === selectedPatientId), [visits, selectedPatientId]);

  const startEdit = () => {
    setForm({
      blood_type: existingCard?.blood_type || existingCard?.bloodType || '',
      allergies: existingCard?.allergies || '',
      chronic_diseases: existingCard?.chronic_diseases || existingCard?.chronicDiseases || '',
      medications: existingCard?.medications || '',
      past_surgeries: existingCard?.past_surgeries || existingCard?.pastSurgeries || '',
      family_history: existingCard?.family_history || existingCard?.familyHistory || '',
      emergency_contact: existingCard?.emergency_contact || existingCard?.emergencyContact || '',
      emergency_phone: existingCard?.emergency_phone || existingCard?.emergencyPhone || '',
      insurance_provider: existingCard?.insurance_provider || existingCard?.insuranceProvider || '',
      insurance_number: existingCard?.insurance_number || existingCard?.insuranceNumber || '',
      notes: existingCard?.notes || '',
    });
    setEditing(true);
  };

  const saveCard = async () => {
    const data = {
      id: existingCard?.id || gid(),
      patient_id: selectedPatientId,
      clinic_id: clinic.id,
      ...form,
      user_id: user?.id,
      user_name: user?.name,
    };
    await upsertMedicalCard(data as any);
    toast.success('Медицинская карта сохранена');
    setEditing(false);
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-txt-muted">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fade-in space-y-6">
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
                onClick={() => { setSelectedPatientId(p.id); setEditing(false); setActiveSection('personal'); }}
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
                <div className="flex items-center justify-between">
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
                activeTab={activeSection}
                onChange={setActiveSection}
              />

              {/* Section Content */}
              <Card className="p-5">
                {activeSection === 'personal' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary"><User size={16} className="text-dv-gold" /> Личная информация</h3>
                    <div className="grid grid-cols-2 gap-4">
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
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Группа крови">
                          <select value={form.blood_type} onChange={e => setForm(f => ({ ...f, blood_type: e.target.value }))}>
                            <option value="">—</option>
                            {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </Field>
                        <Field label="Страховая компания">
                          <input value={form.insurance_provider} onChange={e => setForm(f => ({ ...f, insurance_provider: e.target.value }))} placeholder="Название страховщика" />
                        </Field>
                        <Field label="Номер полиса">
                          <input value={form.insurance_number} onChange={e => setForm(f => ({ ...f, insurance_number: e.target.value }))} placeholder="Номер полиса" />
                        </Field>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-txt-muted">Группа крови</p>
                          <p className="text-sm text-txt-primary font-bold">{existingCard?.blood_type || existingCard?.bloodType || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-txt-muted">Страховая</p>
                          <p className="text-sm text-txt-primary">{existingCard?.insurance_provider || existingCard?.insuranceProvider || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-txt-muted">Полис</p>
                          <p className="text-sm text-txt-primary">{existingCard?.insurance_number || existingCard?.insuranceNumber || '—'}</p>
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
                          <p className="text-sm text-txt-primary">{existingCard?.medications || 'Не принимает'}</p>
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
                          <textarea rows={3} value={form.chronic_diseases} onChange={e => setForm(f => ({ ...f, chronic_diseases: e.target.value }))} placeholder="Хронические заболевания..." />
                        </Field>
                        <Field label="Перенесённые операции">
                          <textarea rows={3} value={form.past_surgeries} onChange={e => setForm(f => ({ ...f, past_surgeries: e.target.value }))} placeholder="Операции и вмешательства..." />
                        </Field>
                        <Field label="Семейный анамнез">
                          <textarea rows={2} value={form.family_history} onChange={e => setForm(f => ({ ...f, family_history: e.target.value }))} placeholder="Наследственные заболевания..." />
                        </Field>
                        <Field label="Примечания">
                          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Доп. информация..." />
                        </Field>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-white/5 border border-bdr-subtle p-3">
                          <p className="text-xs font-semibold text-txt-muted mb-1">Хронические заболевания</p>
                          <p className="text-sm text-txt-primary">{existingCard?.chronic_diseases || existingCard?.chronicDiseases || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-bdr-subtle p-3">
                          <p className="text-xs font-semibold text-txt-muted mb-1">Операции</p>
                          <p className="text-sm text-txt-primary">{existingCard?.past_surgeries || existingCard?.pastSurgeries || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-bdr-subtle p-3">
                          <p className="text-xs font-semibold text-txt-muted mb-1">Семейный анамнез</p>
                          <p className="text-sm text-txt-primary">{existingCard?.family_history || existingCard?.familyHistory || '—'}</p>
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
                                <span className="text-xs text-txt-muted">{v.visit_date ? new Date(v.visit_date).toLocaleDateString('ru-RU') : '—'}</span>
                                <span className="text-xs font-semibold text-dv-gold">{v.doctor_name || '—'}</span>
                              </div>
                              <p className="text-sm text-txt-primary mt-1">{v.diagnosis || 'Без диагноза'}</p>
                              {v.icd10_codes && <p className="text-xs text-dv-gold mt-0.5">МКБ-10: {v.icd10_codes}</p>}
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
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Контактное лицо">
                          <input value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="ФИО контактного лица" />
                        </Field>
                        <Field label="Телефон">
                          <input value={form.emergency_phone} onChange={e => setForm(f => ({ ...f, emergency_phone: e.target.value }))} placeholder="+7..." />
                        </Field>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-amber-500/8 border border-amber-500/15 p-3">
                          <p className="text-xs font-semibold text-amber-400 mb-1">Контактное лицо</p>
                          <p className="text-sm text-txt-primary">{existingCard?.emergency_contact || existingCard?.emergencyContact || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-amber-500/8 border border-amber-500/15 p-3">
                          <p className="text-xs font-semibold text-amber-400 mb-1">Телефон</p>
                          <p className="text-sm text-txt-primary">{existingCard?.emergency_phone || existingCard?.emergencyPhone || '—'}</p>
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
