import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, Search, ArrowRight, User } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useDataQuery } from '@/queries/useDataQuery';
import { Card, CardContent } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Input } from '@/components/ui/ds/Input';
import { Badge } from '@/components/ui/ds/Badge';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';

/**
 * Mandatory CRM section: Treatment Plans (DNA / Spec §05).
 * Surfaces visit-level plans and deep-links into patient chart.
 */
export default function TreatmentPlans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { patients, visits } = useDataQuery(user?.clinicId);
  const [search, setSearch] = useState('');

  const plans = useMemo(() => {
    const list = Array.isArray(visits) ? visits : [];
    const pats = Array.isArray(patients) ? patients : [];
    return list
      .filter((v: any) => v.treatmentPlan || v.treatment_plan)
      .map((v: any) => {
        const patient = pats.find((p: any) => p.id === v.patientId || p.id === v.patient_id);
        return {
          id: v.id,
          patientId: v.patientId || v.patient_id,
          patientName: patient?.name || 'Пациент',
          plan: v.treatmentPlan || v.treatment_plan,
          date: v.visitDate || v.visit_date || v.createdAt || '',
          status: v.status || 'active',
          complaint: v.chiefComplaint || v.chief_complaint || '',
        };
      })
      .filter((p) =>
        !search ||
        p.patientName.toLowerCase().includes(search.toLowerCase()) ||
        String(p.plan).toLowerCase().includes(search.toLowerCase())
      );
  }, [visits, patients, search]);

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
          <Button size="sm" onClick={() => navigate('/crm/patients')}>
            <Plus size={14} className="mr-1.5" />
            Создать из пациента
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по пациенту или плану…"
          className="pl-9"
        />
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="Планов пока нет"
          description="Создайте план лечения в карте пациента или через AI: «Собери план лечения»."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
              Открыть AI Workspace
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="hover:border-dv-gold/30 transition-colors">
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-dv-gold shrink-0" />
                    <p className="text-sm font-semibold text-txt-primary truncate">{plan.patientName}</p>
                    <Badge variant="gold" size="xs">{plan.status}</Badge>
                  </div>
                  {plan.complaint && (
                    <p className="text-xs text-txt-muted">Жалоба: {plan.complaint}</p>
                  )}
                  <p className="text-sm text-txt-secondary whitespace-pre-wrap line-clamp-3">{plan.plan}</p>
                  {plan.date && (
                    <p className="text-[11px] text-txt-ghost">{String(plan.date).slice(0, 10)}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/crm/patients?patient=${plan.patientId}&tab=odontogram`)}
                >
                  Карта
                  <ArrowRight size={14} className="ml-1.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
