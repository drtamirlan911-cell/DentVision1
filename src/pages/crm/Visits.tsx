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
  patientId: string
  doctorId: string
  chiefComplaint: string
  diagnosis: string
  icd10Codes: string
  treatmentPlan: string
  proceduresDone: string
  prescriptions: string
  nextVisitDate: string
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
    patientId: '', doctorId: '', chiefComplaint: '', diagnosis: '',
    icd10Codes: '', treatmentPlan: '', proceduresDone: '',
    prescriptions: '', nextVisitDate: '', notes: '',
  });

  const filteredVisits = useMemo(() => {
    if (!visits) return [];
    const q = searchQuery.toLowerCase();
    return visits.filter(v => {
      const vv = v as any;
      const patientName = vv.patient_name
        || vv.patientName
        || patients.find(p => p.id === (vv.patientId || vv.patient_id))?.name
        || '';
      const doctorName = vv.doctor_name
        || vv.doctorName
        || doctors.find(d => d.id === (vv.doctorId || vv.doctor_id))?.name
        || '';
      return !q
        || patientName.toLowerCase().includes(q)
        || doctorName.toLowerCase().includes(q)
        || vv.diagnosis?.toLowerCase().includes(q)
        || vv.icd10Codes?.toLowerCase().includes(q);
    });
  }, [visits, searchQuery, patients, doctors]);

  const resolvePatientName = (visit: Visit & Record<string, any>) =>
    visit.patientName
    || patients.find(p => p.id === (visit.patientId || visit.patient_id))?.name
    || '—';

  const resolveDoctorName = (visit: Visit & Record<string, any>) =>
    visit.doctorName
    || doctors.find(d => d.id === (visit.doctorId || visit.doctor_id))?.name
    || '—';

  const resetForm = () => {
    setForm({ patientId: '', doctorId: '', chiefComplaint: '', diagnosis: '', icd10Codes: '', treatmentPlan: '', proceduresDone: '', prescriptions: '', nextVisitDate: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (visit: Visit) => {
    setForm({
      patientId: visit.patientId || (visit as any).patient_id || '',
      doctorId: visit.doctorId || (visit as any).doctor_id || '',
      chiefComplaint: visit.chiefComplaint || (visit as any).chief_complaint || '',
      diagnosis: (visit as any).diagnosis || '',
      icd10Codes: visit.icd10Codes || (visit as any).icd10_codes || '',
      treatmentPlan: visit.treatmentPlan || (visit as any).treatment_plan || '',
      proceduresDone: visit.proceduresDone || (visit as any).procedures_done || '',
      prescriptions: (visit as any).prescriptions || '',
      nextVisitDate: visit.nextVisitDate || (visit as any).next_visit_date || '',
      notes: visit.notes || '',
    });
    setEditingId(visit.id);
    setShowForm(true);
  };

  const saveVisit = async () => {
    if (!form.patientId) { toast.error('Выберите пациента'); return; }
    try {
      await upsertVisit({
        ...(editingId ? { id: editingId } : {}),
        ...form,
        clinicId: clinic.id,
        userId: user?.id,
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
                <Button variant="ghost" size="icon-sm" icon={<X size={18} />} onClick={resetForm} aria-label="Закрыть форму" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Пациент *</label>
                    <select className="dv-select" value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}>
                      <option value="">Выберите...</option>
                      {(patients || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Врач</label>
                    <select className="dv-select" value={form.doctorId} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}>
                      <option value="">Выберите...</option>
                      {(doctors || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Код МКБ-10</label>
                    <input value={form.icd10Codes} onChange={e => setForm(f => ({ ...f, icd10Codes: e.target.value }))} placeholder="K02.1, K04.0..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Жалобы пациента</label>
                    <textarea rows={2} value={form.chiefComplaint} onChange={e => setForm(f => ({ ...f, chiefComplaint: e.target.value }))} placeholder="На что жалуется пациент..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Диагноз</label>
                    <textarea rows={2} value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="Поставленный диагноз..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">План лечения</label>
                    <textarea rows={2} value={form.treatmentPlan} onChange={e => setForm(f => ({ ...f, treatmentPlan: e.target.value }))} placeholder="План лечения..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">Выполненные процедуры</label>
                    <textarea rows={2} value={form.proceduresDone} onChange={e => setForm(f => ({ ...f, proceduresDone: e.target.value }))} placeholder="Что было сделано..." />
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
                      <input type="date" value={form.nextVisitDate} onChange={e => setForm(f => ({ ...f, nextVisitDate: e.target.value }))} />
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
                          const pid = visit.patientId || (visit as any).patient_id
                          if (pid) navigate(`/crm/patients?patient=${pid}`)
                        }}
                      >
                        {resolvePatientName(visit)}
                      </button>
                      {visit.icd10Codes && (
                        <Badge variant="gold" size="xs">МКБ: {visit.icd10Codes}</Badge>
                      )}
                      <span className="text-xs text-txt-muted">{resolveDoctorName(visit)}</span>
                      <span className="text-xs text-txt-ghost">
                        {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString('ru-RU') : '—'}
                      </span>
                    </div>
                    {(visit as any).diagnosis && <p className="text-sm text-txt-secondary mb-1"><span className="text-txt-ghost">Диагноз:</span> {(visit as any).diagnosis}</p>}
                    {visit.chiefComplaint && <p className="text-xs text-txt-muted mb-1"><span className="text-txt-ghost">Жалобы:</span> {visit.chiefComplaint}</p>}
                    {visit.proceduresDone && <p className="text-xs text-txt-muted"><span className="text-txt-ghost">Процедуры:</span> {visit.proceduresDone}</p>}
                    {(visit.patientId || (visit as any).patient_id) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<Smile size={12} />}
                          onClick={() => navigate(`/crm/dental-chart?patient=${visit.patientId || (visit as any).patient_id}`)}
                        >
                          Зубная карта
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<FileText size={12} />}
                          onClick={() => navigate(`/crm/treatment-plans?patient=${visit.patientId || (visit as any).patient_id}`)}
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
                          onClick={() => navigate(`/crm/medical-card?patient=${visit.patientId || (visit as any).patient_id}`)}
                        >
                          Медкарта
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon-xs" icon={<Edit3 size={14} />} onClick={() => startEdit(visit)} aria-label="Редактировать посещение" />
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
