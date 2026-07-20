import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smile, Search, ArrowRight } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useDataQuery } from '@/queries/useDataQuery';
import { Odontogram3D, ToothLegend } from '@/components/Odontogram3D';
import { Card, CardContent } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Input } from '@/components/ui/ds/Input';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';

/**
 * Mandatory CRM section: Dental Chart (Spec §05.4.6).
 */
export default function DentalChart() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { patients } = useDataQuery(user?.clinicId);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('patient'));
  const [selectedTooth, setSelectedTooth] = useState<number | undefined>();

  const list = useMemo(() => {
    const pats = Array.isArray(patients) ? patients : [];
    return pats.filter((p: any) =>
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.includes(search)
    );
  }, [patients, search]);

  const selected = list.find((p: any) => p.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && list.length === 1) setSelectedId(list[0].id);
  }, [list, selectedId]);

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
          <Button size="sm" variant="secondary" onClick={() => navigate('/crm/treatment-plans')}>
            Планы лечения
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
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
                    <div className="font-medium truncate">{p.name}</div>
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
                    <h2 className="text-base font-semibold text-txt-primary">{selected.name}</h2>
                    <p className="text-xs text-txt-muted">Одонтограмма · клик по зубу для выбора</p>
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
                  patientTeeth={(selected as any).teeth || (selected as any).dentalChart || {}}
                  onToothClick={(n) => setSelectedTooth(n)}
                  selectedTooth={selectedTooth}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
