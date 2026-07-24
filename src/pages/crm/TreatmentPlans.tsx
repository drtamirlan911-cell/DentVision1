import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList, Plus, Search, ArrowRight, User, Trash2, Pencil, Printer,
} from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useDataQuery } from '@/queries/useDataQuery';
import * as api from '@/utils/api';
import { Card, CardContent } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Input } from '@/components/ui/ds/Input';
import { Badge } from '@/components/ui/ds/Badge';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useToast } from '@/components/ui/ds/Toast';
import { TreatmentPlanEditor } from '@/components/crm/TreatmentPlanEditor';
import { normalizeStages, planTotal } from '@/lib/treatment-plan';
import { printTreatmentPlan } from '@/lib/treatment-plan-print';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  proposed: 'Предложен',
  accepted: 'Принят',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
  active: 'Активен',
};

/**
 * Mandatory CRM section: Treatment Plans (DNA / Spec §05).
 * Full editor with services, teeth, stages, auto-sum and print/PDF.
 */
export default function TreatmentPlans() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, clinic } = useAuth();
  const { showToast } = useToast();
  const clinicId = user?.clinicId || '';
  const { patients, visits } = useDataQuery(clinicId);
  const [search, setSearch] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);

  const load = async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await api.getTreatmentPlans(clinicId);
      setPlans(Array.isArray(rows) ? rows : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clinicId]);

  useEffect(() => {
    const patientId = params.get('patient');
    const editId = params.get('edit');
    if (editId && plans.length) {
      const plan = plans.find((p) => p.id === editId);
      if (plan) {
        setEditingPlan(plan);
        setEditorOpen(true);
        setParams({}, { replace: true });
      }
    } else if (patientId && !editorOpen) {
      setEditingPlan(null);
      setEditorOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, plans, setParams, editorOpen]);

  const legacyPlans = useMemo(() => {
    const list = Array.isArray(visits) ? visits : [];
    const pats = Array.isArray(patients) ? patients : [];
    return list
      .filter((v: any) => v.treatmentPlan || v.treatment_plan)
      .map((v: any) => {
        const patient = pats.find((p: any) => p.id === v.patientId || p.id === v.patient_id);
        return {
          id: `visit-${v.id}`,
          legacy: true,
          patientId: v.patientId || v.patient_id,
          patientName: patient?.name || 'Пациент',
          title: 'План из визита',
          notes: v.treatmentPlan || v.treatment_plan,
          status: v.status || 'active',
          totalBudget: null,
          stages: [],
          updatedAt: v.visitDate || v.visit_date || v.createdAt || '',
        };
      });
  }, [visits, patients]);

  const combined = useMemo(() => {
    const all = [...plans, ...legacyPlans];
    return all.filter((p) =>
      !search ||
      String(p.patientName || '').toLowerCase().includes(search.toLowerCase()) ||
      String(p.title || '').toLowerCase().includes(search.toLowerCase()) ||
      String(p.diagnosis || p.notes || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [plans, legacyPlans, search]);

  const patientOptions = Array.isArray(patients) ? patients : [];
  const initialPatientId = params.get('patient') || '';

  const openNew = () => {
    setEditingPlan(null);
    setEditorOpen(true);
  };

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setEditorOpen(true);
  };

  const handlePrintPlan = async (plan: any) => {
    const patient = patientOptions.find((p: any) => p.id === plan.patientId);
    let clinicData = clinic;
    try {
      if (clinicId) {
        const payload = await api.getClinicSettings(clinicId);
        clinicData = payload.clinic || clinicData;
      }
    } catch { /* fallback */ }

    const stages = normalizeStages(plan.stages || []);
    printTreatmentPlan({
      clinicName: clinicData?.name || 'Клиника',
      clinicAddress: clinicData?.address,
      clinicPhone: clinicData?.phone,
      clinicCity: clinicData?.city,
      patientName: patient?.name || plan.patientName || 'Пациент',
      patientPhone: patient?.phone,
      doctorName: user?.name,
      title: plan.title,
      diagnosis: plan.diagnosis || plan.notes,
      status: plan.status,
      stages,
      createdAt: plan.createdAt,
    });
  };

  const planTotalDisplay = (plan: any) => {
    const stages = normalizeStages(plan.stages || []);
    if (stages.some((s) => s.items?.length)) return planTotal(stages);
    return Number(plan.totalBudget) || 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="dv-page max-w-5xl mx-auto space-y-6 py-4 md:py-6"
    >
      <PageHeader
        title="Планы лечения"
        subtitle="Услуги, зубы, этапы и автоматический расчёт стоимости"
        icon={<ClipboardList size={20} />}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => navigate('/crm/dental-chart')}>
              <span className="hidden sm:inline">Зубная карта</span>
              <span className="sm:hidden">Карта</span>
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
            <Button size="sm" onClick={openNew} icon={<Plus size={14} />}>
              <span className="hidden sm:inline">Новый план</span>
              <span className="sm:hidden">Новый</span>
            </Button>
          </>
        }
      />

      <motion.div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по пациенту или плану…"
          className="pl-9"
        />
      </motion.div>

      {loading ? (
        <motion.div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-dv-gold/30 border-t-dv-gold animate-spin" />
        </motion.div>
      ) : combined.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="Планов пока нет"
          description="Создайте план с услугами и этапами — сумма посчитается автоматически."
          action={
            <Button size="sm" onClick={openNew} icon={<Plus size={14} />}>
              Создать план
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {combined.map((p) => {
            const total = planTotalDisplay(p);
            const stages = normalizeStages(p.stages || []);
            return (
              <Card key={p.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-start gap-3 justify-between">
                  <motion.div className="space-y-1 min-w-0 flex-1">
                    <motion.div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-txt-primary truncate">{p.title || 'План лечения'}</span>
                      <Badge variant="gold" size="xs">{STATUS_LABELS[p.status] || p.status}</Badge>
                      {p.legacy && <Badge size="xs">из визита</Badge>}
                    </motion.div>
                    <div className="text-xs text-txt-muted flex items-center gap-1">
                      <User size={12} />
                      {p.patientName || 'Пациент'}
                      {total > 0 && ` · ${total.toLocaleString('ru-RU')} ₸`}
                    </div>
                    {(p.diagnosis || p.notes) && (
                      <p className="text-sm text-txt-secondary line-clamp-2">{p.diagnosis || p.notes}</p>
                    )}
                    {stages.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] text-txt-muted">Этапы</p>
                        {stages.map((s, i) => (
                          <div key={s.id || i} className="flex items-center gap-2 flex-wrap">
                            <Badge
                              size="xs"
                              variant={s.status === 'done' || s.status === 'completed' ? 'success' : s.status === 'in_progress' ? 'gold' : 'default'}
                            >
                              {s.status === 'done' || s.status === 'completed' ? 'Готово' : s.status === 'in_progress' ? 'В работе' : 'Ожидает'}
                            </Badge>
                            <span className="text-xs text-txt-secondary">{s.title}</span>
                            {s.items?.length > 0 && (
                              <span className="text-[11px] text-txt-muted">
                                {s.items.length} усл.
                              </span>
                            )}
                            <span className="text-[11px] text-txt-muted">
                              {s.cost != null ? `${Number(s.cost).toLocaleString('ru-RU')} ₸` : ''}
                            </span>
                            {!p.legacy && (
                              <div className="flex gap-1 ml-auto flex-wrap">
                                {s.status !== 'in_progress' && s.status !== 'done' && s.status !== 'completed' && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={async () => {
                                      try {
                                        await api.updateTreatmentPlanStage(p.id, s.id || String(i), { status: 'in_progress' });
                                        showToast('Этап в работе', 'success');
                                        load();
                                      } catch { showToast('Не удалось обновить этап', 'error'); }
                                    }}
                                  >
                                    Старт
                                  </Button>
                                )}
                                {s.status !== 'done' && s.status !== 'completed' && (
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    onClick={async () => {
                                      try {
                                        await api.updateTreatmentPlanStage(p.id, s.id || String(i), { status: 'done' });
                                        showToast('Этап завершён', 'success');
                                        load();
                                      } catch { showToast('Не удалось завершить этап', 'error'); }
                                    }}
                                  >
                                    Готово
                                  </Button>
                                )}
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => navigate(`/crm/schedule?patient=${p.patientId}`)}
                                >
                                  Записать
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => navigate(`/crm/cashier?patient=${p.patientId}&plan=${p.id}&stage=${s.id || i}`)}
                                >
                                  Счёт
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                  {p.patientId && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {!p.legacy && (
                        <>
                          <Button size="sm" onClick={() => openEdit(p)} icon={<Pencil size={14} />}>
                            Редактировать
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handlePrintPlan(p)} icon={<Printer size={14} />}>
                            Печать / PDF
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/crm/patients?patient=${p.patientId}&tab=odontogram`)}
                      >
                        Карта пациента
                        <ArrowRight size={14} className="ml-1.5" />
                      </Button>
                      {!p.legacy && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-error/80 hover:text-error"
                          icon={<Trash2 size={14} />}
                          onClick={async () => {
                            if (!window.confirm('Удалить план лечения?')) return;
                            try {
                              await api.deleteTreatmentPlan(p.id);
                              showToast('План удалён', 'success');
                              load();
                            } catch {
                              showToast('Не удалось удалить план', 'error');
                            }
                          }}
                        >
                          Удалить
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TreatmentPlanEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingPlan(null); }}
        clinicId={clinicId}
        clinic={clinic}
        doctorId={user?.id}
        doctorName={user?.name}
        patients={patientOptions}
        initialPatientId={editingPlan?.patientId || initialPatientId}
        plan={editingPlan}
        onSaved={load}
      />
    </motion.div>
  );
}
