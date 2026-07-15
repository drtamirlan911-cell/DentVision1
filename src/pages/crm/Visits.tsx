import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, Search, Edit3, Save, X, Stethoscope, User, Calendar, FileText, Pill } from 'lucide-react';
import { gid, today } from '../../utils/constants';
import { useData, useToast } from '../../hooks/useData';
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
  const { patients, doctors, visits, upsertVisit } = useData(clinic?.id);
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
    if (!form.patient_id) { toast.error('╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░'); return; }
    await upsertVisit({
      id: editingId || gid(),
      ...form,
      clinic_id: clinic.id,
      user_id: user?.id,
      user_name: user?.name,
    } as any);
    toast.success(editingId ? '╨Я╨╛╤Б╨╡╤Й╨╡╨╜╨╕╨╡ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╛' : '╨Я╨╛╤Б╨╡╤Й╨╡╨╜╨╕╨╡ ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╛');
    resetForm();
  };

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="╨Ц╤Г╤А╨╜╨░╨╗ ╨┐╨╛╤Б╨╡╤Й╨╡╨╜╨╕╨╣"
        subtitle="╨Т╤Б╨╡ ╨▓╨╕╨╖╨╕╤В╤Л ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨╛╨▓ ╤Б ╨┤╨╕╨░╨│╨╜╨╛╨╖╨░╨╝╨╕ ╨╕ ╨Ь╨Ъ╨С-10"
        icon={<ClipboardList size={24} className="text-dv-gold" />}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => { resetForm(); setShowForm(true); }}>
            ╨Э╨╛╨▓╨╛╨╡ ╨┐╨╛╤Б╨╡╤Й╨╡╨╜╨╕╨╡
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
                  {editingId ? '╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡ ╨┐╨╛╤Б╨╡╤Й╨╡╨╜╨╕╤П' : '╨Э╨╛╨▓╨╛╨╡ ╨┐╨╛╤Б╨╡╤Й╨╡╨╜╨╕╨╡'}
                </span>
                <Button variant="ghost" size="icon-sm" icon={<X size={18} />} onClick={resetForm} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Я╨░╤Ж╨╕╨╡╨╜╤В *</label>
                    <select value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}>
                      <option value="">╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡...</option>
                      {(patients || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Т╤А╨░╤З</label>
                    <select value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
                      <option value="">╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡...</option>
                      {(doctors || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Ъ╨╛╨┤ ╨Ь╨Ъ╨С-10</label>
                    <input value={form.icd10_codes} onChange={e => setForm(f => ({ ...f, icd10_codes: e.target.value }))} placeholder="K02.1, K04.0..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Ц╨░╨╗╨╛╨▒╤Л ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░</label>
                    <textarea rows={2} value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))} placeholder="╨Э╨░ ╤З╤В╨╛ ╨╢╨░╨╗╤Г╨╡╤В╤Б╤П ╨┐╨░╤Ж╨╕╨╡╨╜╤В..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Ф╨╕╨░╨│╨╜╨╛╨╖</label>
                    <textarea rows={2} value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="╨Я╨╛╤Б╤В╨░╨▓╨╗╨╡╨╜╨╜╤Л╨╣ ╨┤╨╕╨░╨│╨╜╨╛╨╖..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Я╨╗╨░╨╜ ╨╗╨╡╤З╨╡╨╜╨╕╤П</label>
                    <textarea rows={2} value={form.treatment_plan} onChange={e => setForm(f => ({ ...f, treatment_plan: e.target.value }))} placeholder="╨Я╨╗╨░╨╜ ╨╗╨╡╤З╨╡╨╜╨╕╤П..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Т╤Л╨┐╨╛╨╗╨╜╨╡╨╜╨╜╤Л╨╡ ╨┐╤А╨╛╤Ж╨╡╨┤╤Г╤А╤Л</label>
                    <textarea rows={2} value={form.procedures_done} onChange={e => setForm(f => ({ ...f, procedures_done: e.target.value }))} placeholder="╨з╤В╨╛ ╨▒╤Л╨╗╨╛ ╤Б╨┤╨╡╨╗╨░╨╜╨╛..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Э╨░╨╖╨╜╨░╤З╨╡╨╜╨╕╤П</label>
                    <textarea rows={2} value={form.prescriptions} onChange={e => setForm(f => ({ ...f, prescriptions: e.target.value }))} placeholder="╨Ы╨╡╨║╨░╤А╤Б╤В╨▓╨░, ╤А╨╡╨║╨╛╨╝╨╡╨╜╨┤╨░╤Ж╨╕╨╕..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨б╨╗╨╡╨┤╤Г╤О╤Й╨╕╨╣ ╨▓╨╕╨╖╨╕╤В</label>
                      <input type="date" value={form.next_visit_date} onChange={e => setForm(f => ({ ...f, next_visit_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Я╤А╨╕╨╝╨╡╤З╨░╨╜╨╕╤П</label>
                      <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="..." />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={resetForm}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
                  <Button variant="primary" icon={<Save size={14} />} onClick={saveVisit}>
                    {editingId ? '╨Ю╨▒╨╜╨╛╨▓╨╕╤В╤М' : '╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <input placeholder="╨Я╨╛╨╕╤Б╨║ ╨┐╨╛ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╤Г, ╨┤╨╕╨░╨│╨╜╨╛╨╖╤Г, ╨Ь╨Ъ╨С-10..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filteredVisits.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={48} />}
            title="╨Э╨╡╤В ╨╖╨░╨┐╨╕╤Б╨╡╨╣"
            description="╨Ф╨╛╨▒╨░╨▓╤М╤В╨╡ ╨┐╨╡╤А╨▓╨╛╨╡ ╨┐╨╛╤Б╨╡╤Й╨╡╨╜╨╕╨╡"
          />
        ) : (
          filteredVisits.map((visit, i) => (
            <motion.div
              key={visit.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <Card hover className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-bold text-txt-primary">{visit.patient_name || 'тАФ'}</span>
                      {visit.icd10_codes && (
                        <Badge variant="gold" size="xs">╨Ь╨Ъ╨С: {visit.icd10_codes}</Badge>
                      )}
                      <span className="text-xs text-txt-muted">{visit.doctor_name || 'тАФ'}</span>
                      <span className="text-xs text-txt-ghost">
                        {visit.visit_date ? new Date(visit.visit_date).toLocaleDateString('ru-RU') : 'тАФ'}
                      </span>
                    </div>
                    {visit.diagnosis && <p className="text-sm text-txt-secondary mb-1"><span className="text-txt-ghost">╨Ф╨╕╨░╨│╨╜╨╛╨╖:</span> {visit.diagnosis}</p>}
                    {visit.chief_complaint && <p className="text-xs text-txt-muted mb-1"><span className="text-txt-ghost">╨Ц╨░╨╗╨╛╨▒╤Л:</span> {visit.chief_complaint}</p>}
                    {visit.procedures_done && <p className="text-xs text-txt-muted"><span className="text-txt-ghost">╨Я╤А╨╛╤Ж╨╡╨┤╤Г╤А╤Л:</span> {visit.procedures_done}</p>}
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
