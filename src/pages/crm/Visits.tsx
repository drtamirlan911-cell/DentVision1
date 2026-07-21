import React, { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, Search, Edit3, Save, X, Stethoscope, User, Calendar, FileText, Pill, Smile, ArrowRight } from 'lucide-react';
import { today } from '../../utils/constants';
import { useToast } from '@/components/ui/ds/Toast'
import { useDataQuery } from '../../queries/useDataQuery';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/ds/Card';
import { Button } from '../../components/ui/ds/Button';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';
import type { Visit, Patient, User as UserType, Clinic, RoleInfo } from '../../types';

interface OutletContext {
  clinic: Clinic & { id: string }
  user: UserType
  roleInfo?: RoleInfo
}

interface VisitForm {
  patient_id: string
  doctor_id: string
  chief_complaint: string
  diagnosis: string
  icd10_codes: string
  treatment_plan: string
  procedures_done: string
  prescriptions: string
  next_visit_date: string
  notes: string
}

export default function Visits() {
  const { clinic, user } = useOutletContext<OutletContext>();
  const navigate = useNavigate();
  const { patients, doctors, visits, upsertVisit } = useDataQuery(clinic?.id);
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VisitForm>({
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

  const startEdit = (visit: Visit) => {
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
    try {
      await upsertVisit({
        ...(editingId ? { id: editingId } : {}),
        ...form,
        clinic_id: clinic.id,
        user_id: user?.id,
        user_name: user?.name,
      } as any);
      toast.success(editingId ? 'Посещение обновлено' : 'Посещение добавлено');
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сохранить посещение');
    }
  };

  return (
    <div className="dv-page fade-in space-y-6 py-4 md:py-6">
      <PageHeader
        title="Журнал посещений"
        subtitle="Все визиты пациентов с диагнозами и МКБ-10"
        icon={<ClipboardList size={24} className="text-dv-gold" />}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => { resetForm(); setShowForm(true); }}>
            Новое посещение
          </Button>
        }
      />

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Stethoscope size={16} className="text-dv-gold" />
                  {editingId ? 'Редактирование посещения' : 'Новое посещение'}
                </span>
                <Button variant="ghost" size="icon-sm" icon={<X size={18} />} onClick={resetForm} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Пациент *</label>
                    <select className="dv-select" value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}>
                      <option value="">Выберите...</option>
                      {(patients || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Врач</label>
                    <select className="dv-select" value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
                      <option value="">Выберите...</option>
                      {(doctors || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Код МКБ-10</label>
                    <input value={form.icd10_codes} onChange={e => setForm(f => ({ ...f, icd10_codes: e.target.value }))} placeholder="K02.1, K04.0..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Жалобы пациента</label>
                    <textarea rows={2} value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))} placeholder="На что жалуется пациент..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Диагноз</label>
                    <textarea rows={2} value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="Поставленный диагноз..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">План лечения</label>
                    <textarea rows={2} value={form.treatment_plan} onChange={e => setForm(f => ({ ...f, treatment_plan: e.target.value }))} placeholder="План лечения..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Выполненные процедуры</label>
                    <textarea rows={2} value={form.procedures_done} onChange={e => setForm(f => ({ ...f, procedures_done: e.target.value }))} placeholder="Что было сделано..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Назначения</label>
                    <textarea rows={2} value={form.prescriptions} onChange={e => setForm(f => ({ ...f, prescriptions: e.target.value }))} placeholder="Лекарства, рекомендации..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Следующий визит</label>
                      <input type="date" value={form.next_visit_date} onChange={e => setForm(f => ({ ...f, next_visit_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Примечания</label>
                      <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="..." />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={resetForm}>Отмена</Button>
                  <Button variant="primary" icon={<Save size={14} />} onClick={saveVisit}>
                    {editingId ? 'Обновить' : 'Добавить'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <input placeholder="Поиск по пациенту, диагнозу, МКБ-10..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filteredVisits.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={48} />}
            title="Нет записей"
            description="Добавьте первое посещение"
          />
        ) : (
          filteredVisits.map((visit, i) => (
            <motion.div
              key={visit.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
            >
              <Card hover className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <button
                        type="button"
                        className="text-sm font-bold text-txt-primary hover:text-dv-gold transition-colors"
                        onClick={() => {
                          const pid = visit.patient_id || visit.patientId
                          if (pid) navigate(`/crm/patients?patient=${pid}`)
                        }}
                      >
                        {visit.patient_name || '—'}
                      </button>
                      {visit.icd10_codes && (
                        <Badge variant="gold" size="xs">МКБ: {visit.icd10_codes}</Badge>
                      )}
                      <span className="text-xs text-txt-muted">{visit.doctor_name || '—'}</span>
                      <span className="text-xs text-txt-ghost">
                        {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString('ru-RU') : '—'}
                      </span>
                    </div>
                    {visit.diagnosis && <p className="text-sm text-txt-secondary mb-1"><span className="text-txt-ghost">Диагноз:</span> {visit.diagnosis}</p>}
                    {visit.chief_complaint && <p className="text-xs text-txt-muted mb-1"><span className="text-txt-ghost">Жалобы:</span> {visit.chief_complaint}</p>}
                    {visit.procedures_done && <p className="text-xs text-txt-muted"><span className="text-txt-ghost">Процедуры:</span> {visit.procedures_done}</p>}
                    {(visit.patient_id || visit.patientId) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<Smile size={12} />}
                          onClick={() => navigate(`/crm/dental-chart?patient=${visit.patient_id || visit.patientId}`)}
                        >
                          Зубная карта
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<FileText size={12} />}
                          onClick={() => navigate(`/crm/treatment-plans?patient=${visit.patient_id || visit.patientId}`)}
                        >
                          План лечения
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<Calendar size={12} />}
                          onClick={() => navigate(`/crm/schedule`)}
                        >
                          Расписание
                        </Button>
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={<ArrowRight size={12} />}
                          onClick={() => navigate(`/crm/medical-card?patient=${visit.patient_id || visit.patientId}`)}
                        >
                          Медкарта
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon-xs" icon={<Edit3 size={14} />} onClick={() => startEdit(visit)} />
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
