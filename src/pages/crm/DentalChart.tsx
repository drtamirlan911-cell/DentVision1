import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smile, Search, ArrowRight, Save } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useDataQuery } from '@/queries/useDataQuery';
import { Odontogram3D, ToothLegend, SurfaceEditor, AutoTreatmentPlan } from '@/components/Odontogram3D';
import { syncOdontogramToTreatmentPlan } from '@/lib/odontogram-plan-sync';
import { Card, CardContent } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Input } from '@/components/ui/ds/Input';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useToast } from '@/components/ui/ds/Toast';
import { usePatientStore } from '@/store/patient.store';

/**
 * Mandatory CRM section: Dental Chart (Spec §05.4.6).
 * Persists FDI odontogram on Patient.teeth.
 */
export default function DentalChart() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { patients, upsertPatient } = useDataQuery(user?.clinicId);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('patient'));
  const [selectedTooth, setSelectedTooth] = useState<number | undefined>();
  const [teeth, setTeeth] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const list = useMemo(() => {
    const pats = Array.isArray(patients) ? patients : [];
    return pats.filter((p: any) =>
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.includes(search)
    );
  }, [patients, search]);

  const selected = list.find((p: any) => p.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && list.length === 1) setSelectedId(list[0].id);
  }, [list, selectedId]);

  useEffect(() => {
    if (!selected) {
      setTeeth({});
      setDirty(false);
      return;
    }
    setTeeth((selected as any).teeth || (selected as any).dentalChart || {});
    setDirty(false);
    setSelectedTooth(undefined);
    void usePatientStore.getState().openPatient(selected.id);
  }, [selected?.id]);

  const saveChart = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const clinicId = user?.clinicId || (selected as any).clinicId;
      await upsertPatient({
        id: selected.id,
        clinicId,
        name: selected.name || (selected as any).fullName,
        phone: selected.phone,
        teeth,
      } as any);
      setDirty(false);
      if (clinicId) {
        try {
          const synced = await syncOdontogramToTreatmentPlan({
            clinicId,
            patientId: selected.id,
            patientName: selected.name || (selected as any).fullName,
            teeth,
          });
          showToast(
            synced ? `Карта сохранена · план: ${synced.count} поз.` : 'Зубная карта сохранена',
            'success',
          );
        } catch {
          showToast('Зубная карта сохранена', 'success');
        }
      } else {
        showToast('Зубная карта сохранена', 'success');
      }
    } catch {
      showToast('Не удалось сохранить карту', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="dv-page max-w-6xl mx-auto space-y-3 sm:space-y-4 md:space-y-6 py-3 md:py-6"
    >
      <PageHeader
        title="Зубная карта"
        subtitle="FDI · анатомия корней · импланты · план лечения"
        icon={<Smile size={20} />}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/crm/treatment-plans')}>
              Планы лечения
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
            {selected && (
              <Button size="sm" onClick={saveChart} disabled={!dirty || saving}>
                <Save size={14} className="mr-1.5" />
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <Card className="h-fit">
          <CardContent className="p-3 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пациент…"
                className="pl-9"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-1">
              {list.length === 0 ? (
                <p className="text-xs text-txt-muted p-2">Пациенты не найдены</p>
              ) : (
                list.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedId(p.id)
                      void usePatientStore.getState().openPatient(p.id)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedId === p.id
                        ? 'bg-dv-gold/15 text-dv-gold border border-dv-gold/20'
                        : 'text-txt-secondary hover:bg-white/5'
                    }`}
                  >
                    <div className="font-medium truncate">{p.name || p.fullName}</div>
                    {p.phone && <div className="text-[11px] text-txt-muted">{p.phone}</div>}
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            {!selected ? (
              <EmptyState
                icon={<Smile size={28} />}
                title="Выберите пациента"
                description="Зубная карта открывается в контексте пациента. Можно также попросить AI: «Открой зубную карту»."
              />
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-semibold text-txt-primary truncate">{selected.name || (selected as any).fullName}</h2>
                    <p className="text-xs text-txt-muted">
                      {selectedTooth ? `Зуб ${selectedTooth} · выберите статус` : 'Клик по зубу для выбора'}
                      {dirty ? ' · есть несохранённые изменения' : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/crm/patients?patient=${selected.id}&tab=odontogram`)}
                  >
                    Полная карта
                  </Button>
                </div>
                <ToothLegend />
                <Odontogram3D
                  patientTeeth={teeth}
                  onToothClick={(n) => setSelectedTooth(n)}
                  selectedTooth={selectedTooth}
                />
                {selectedTooth && (
                  <SurfaceEditor
                    toothNumber={selectedTooth}
                    tooth={teeth[selectedTooth]}
                    onSave={(n, data) => {
                      setTeeth((prev) => ({
                        ...prev,
                        [n]: {
                          ...(typeof prev[n] === 'object' ? prev[n] : {}),
                          ...data,
                        },
                      }))
                      setDirty(true)
                      setSelectedTooth(undefined)
                    }}
                    onCancel={() => setSelectedTooth(undefined)}
                  />
                )}
                <AutoTreatmentPlan
                  teeth={teeth}
                  patientId={selected.id}
                  patientName={selected.name || (selected as any).fullName}
                  clinicId={user?.clinicId || (selected as any).clinicId}
                  onAddToPlan={async () => {
                    const clinicId = user?.clinicId || (selected as any).clinicId;
                    if (!clinicId) {
                      showToast('Выберите клинику', 'error');
                      return;
                    }
                    try {
                      const synced = await syncOdontogramToTreatmentPlan({
                        clinicId,
                        patientId: selected.id,
                        patientName: selected.name || (selected as any).fullName,
                        teeth,
                      });
                      showToast(
                        synced
                          ? `${synced.created ? 'Создан' : 'Обновлён'} план · ${synced.count} поз.`
                          : 'Нет позиций для плана',
                        'success',
                      );
                      navigate(`/crm/treatment-plans?patient=${selected.id}`);
                    } catch {
                      showToast('Не удалось сохранить план лечения', 'error');
                    }
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
