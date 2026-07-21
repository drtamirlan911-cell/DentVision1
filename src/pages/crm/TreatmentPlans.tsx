import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, Search, ArrowRight, User, Save, Trash2 } from 'lucide-react';
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
 * First-class plans with stages + budget; also shows legacy visit plans.
 */
export default function TreatmentPlans() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const clinicId = user?.clinicId || '';
  const { patients, visits } = useDataQuery(clinicId);
  const [search, setSearch] = useState('');
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    patientId: params.get('patient') || '',
    title: 'План лечения',
    diagnosis: '',
    totalBudget: '',
    stageTitle: 'Этап 1 — диагностика и санация',
  });

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
          patientName: patient?.name || patient?.fullName || 'Пациент',
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

  const createPlan = async () => {
    if (!form.patientId) {
      showToast('Выберите пациента', 'warning');
      return;
    }
    setCreating(true);
    try {
      const patient = patientOptions.find((p: any) => p.id === form.patientId);
      const teethObj = (patient as any)?.teeth || {};
      const toothNums = Object.keys(teethObj).map(Number).filter(Boolean);
      await api.upsertTreatmentPlan({
        clinicId,
        patientId: form.patientId,
        doctorId: user?.id,
        title: form.title || 'План лечения',
        diagnosis: form.diagnosis || null,
        status: 'proposed',
        totalBudget: form.totalBudget ? Number(form.totalBudget) : null,
        teeth: toothNums,
        stages: [
          {
            id: crypto.randomUUID(),
            title: form.stageTitle || 'Этап 1',
            status: 'pending',
            sortOrder: 1,
            cost: form.totalBudget ? Number(form.totalBudget) : null,
          },
        ],
      });
      showToast('План создан', 'success');
      setForm((f) => ({ ...f, diagnosis: '', totalBudget: '' }));
      await load();
    } catch {
      showToast('Не удалось создать план', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6 p-4 md:p-6"
    >
      <PageHeader
        title="Планы лечения"
        subtitle="Этапы, бюджет и связь с зубной картой — обязательный раздел CRM"
        icon={<ClipboardList size={20} />}
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('/crm/dental-chart')}>
            Зубная карта
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-semibold text-txt-primary flex items-center gap-2">
            <Plus size={14} /> Новый план
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-txt-primary"
            >
              <option value="">Пациент…</option>
              {patientOptions.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name || p.fullName}</option>
              ))}
            </select>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Название плана"
            />
            <Input
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              placeholder="Диагноз / показания"
            />
            <Input
              value={form.totalBudget}
              onChange={(e) => setForm({ ...form, totalBudget: e.target.value })}
              placeholder="Бюджет (₸)"
              type="number"
            />
          </div>
          <Input
            value={form.stageTitle}
            onChange={(e) => setForm({ ...form, stageTitle: e.target.value })}
            placeholder="Первый этап"
          />
          <Button size="sm" onClick={createPlan} disabled={creating}>
            <Save size={14} className="mr-1.5" />
            {creating ? 'Создание…' : 'Создать план'}
          </Button>
        </CardContent>
      </Card>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по пациенту или плану…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-dv-gold/30 border-t-dv-gold animate-spin" />
        </div>
      ) : combined.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="Планов пока нет"
          description="Создайте план выше или попросите AI: «Собери план лечения»."
        />
      ) : (
        <div className="space-y-3">
          {combined.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-txt-primary truncate">{p.title || 'План лечения'}</span>
                    <Badge variant="gold" size="xs">{STATUS_LABELS[p.status] || p.status}</Badge>
                    {p.legacy && <Badge size="xs">из визита</Badge>}
                  </div>
                  <div className="text-xs text-txt-muted flex items-center gap-1">
                    <User size={12} />
                    {p.patientName || 'Пациент'}
                    {p.totalBudget != null && ` · ${Number(p.totalBudget).toLocaleString('ru-RU')} ₸`}
                  </div>
                  {(p.diagnosis || p.notes) && (
                    <p className="text-sm text-txt-secondary line-clamp-2">{p.diagnosis || p.notes}</p>
                  )}
                  {Array.isArray(p.stages) && p.stages.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] text-txt-muted">Этапы</p>
                      {p.stages.map((s: any, i: number) => (
                        <div key={s.id || i} className="flex items-center gap-2 flex-wrap">
                          <Badge
                            size="xs"
                            variant={s.status === 'done' || s.status === 'completed' ? 'success' : s.status === 'in_progress' ? 'gold' : 'default'}
                          >
                            {s.status === 'done' || s.status === 'completed' ? 'Готово' : s.status === 'in_progress' ? 'В работе' : 'Ожидает'}
                          </Badge>
                          <span className="text-xs text-txt-secondary">{s.title}</span>
                          {s.cost != null && <span className="text-[11px] text-txt-muted">{Number(s.cost).toLocaleString('ru-RU')} ₸</span>}
                          {!p.legacy && (
                            <div className="flex gap-1 ml-auto">
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
                </div>
                {p.patientId && (
                  <div className="flex flex-col gap-2 shrink-0">
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
                          if (!window.confirm('Удалить план лечения?')) return
                          try {
                            await api.deleteTreatmentPlan(p.id)
                            showToast('План удалён', 'success')
                            load()
                          } catch {
                            showToast('Не удалось удалить план', 'error')
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
          ))}
        </div>
      )}
    </motion.div>
  );
}
