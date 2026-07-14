import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, User, Heart, AlertTriangle, Pill, FileText, Phone, Shield, Plus, Search, Edit3, Save, X, Activity, Droplets, ThermometerSun } from 'lucide-react';
import { T, gid, today } from '../utils/constants';
import { useData, useToast } from '../hooks/useData';

const CARD_SECTIONS = [
  { id: 'personal', label: 'Личные данные', icon: <User size={16} /> },
  { id: 'medical', label: 'Медицинская карта', icon: <Stethoscope size={16} /> },
  { id: 'allergies', label: 'Аллергии и лекарства', icon: <AlertTriangle size={16} /> },
  { id: 'history', label: 'История болезней', icon: <FileText size={16} /> },
  { id: 'emergency', label: 'Экстренный контакт', icon: <Phone size={16} /> },
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function MedicalCard() {
  const { clinic, user } = useOutletContext();
  const { patients, medicalCards, upsertMedicalCard, visits } = useData(clinic?.id);
  const toast = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const [form, setForm] = useState({});

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
    await upsertMedicalCard(data);
    toast.success('Медицинская карта сохранена');
    setEditing(false);
  };

  const Field = ({ label, children }) => (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fade-in space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Stethoscope size={24} style={{ color: T.gold }} />
            Электронная медицинская карта
          </h1>
          <p className="mt-1 text-sm text-slate-500">Полная медицинская информация пациента (МКБ-10, аллергии, история)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Patient List */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
                    ? 'border border-[#C9A96E]/30 bg-[#C9A96E]/10 text-[#C9A96E]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-xs opacity-60">{p.phone || '—'}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Card Content */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedPatientId ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-20 text-center">
              <Stethoscope size={48} className="mb-3 text-slate-600" />
              <p className="text-lg font-semibold text-slate-500">Выберите пациента</p>
              <p className="text-sm text-slate-600">для просмотра медицинской карты</p>
            </div>
          ) : (
            <>
              {/* Patient Header */}
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedPatient?.name}</h2>
                  <p className="text-sm text-slate-500">
                    {selectedPatient?.dob ? `Дата рождения: ${selectedPatient.dob}` : ''}
                    {selectedPatient?.gender ? ` · ${selectedPatient.gender === 'M' ? 'Мужской' : 'Женский'}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button onClick={saveCard} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-black" style={{ background: T.emerald }}>
                        <Save size={14} /> Сохранить
                      </button>
                      <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 hover:text-white">
                        <X size={14} /> Отмена
                      </button>
                    </>
                  ) : (
                    <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-black" style={{ background: T.gold }}>
                      <Edit3 size={14} /> {existingCard ? 'Редактировать' : 'Создать карту'}
                    </button>
                  )}
                </div>
              </div>

              {/* Section Tabs */}
              <div className="flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
                {CARD_SECTIONS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                      activeSection === s.id ? 'bg-[#C9A96E]/15 text-[#C9A96E]' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>

              {/* Section Content */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                {activeSection === 'personal' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><User size={16} style={{ color: T.gold }} /> Личная информация</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">ФИО</p>
                        <p className="text-sm text-white font-semibold">{selectedPatient?.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Телефон</p>
                        <p className="text-sm text-white">{selectedPatient?.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Дата рождения</p>
                        <p className="text-sm text-white">{selectedPatient?.dob || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Адрес</p>
                        <p className="text-sm text-white">{selectedPatient?.address || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'medical' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Activity size={16} style={{ color: T.gold }} /> Медицинские данные</h3>
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
                          <p className="text-xs text-slate-500">Группа крови</p>
                          <p className="text-sm text-white font-bold">{existingCard?.blood_type || existingCard?.bloodType || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Страховая</p>
                          <p className="text-sm text-white">{existingCard?.insurance_provider || existingCard?.insuranceProvider || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Полис</p>
                          <p className="text-sm text-white">{existingCard?.insurance_number || existingCard?.insuranceNumber || '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'allergies' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><AlertTriangle size={16} style={{ color: T.ruby }} /> Аллергии и лекарства</h3>
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
                        <div className="rounded-lg bg-[#E74C3C]/8 border border-[#E74C3C]/15 p-3">
                          <p className="text-xs font-semibold text-[#E74C3C] mb-1">Аллергии</p>
                          <p className="text-sm text-white">{existingCard?.allergies || 'Нет известных аллергий'}</p>
                        </div>
                        <div className="rounded-lg bg-[#2980B9]/8 border border-[#2980B9]/15 p-3">
                          <p className="text-xs font-semibold text-[#2980B9] mb-1">Лекарства</p>
                          <p className="text-sm text-white">{existingCard?.medications || 'Не принимает'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'history' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><FileText size={16} style={{ color: T.sapphire }} /> История болезней</h3>
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
                        <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                          <p className="text-xs font-semibold text-slate-500 mb-1">Хронические заболевания</p>
                          <p className="text-sm text-white">{existingCard?.chronic_diseases || existingCard?.chronicDiseases || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                          <p className="text-xs font-semibold text-slate-500 mb-1">Операции</p>
                          <p className="text-sm text-white">{existingCard?.past_surgeries || existingCard?.pastSurgeries || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                          <p className="text-xs font-semibold text-slate-500 mb-1">Семейный анамнез</p>
                          <p className="text-sm text-white">{existingCard?.family_history || existingCard?.familyHistory || '—'}</p>
                        </div>
                      </div>
                    )}

                    {/* Visit History */}
                    <div className="mt-4">
                      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        <ThermometerSun size={14} /> История посещений ({patientVisits.length})
                      </h4>
                      {patientVisits.length === 0 ? (
                        <p className="text-sm text-slate-600">Посещений пока нет</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {patientVisits.map(v => (
                            <div key={v.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">{v.visit_date ? new Date(v.visit_date).toLocaleDateString('ru-RU') : '—'}</span>
                                <span className="text-xs font-semibold text-[#C9A96E]">{v.doctor_name || '—'}</span>
                              </div>
                              <p className="text-sm text-white mt-1">{v.diagnosis || 'Без диагноза'}</p>
                              {v.icd10_codes && <p className="text-xs text-[#C9A96E] mt-0.5">МКБ-10: {v.icd10_codes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === 'emergency' && (
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Phone size={16} style={{ color: T.amber }} /> Экстренный контакт</h3>
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
                        <div className="rounded-lg bg-[#F39C12]/8 border border-[#F39C12]/15 p-3">
                          <p className="text-xs font-semibold text-[#F39C12] mb-1">Контактное лицо</p>
                          <p className="text-sm text-white">{existingCard?.emergency_contact || existingCard?.emergencyContact || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-[#F39C12]/8 border border-[#F39C12]/15 p-3">
                          <p className="text-xs font-semibold text-[#F39C12] mb-1">Телефон</p>
                          <p className="text-sm text-white">{existingCard?.emergency_phone || existingCard?.emergencyPhone || '—'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
