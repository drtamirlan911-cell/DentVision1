import { useState } from 'react';
import { Handshake, Plus, Award, TrendingUp, Target, Megaphone } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, Input, Select,
  DataTable, EmptyState, Drawer, Skeleton,
} from '@/components/ui/ds';
import { useToast } from '@/components/ui/ds/Toast';
import type { Column } from '@/components/ui/ds/DataTable';
import type { Partner, PartnerType } from '@/utils/api';
import { tg } from '@/utils/formatters';
import {
  usePartners, usePartner, usePartnerTiers, useCreatePartner, useCreatePartnerTier,
  useAssignPartnerTier, useAddPartnerKpi, useAddPartnerSla, useAddPartnerCampaign,
} from '@/queries/partner.query';

const TYPE_OPTIONS: { value: PartnerType; label: string }[] = [
  { value: 'MANUFACTURER', label: 'Производитель' },
  { value: 'DISTRIBUTOR', label: 'Дистрибьютор' },
  { value: 'ACADEMY', label: 'Академия' },
  { value: 'LABORATORY', label: 'Лаборатория' },
  { value: 'OFFICIAL_PARTNER', label: 'Официальный партнёр' },
  { value: 'CLINIC', label: 'Клиника' },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));

function fd(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
}

function TiersCard() {
  const toast = useToast();
  const { data: tiers, isLoading } = usePartnerTiers();
  const createTier = useCreatePartnerTier();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', commissionBps: '1000' });

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Укажите название уровня'); return; }
    try {
      await createTier.mutateAsync({ name: form.name, commissionBps: Number(form.commissionBps) || 0 });
      setOpen(false);
      setForm({ name: '', commissionBps: '1000' });
      toast.success('Уровень создан');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось создать уровень');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award size={16} className="text-dv-gold" />
          Уровни партнёров
        </CardTitle>
        <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
          Уровень
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10" />
        ) : !tiers?.length ? (
          <p className="text-xs text-txt-muted">Уровней пока нет.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => (
              <Badge key={t.id} variant="gold">{t.name} — {(t.commissionBps / 100).toFixed(1)}%</Badge>
            ))}
          </div>
        )}
      </CardContent>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый уровень" size="sm">
        <div className="space-y-3">
          <Input label="Название" placeholder="Gold" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input
            label="Комиссия, б.п. (100 = 1%)" type="number" value={form.commissionBps}
            onChange={(e) => setForm((f) => ({ ...f, commissionBps: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Отмена</Button>
            <Button loading={createTier.isPending} onClick={submit}>Создать</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function PartnerDetail({ partnerId, onClose }: { partnerId: string; onClose: () => void }) {
  const toast = useToast();
  const { data: partner, isLoading } = usePartner(partnerId);
  const { data: tiers } = usePartnerTiers();
  const assignTier = useAssignPartnerTier(partnerId);
  const addKpi = useAddPartnerKpi(partnerId);
  const addSla = useAddPartnerSla(partnerId);
  const addCampaign = useAddPartnerCampaign(partnerId);

  const [kpiForm, setKpiForm] = useState({ period: '', score: '' });
  const [slaForm, setSlaForm] = useState({ metric: '', target: '', actual: '' });
  const [campaignForm, setCampaignForm] = useState({ name: '', budget: '' });

  const submitTier = async (tierId: string) => {
    try {
      await assignTier.mutateAsync(tierId);
      toast.success('Уровень назначен');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось назначить уровень');
    }
  };

  const submitKpi = async () => {
    if (!kpiForm.period.trim()) { toast.error('Укажите период'); return; }
    try {
      await addKpi.mutateAsync({ period: kpiForm.period, metricsJson: {}, score: Number(kpiForm.score) || 0 });
      setKpiForm({ period: '', score: '' });
      toast.success('KPI записан');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось записать KPI');
    }
  };

  const submitSla = async () => {
    if (!slaForm.metric.trim() || !slaForm.target) { toast.error('Укажите метрику и целевое значение'); return; }
    try {
      await addSla.mutateAsync({
        metric: slaForm.metric,
        target: Number(slaForm.target),
        actual: slaForm.actual ? Number(slaForm.actual) : undefined,
      });
      setSlaForm({ metric: '', target: '', actual: '' });
      toast.success('SLA записан');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось записать SLA');
    }
  };

  const submitCampaign = async () => {
    if (!campaignForm.name.trim() || !campaignForm.budget) { toast.error('Укажите название и бюджет'); return; }
    try {
      await addCampaign.mutateAsync({ name: campaignForm.name, budget: Number(campaignForm.budget) });
      setCampaignForm({ name: '', budget: '' });
      toast.success('Кампания создана');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось создать кампанию');
    }
  };

  return (
    <Drawer open onClose={onClose} title={partner ? `${TYPE_LABEL[partner.type]} · ${partner.refId}` : '...'} width={480}>
      {isLoading || !partner ? (
        <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">{partner.status}</Badge>
            {partner.tier && <Badge variant="gold">{partner.tier.name}</Badge>}
          </div>

          <div>
            <p className="text-xs font-medium text-txt-secondary mb-1.5">Уровень</p>
            <div className="flex flex-wrap gap-1.5">
              {(tiers || []).map((t) => (
                <button
                  key={t.id}
                  onClick={() => submitTier(t.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    partner.tierId === t.id
                      ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold'
                      : 'border-bdr-subtle text-txt-muted hover:text-txt-primary'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5 mb-2">
              <TrendingUp size={14} /> KPI
            </h3>
            <div className="space-y-1.5 mb-2">
              {partner.kpis.length === 0 ? (
                <p className="text-xs text-txt-muted">Записей пока нет.</p>
              ) : partner.kpis.map((k) => (
                <div key={k.id} className="flex items-center justify-between rounded-lg border border-bdr-subtle px-2.5 py-1.5 text-xs">
                  <span className="text-txt-primary">{k.period}</span>
                  <span className="text-txt-muted">{k.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input size="sm" placeholder="2026-08" value={kpiForm.period} onChange={(e) => setKpiForm((f) => ({ ...f, period: e.target.value }))} />
              <Input size="sm" placeholder="балл" type="number" value={kpiForm.score} onChange={(e) => setKpiForm((f) => ({ ...f, score: e.target.value }))} />
              <Button size="sm" variant="secondary" loading={addKpi.isPending} onClick={submitKpi}>+</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5 mb-2">
              <Target size={14} /> SLA
            </h3>
            <div className="space-y-1.5 mb-2">
              {partner.slas.length === 0 ? (
                <p className="text-xs text-txt-muted">Записей пока нет.</p>
              ) : partner.slas.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-bdr-subtle px-2.5 py-1.5 text-xs">
                  <span className="text-txt-primary">{s.metric}: {s.actual ?? '—'} / {s.target}</span>
                  <Badge variant={s.breached ? 'error' : 'success'} size="xs">{s.breached ? 'нарушен' : 'ок'}</Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input size="sm" placeholder="метрика" value={slaForm.metric} onChange={(e) => setSlaForm((f) => ({ ...f, metric: e.target.value }))} />
              <Input size="sm" placeholder="цель" type="number" value={slaForm.target} onChange={(e) => setSlaForm((f) => ({ ...f, target: e.target.value }))} />
              <Input size="sm" placeholder="факт" type="number" value={slaForm.actual} onChange={(e) => setSlaForm((f) => ({ ...f, actual: e.target.value }))} />
              <Button size="sm" variant="secondary" loading={addSla.isPending} onClick={submitSla}>+</Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-txt-primary flex items-center gap-1.5 mb-2">
              <Megaphone size={14} /> Co-marketing кампании
            </h3>
            <div className="space-y-1.5 mb-2">
              {partner.campaigns.length === 0 ? (
                <p className="text-xs text-txt-muted">Кампаний пока нет.</p>
              ) : partner.campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-bdr-subtle px-2.5 py-1.5 text-xs">
                  <span className="text-txt-primary">{c.name}</span>
                  <span className="text-txt-muted">{tg(Number(c.budget) / 100)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input size="sm" placeholder="название" value={campaignForm.name} onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))} />
              <Input size="sm" placeholder="бюджет, ₸" type="number" value={campaignForm.budget} onChange={(e) => setCampaignForm((f) => ({ ...f, budget: e.target.value }))} />
              <Button size="sm" variant="secondary" loading={addCampaign.isPending} onClick={submitCampaign}>+</Button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default function PartnersTab() {
  const toast = useToast();
  const { data: partners, isLoading } = usePartners();
  const createPartner = useCreatePartner();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{ type: PartnerType; refType: string; refId: string }>({ type: 'MANUFACTURER', refType: 'shop', refId: '' });
  const [selected, setSelected] = useState<string | null>(null);

  const submitCreate = async () => {
    if (!form.refId.trim()) { toast.error('Укажите refId'); return; }
    try {
      await createPartner.mutateAsync(form);
      setCreateOpen(false);
      setForm({ type: 'MANUFACTURER', refType: 'shop', refId: '' });
      toast.success('Партнёр добавлен');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось добавить партнёра');
    }
  };

  const columns: Column<Partner>[] = [
    { key: 'type', header: 'Тип', render: (row) => TYPE_LABEL[row.type] || row.type },
    { key: 'refId', header: 'Ref ID' },
    { key: 'status', header: 'Статус', render: (row) => <Badge variant="default" size="xs">{row.status}</Badge> },
    { key: 'tier', header: 'Уровень', render: (row) => row.tier ? <Badge variant="gold" size="xs">{row.tier.name}</Badge> : '—' },
    { key: 'kpis', header: 'KPI', render: (row) => row._count?.kpis ?? 0 },
    { key: 'slas', header: 'SLA', render: (row) => row._count?.slas ?? 0 },
    { key: 'campaigns', header: 'Кампании', render: (row) => row._count?.campaigns ?? 0 },
    { key: 'createdAt', header: 'Создан', render: (row) => fd(row.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <TiersCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake size={16} className="text-dv-gold" />
            Партнёры
          </CardTitle>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            Добавить партнёра
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : !partners?.length ? (
            <EmptyState
              icon={<Handshake size={24} />}
              title="Партнёров пока нет"
              description="Производители, дистрибьюторы, академии и лаборатории с уровнями, KPI, SLA и co-marketing кампаниями."
              action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Добавить партнёра</Button>}
            />
          ) : (
            <DataTable columns={columns} data={partners} rowKey={(r) => r.id} onRowClick={(r) => setSelected(r.id)} />
          )}
        </CardContent>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новый партнёр" size="sm">
        <div className="space-y-3">
          <Select label="Тип" options={TYPE_OPTIONS} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PartnerType }))} />
          <Input label="refType" placeholder="shop" value={form.refType} onChange={(e) => setForm((f) => ({ ...f, refType: e.target.value }))} />
          <Input label="refId" placeholder="id поставщика/лаборатории/академии" value={form.refId} onChange={(e) => setForm((f) => ({ ...f, refId: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button loading={createPartner.isPending} onClick={submitCreate}>Создать</Button>
          </div>
        </div>
      </Modal>

      {selected && <PartnerDetail partnerId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
