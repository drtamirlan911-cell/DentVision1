import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, Search, Edit3, Save, X, Stethoscope, User, Calendar, FileText, Pill } from 'lucide-react';
import { T, gid, today } from '../utils/constants';
import { useData, useToast } from '../hooks/useData';

export default function Visits() {
  const { clinic, user } = useOutletContext();
  const { patients, doctors, visits, upsertVisit } = useData(clinic?.id);
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    patient_id: '', doctor_id: '', chief_complaint: '', diagnosis: '',
    icd10_codes: '', treatment_plan: '', procedures_done: '',
    prescriptions: '', next_visit_date: '', notes: '',
  });

  const filteredVisits = useMemo(() => {
    if (!visits) return [];
    const q = searchQuery.toLowerCase();
    return visits.filter(v =>
      !q || v.patient_name?.toLowerCase().includes(q) ||
      v.doctor_name?.toLowerCase().includes(q) ||
      v.diagnosis?.toLowerCase().includes(q) ||
      v.icd10_codes?.toLowerCase().includes(q)
    );
  }, [visits, searchQuery]);

  const resetForm = () => {
    setForm({ patient_id: '', doctor_id: '', chief_complaint: '', diagnosis: '', icd10_codes: '', treatment_plan: '', procedures_done: '', prescriptions: '', next_visit_date: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (visit) => {
    setForm({
      patient_id: visit.patient_id || visit.patientId || '',
      doctor_id: visit.doctor_id || visit.doctorId || '',
      chief_complaint: visit.chief_complaint || '',
      diagnosis: visit.diagnosis || '',
      icd10_codes: visit.icd10_codes || '',
      treatment_plan: visit.treatment_plan || '',
      procedures_done: visit.procedures_done || '',
      prescriptions: visit.prescriptions || '',
      next_visit_date: visit.next_visit_date || '',
      notes: visit.notes || '',
    });
    setEditingId(visit.id);
    setShowForm(true);
  };

  const saveVisit = async () => {
    if (!form.patient_id) { toast.error('Выберите пациента'); return; }
    await upsertVisit({
      id: editingId || gid(),
      ...form,
      clinic_id: clinic.id,
      user_id: user?.id,
      user_name: user?.name,
    });
    toast.success(editingId ? 'Посещение обновлено' : 'Посещение добавлено');
    resetForm();
  };

  return (
    <div className="fade-in space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList size={24} style={{ color: T.gold }} />
            Журнал посещений
          </h1>
          <p className="mt-1 text-sm text-slate-500">Все визиты пациентов с диагнозами и МКБ-10</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-black"
          style={{ background: T.gold }}
        >
          <Plus size={16} /> Новое посещение
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Stethoscope size={16} style={{ color: T.gold }} />
              {editingId ? 'Редактирование посещения' : 'Новое посещение'}
            </h3>
            <button onClick={resetForm} className="text-slate-500 hover:text-white"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Пациент *</label>
              <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}>
                <option value="">Выберите...</option>
                {(patients || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Врач</label>
              <select value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
                <option value="">Выберите...</option>
                {(doctors || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Код МКБ-10</label>
              <input value={form.icd10_codes} onChange={e => setForm(f => ({ ...f, icd10_codes: e.target.value }))} placeholder="K02.1, K04.0..." />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Жалобы пациента</label>
              <textarea rows={2} value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))} placeholder="На что жалуется пациент..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Диагноз</label>
              <textarea rows={2} value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="Поставленный диагноз..." />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">План лечения</label>
              <textarea rows={2} value={form.treatment_plan} onChange={e => setForm(f => ({ ...f, treatment_plan: e.target.value }))} placeholder="План лечения..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Выполненные процедуры</label>
              <textarea rows={2} value={form.procedures_done} onChange={e => setForm(f => ({ ...f, procedures_done: e.target.value }))} placeholder="Что было сделано..." />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Назначения</label>
              <textarea rows={2} value={form.prescriptions} onChange={e => setForm(f => ({ ...f, prescriptions: e.target.value }))} placeholder="Лекарства, рекомендации..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Следующий визит</label>
                <input type="date" value={form.next_visit_date} onChange={e => setForm(f => ({ ...f, next_visit_date: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Примечания</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="..." />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 hover:text-white">Отмена</button>
            <button onClick={saveVisit} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-black" style={{ background: T.emerald }}>
              <Save size={14} /> {editingId ? 'Обновить' : 'Добавить'}
            </button>
          </div>
        </motion.div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input placeholder="Поиск по пациенту, диагнозу, МКБ-10..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-20 text-center">
            <ClipboardList size={48} className="mb-3 text-slate-600" />
            <p className="text-lg font-semibold text-slate-500">Нет записей</p>
            <p className="text-sm text-slate-600">Добавьте первое посещение</p>
          </div>
        ) : (
          filteredVisits.map((visit, i) => (
            <motion.div
              key={visit.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-[#C9A96E]/15 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-white">{visit.patient_name || '—'}</span>
                    {visit.icd10_codes && (
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-black" style={{ background: T.gold }}>
                        МКБ: {visit.icd10_codes}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">{visit.doctor_name || '—'}</span>
                    <span className="text-xs text-slate-600">
                      {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                  </div>
                  {visit.diagnosis && <p className="text-sm text-slate-400 mb-1"><span className="text-slate-600">Диагноз:</span> {visit.diagnosis}</p>}
                  {visit.chief_complaint && <p className="text-xs text-slate-500 mb-1"><span className="text-slate-600">Жалобы:</span> {visit.chief_complaint}</p>}
                  {visit.procedures_done && <p className="text-xs text-slate-500"><span className="text-slate-600">Процедуры:</span> {visit.procedures_done}</p>}
                </div>
                <button onClick={() => startEdit(visit)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#C9A96E]">
                  <Edit3 size={14} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
