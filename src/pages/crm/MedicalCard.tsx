import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, User, Heart, AlertTriangle, Pill, FileText, Phone, Shield, Plus, Search, Edit3, Save, X, Activity, Droplets, ThermometerSun, Microscope, Building2, Image as ImageIcon, Users, UserMinus } from 'lucide-react';
import { gid, today } from '../../utils/constants';
import { cn } from '@/lib/utils';
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
import { useWorkspaceStore } from '@/store/workspace.store';
import { AiInsightCard } from '@/components/patient/AiInsightCard';
import * as api from '@/utils/api';

const CARD_SECTIONS = [
  { id: 'personal', label: 'Личные данные', icon: <User size={16} /> },
  { id: 'medical', label: 'Медицинская карта', icon: <Stethoscope size={16} /> },
  { id: 'diagnostics', label: 'Диагностика', icon: <Microscope size={16} /> },
  { id: 'team', label: 'Ответственные', icon: <Users size={16} /> },
  { id: 'allergies', label: 'Аллергии и лекарства', icon: <AlertTriangle size={16} /> },
  { id: 'history', label: 'История болезней', icon: <FileText size={16} /> },
  { id: 'cross-clinic', label: 'Из других клиник', icon: <Building2 size={16} /> },
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
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { patients, medicalCards, upsertMedicalCard, visits, doctors } = useDataQuery(clinic?.id);
  const toast = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(params.get('patient'));

  useEffect(() => {
    const pid = params.get('patient');
    if (pid) {
      setSelectedPatientId(pid);
      void usePatientStore.getState().openPatient(pid);
    }
  }, [params]);

  // Context engine (Stage 10): the AI kernel fills a missing patientId
  // argument from this instead of asking the model to guess or re-ask.
  useEffect(() => {
    useWorkspaceStore.getState().setContextFocus(selectedPatientId ? 'patient' : 'workspace', selectedPatientId);
    return () => useWorkspaceStore.getState().clearContext();
  }, [selectedPatientId]);

  useEffect(() => {
    if (selectedPatientId) void usePatientStore.getState().openPatient(selectedPatientId);
  }, [selectedPatientId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const [ccHistory, setCcHistory] = useState<api.CrossClinicHistoryBlock[] | null>(null);
  const [ccLoading, setCcLoading] = useState(false);

  useEffect(() => {
    if (!selectedPatientId || activeSection !== 'cross-clinic') return;
    let cancelled = false;
    setCcLoading(true);
    api.getCrossClinicHistory(selectedPatientId)
      .then((blocks) => { if (!cancelled) setCcHistory(blocks); })
      .catch(() => { if (!cancelled) setCcHistory([]); })
      .finally(() => { if (!cancelled) setCcLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPatientId, activeSection]);
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
    <div className="dv-page fade-in max-w-full space-y-6 overflow-x-hidden py-4 md:py-6">
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
              className="min-h-11 w-full pl-9 sm:min-h-0"
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
                  <div className="flex flex-wrap gap-2">
                    {editing ? (
                      <>
                        <Button className="min-h-11 sm:min-h-0" variant="primary" icon={<Save size={14} />} onClick={saveCard}>Сохранить</Button>
                        <Button className="min-h-11 sm:min-h-0" variant="secondary" icon={<X size={14} />} onClick={() => setEditing(false)}>Отмена</Button>
                      </>
                    ) : (
                      <Button className="min-h-11 sm:min-h-0" variant="primary" icon={<Edit3 size={14} />} onClick={startEdit}>
                        {existingCard ? 'Редактировать' : 'Создать карту'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              <AiInsightCard patientId={selectedPatientId} />

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
                          <select className="dv-select min-h-11 sm:min-h-0" value={form.bloodType} onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))}>
                            <option value="">—</option>
                            {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </Field>
                        <Field label="Страховая компания">
                          <input className="min-h-11 sm:min-h-0" value={form.insuranceProvider} onChange={e => setForm(f => ({ ...f, insuranceProvider: e.target.value }))} placeholder="Название страховщика" />
                        </Field>
                        <Field label="Номер полиса">
                          <input className="min-h-11 sm:min-h-0" value={form.insuranceNumber} onChange={e => setForm(f => ({ ...f, insuranceNumber: e.target.value }))} placeholder="Номер полиса" />
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

                {activeSection === 'diagnostics' && selectedPatientId && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary"><Microscope size={16} className="text-dv-gold" /> Диагностические направления</h3>
                      <Button size="sm" variant="outline" icon={<Plus size={14} />}
                        onClick={() => navigate(`/diagnostics/referrals/new?patientId=${selectedPatientId}&patientName=${encodeURIComponent(patients.find(p => p.id === selectedPatientId)?.name || '')}&patientPhone=${patients.find(p => p.id === selectedPatientId)?.phone || ''}`)}>
                        Новое
                      </Button>
                    </div>
                    <DiagnosticsList patientId={selectedPatientId} />
                  </div>
                )}

                {activeSection === 'team' && selectedPatientId && (
                  <ResponsibleStaff patientId={selectedPatientId} staff={doctors} />
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

                {activeSection === 'cross-clinic' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
                      <Building2 size={16} className="text-sky-400" /> История из других клиник
                    </h3>
                    <p className="text-xs text-txt-muted">
                      Данные ниже — только для чтения и приходят из карты пациента в другой клинике
                      по его личному согласию. Они не сливаются с картой этой клиники — любые записи
                      о лечении здесь ведутся отдельно, как обычно.
                    </p>
                    {ccLoading ? (
                      <p className="text-sm text-txt-ghost">Загрузка…</p>
                    ) : !ccHistory || ccHistory.length === 0 ? (
                      <EmptyState
                        icon={<Building2 size={28} />}
                        title="Нет доступа к данным других клиник"
                        description="На вкладке пациента нажмите «Запросить историю из других клиник» — доступ откроется после подтверждения пациентом в его личном кабинете."
                      />
                    ) : (
                      <div className="space-y-5">
                        {ccHistory.map((block, i) => (
                          <div key={i} className="rounded-lg border border-bdr-subtle bg-surface-raised p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="flex items-center gap-2 text-sm font-bold text-dv-gold">
                                <Building2 size={14} /> {block.sourceClinic.name}
                              </span>
                              <Badge variant="default" size="sm">только чтение</Badge>
                            </div>

                            {block.visits.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-txt-muted mb-1">Визиты ({block.visits.length})</p>
                                <div className="space-y-2">
                                  {block.visits.map((v) => (
                                    <div key={v.id} className="rounded-lg bg-white/5 border border-bdr-subtle p-2.5">
                                      <div className="flex justify-between text-xs text-txt-muted">
                                        <span>{new Date(v.date).toLocaleDateString('ru-RU')}</span>
                                      </div>
                                      <p className="text-sm text-txt-primary mt-1">{v.diagnosis || 'Без диагноза'}</p>
                                      {v.complaints && <p className="text-xs text-txt-muted mt-0.5">Жалобы: {v.complaints}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {block.treatmentPlans.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-txt-muted mb-1">Планы лечения ({block.treatmentPlans.length})</p>
                                <div className="space-y-2">
                                  {block.treatmentPlans.map((p) => (
                                    <div key={p.id} className="rounded-lg bg-white/5 border border-bdr-subtle p-2.5 flex justify-between items-center">
                                      <span className="text-sm text-txt-primary">{p.title}</span>
                                      <Badge variant="default" size="sm">{p.status}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(block.images.length > 0 || block.documents.length > 0) && (
                              <div>
                                <p className="text-xs font-semibold text-txt-muted mb-1">Снимки и документы ({block.images.length + block.documents.length})</p>
                                <div className="flex flex-wrap gap-2">
                                  {[...block.images, ...block.documents].map((f) => (
                                    f.url ? (
                                      <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-1.5 text-xs text-dv-gold hover:underline rounded-lg bg-white/5 border border-bdr-subtle px-2.5 py-1.5">
                                        <ImageIcon size={12} /> {f.name || f.type}
                                      </a>
                                    ) : (
                                      <span key={f.id} className="flex items-center gap-1.5 text-xs text-txt-ghost rounded-lg bg-white/5 border border-bdr-subtle px-2.5 py-1.5">
                                        <ImageIcon size={12} /> {f.name || f.type} (недоступно)
                                      </span>
                                    )
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'emergency' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary"><Phone size={16} className="text-amber-400" /> Экстренный контакт</h3>
                    {editing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Контактное лицо">
                          <input className="min-h-11 sm:min-h-0" value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} placeholder="ФИО контактного лица" />
                        </Field>
                        <Field label="Телефон">
                          <input className="min-h-11 sm:min-h-0" value={form.emergencyPhone} onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))} placeholder="+7..." />
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

function DiagnosticsList({ patientId }: { patientId: string }) {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getDiagnosticReferrals({ patientId, limit: '50' });
        if (!cancelled) setReferrals(res?.items || res?.data || []);
      } catch {
        if (!cancelled) setReferrals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  if (loading) return <p className="text-xs text-txt-muted">Загрузка...</p>;
  if (referrals.length === 0) return <p className="text-xs text-txt-muted">Нет направлений</p>;

  return (
    <div className="space-y-2">
      {referrals.map((r: any) => (
        <button key={r.id} onClick={() => navigate(`/diagnostics/referrals/${r.id}`)}
          className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-bdr-subtle bg-white/[0.02] hover:bg-surface-1 transition-colors">
          <div className={cn(
            'w-2 h-2 rounded-full mt-1.5 shrink-0',
            r.status === 'COMPLETED' ? 'bg-success' : r.status === 'ACCEPTED' ? 'bg-warning' : 'bg-txt-muted',
          )} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-txt-primary">{r.studyType || '—'}</p>
              <Badge variant="outline" size="xs">{r.status}</Badge>
            </div>
            <p className="text-xs text-txt-muted mt-0.5">{r.center?.name || r.lab?.name || '—'}</p>
            <p className="text-xs text-txt-muted">{r.cost ? `${Number(r.cost).toLocaleString()} ₸` : ''} {r.paid ? '· Оплачено' : ''}</p>
          </div>
          <p className="text-xs text-txt-ghost shrink-0">{new Date(r.createdAt).toLocaleDateString()}</p>
        </button>
      ))}
    </div>
  );
}

const ASSIGNMENT_ROLE_LABELS: Record<string, string> = {
  treating_doctor: 'Лечащий врач',
  assistant: 'Ассистент',
  coordinator: 'Координатор',
};

/**
 * Who is responsible for this patient.
 *
 * The list fills itself as appointments are booked — a doctor booked with a
 * patient becomes their treating doctor. Editing here is for the exceptions:
 * a second opinion, an assistant who should see the card, or someone who no
 * longer treats this patient.
 */
function ResponsibleStaff({ patientId, staff }: { patientId: string; staff: UserType[] }) {
  const toast = useToast();
  const [rows, setRows] = useState<api.PatientAssignment[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickedUser, setPickedUser] = useState('');
  const [pickedRole, setPickedRole] = useState<api.PatientAssignmentRole>('treating_doctor');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    api.getPatientAssignments(patientId)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [patientId]);

  const assignedIds = useMemo(() => new Set((rows || []).map((r) => `${r.userId}:${r.role}`)), [rows]);
  const available = useMemo(
    () => staff.filter((s) => !assignedIds.has(`${s.id}:${pickedRole}`)),
    [staff, assignedIds, pickedRole],
  );

  async function handleAdd() {
    if (!pickedUser) return;
    setBusy(true);
    try {
      setRows(await api.addPatientAssignment(patientId, pickedUser, pickedRole));
      setAdding(false);
      setPickedUser('');
      toast.success('Ответственный назначен');
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось назначить');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(assignment: api.PatientAssignment) {
    setBusy(true);
    try {
      await api.removePatientAssignment(patientId, assignment.id);
      setRows((prev) => (prev || []).filter((r) => r.id !== assignment.id));
      toast.success(`${assignment.name} снят${assignment.role === 'treating_doctor' ? '' : 'а'} с пациента`);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось снять');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <Users size={16} className="text-dv-gold" /> Ответственные за пациента
        </h3>
        {!adding && (
          <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Добавить
          </Button>
        )}
      </div>

      <p className="text-xs text-txt-muted">
        Заполняется само: врач, к которому записан пациент, становится лечащим. Список нужен ассистенту ИИ,
        чтобы понимать, чей это пациент — доступ сотрудников к карте он не ограничивает.
      </p>

      {adding && (
        <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl border border-bdr-subtle bg-white/[0.02]">
          <select
            value={pickedUser}
            onChange={(e) => setPickedUser(e.target.value)}
            className="flex-1 min-h-11 px-3 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary focus:outline-none focus:ring-2 focus:ring-dv-gold/40"
          >
            <option value="">Выберите сотрудника</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>{s.name || 'Без имени'}</option>
            ))}
          </select>
          <select
            value={pickedRole}
            onChange={(e) => setPickedRole(e.target.value as api.PatientAssignmentRole)}
            className="sm:w-48 min-h-11 px-3 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary focus:outline-none focus:ring-2 focus:ring-dv-gold/40"
          >
            {Object.entries(ASSIGNMENT_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!pickedUser || busy}>Назначить</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setPickedUser(''); }}>Отмена</Button>
          </div>
        </div>
      )}

      {rows === null && <p className="text-xs text-txt-muted">Загрузка...</p>}

      {rows !== null && rows.length === 0 && (
        <EmptyState
          icon={<Users size={24} />}
          title="Пока никто не назначен"
          description="Появится автоматически, как только пациента запишут на приём."
        />
      )}

      {rows !== null && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 p-3 rounded-xl border border-bdr-subtle bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-txt-primary">{row.name}</p>
                  <Badge variant="outline" size="xs">{ASSIGNMENT_ROLE_LABELS[row.role] || row.role}</Badge>
                </div>
                <p className="text-xs text-txt-muted mt-0.5">
                  {row.spec || row.systemRole || '—'} · с {new Date(row.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<UserMinus size={14} />}
                disabled={busy}
                onClick={() => handleRemove(row)}
              >
                Снять
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
