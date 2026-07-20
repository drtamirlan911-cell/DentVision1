import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smile, Search, ArrowRight, Save } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useDataQuery } from '@/queries/useDataQuery';
import { Odontogram3D, ToothLegend } from '@/components/Odontogram3D';
import { Card, CardContent } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Input } from '@/components/ui/ds/Input';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useToast } from '@/components/ui/ds/Toast';

const TOOTH_STATUSES = [
  { id: 'healthy', label: 'Здоров' },
  { id: 'caries', label: 'Кариес' },
  { id: 'filled', label: 'Пломба' },
  { id: 'crown', label: 'Коронка' },
  { id: 'missing', label: 'Отсутствует' },
  { id: 'implant', label: 'Имплант' },
  { id: 'root', label: 'Корень' },
];

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
  }, [selected?.id]);

  const setToothStatus = (status: string) => {
    if (!selectedTooth) return;
    setTeeth((prev) => ({
      ...prev,
      [selectedTooth]: {
        ...(typeof prev[selectedTooth] === 'object' ? prev[selectedTooth] : {}),
        status,
      },
    }));
    setDirty(true);
  };

  const saveChart = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await upsertPatient({
        id: selected.id,
        clinicId: user?.clinicId || (selected as any).clinicId,
        name: selected.name || (selected as any).fullName,
        phone: selected.phone,
        teeth,
      } as any);
      setDirty(false);
      showToast('Зубная карта сохранена', 'success');
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
      className="max-w-6xl mx-auto space-y-6 p-4 md:p-6"
    >
      <PageHeader
        title="Зубная карта"
        subtitle="Одонтограмма FDI · связь с планом лечения и визитом"
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
                    onClick={() => setSelectedId(p.id)}
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
          <CardContent className="p-4">
            {!selected ? (
              <EmptyState
                icon={<Smile size={28} />}
                title="Выберите пациента"
                description="Зубная карта открывается в контексте пациента. Можно также попросить AI: «Открой зубную карту»."
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-txt-primary">{selected.name || (selected as any).fullName}</h2>
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
                  <div className="flex flex-wrap gap-2 pt-2">
                    {TOOTH_STATUSES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setToothStatus(s.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          (typeof teeth[selectedTooth] === 'object' ? teeth[selectedTooth]?.status : teeth[selectedTooth]) === s.id
                            ? 'border-dv-gold/40 bg-dv-gold/15 text-dv-gold'
                            : 'border-white/10 text-txt-secondary hover:bg-white/5'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
