import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Store, Package, Wallet, BarChart3, Plus, Trash2, CheckCircle2, Clock, ShieldCheck, Building2 } from 'lucide-react';
import * as api from '@/utils/api';
import { useToast } from '@/components/ui/ds/Toast';
import { Button } from '@/components/ui/ds/Button';
import { Input } from '@/components/ui/ds/Input';
import { Card, CardContent } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Modal } from '@/components/ui/ds/Modal';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';

interface SupplierCtx { scopeId: string; role: string; supplier?: { id: string; name: string; status: string } }

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает', DOCUMENTS_REVIEW: 'Проверка документов', VERIFIED: 'Проверен', OFFICIAL_PARTNER: 'Официальный партнёр', SUSPENDED: 'Приостановлен',
};

function fmtMoney(minor: string | number | undefined): string {
  const n = Number(minor || 0) / 100;
  return n.toLocaleString('ru-RU') + ' ₸';
}

export default function SupplierWorkspace() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [contexts, setContexts] = useState<SupplierCtx[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<'profile' | 'catalog' | 'analytics'>('catalog');

  const [me, setMe] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', stock: '', category: '', description: '' });
  const [saving, setSaving] = useState(false);

  const [regForm, setRegForm] = useState({ name: '', bin: '', phone: '', email: '', contactPerson: '', legalAddress: '' });
  const [regSaving, setRegSaving] = useState(false);

  const loadAll = useCallback(async (t: string) => {
    const [meRes, prodRes, anRes] = await Promise.all([
      api.supplierWs.me(t).catch(() => null),
      api.supplierWs.products(t).catch(() => []),
      api.supplierWs.analytics(t).catch(() => null),
    ]);
    setMe(meRes);
    setProducts(Array.isArray(prodRes) ? prodRes : []);
    setAnalytics(anRes);
  }, []);

  const enterSupplier = useCallback(async (scopeId: string) => {
    try {
      const res = await api.switchContext('SUPPLIER', scopeId);
      setToken(res.accessToken);
      await loadAll(res.accessToken);
    } catch {
      toast.error('Не удалось войти в кабинет поставщика');
    }
  }, [loadAll, toast]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getMyContexts();
        const sup = (res.contexts || []).filter((c: any) => c.scopeType === 'SUPPLIER');
        setContexts(sup);
        if (sup.length > 0) await enterSupplier(sup[0].scopeId);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadContexts = async () => {
    const res = await api.getMyContexts();
    const sup = (res.contexts || []).filter((c: any) => c.scopeType === 'SUPPLIER');
    setContexts(sup);
    if (sup.length > 0) await enterSupplier(sup[0].scopeId);
  };

  const handleRegister = async () => {
    if (!regForm.name.trim()) { toast.error('Укажите название компании'); return; }
    setRegSaving(true);
    try {
      const supplier = await api.registerAsSupplier({
        name: regForm.name.trim(),
        bin: regForm.bin || undefined,
        phone: regForm.phone || undefined,
        email: regForm.email || undefined,
        contactPerson: regForm.contactPerson || undefined,
        legalAddress: regForm.legalAddress || undefined,
      });
      toast.success('Кабинет создан. Статус: на проверке');
      await reloadContexts();
      if (supplier?.id) await enterSupplier(supplier.id);
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось зарегистрировать компанию');
    } finally {
      setRegSaving(false);
    }
  };

  const canWrite = me?.myRole === 'owner' || me?.myRole === 'manager';

  const handleAdd = async () => {
    if (!token) return;
    if (!form.name.trim() || !form.price) { toast.error('Введите название и цену'); return; }
    setSaving(true);
    try {
      await api.supplierWs.createProduct(token, {
        name: form.name.trim(),
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        category: form.category || undefined,
        description: form.description || undefined,
      });
      toast.success('Товар добавлен');
      setAddOpen(false);
      setForm({ name: '', price: '', stock: '', category: '', description: '' });
      await loadAll(token);
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при добавлении');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await api.supplierWs.deleteProduct(token, id);
      toast.success('Товар удалён');
      await loadAll(token);
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при удалении');
    }
  };

  const handlePayout = async () => {
    if (!token) return;
    const balance = Number(analytics?.balanceMinor || 0);
    if (balance <= 0) { toast.error('Нет средств для вывода'); return; }
    try {
      await api.supplierWs.requestPayout(token, { amountMinor: String(balance) });
      toast.success('Заявка на выплату создана');
      await loadAll(token);
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при запросе выплаты');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-9 w-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" /></div>;
  }

  if (contexts.length === 0) {
    return (
      <div className="p-6 max-w-[900px] mx-auto space-y-4">
        <PageHeader title="Кабинет продавца" subtitle="Управление магазином поставщика" icon={<Store size={22} />} />
        <EmptyState
          icon={<Store size={36} />}
          title="Откройте кабинет продавца"
          description="Зарегистрируйте компанию-поставщика — вы станете её владельцем. Или попросите администратора платформы привязать ваш аккаунт к уже существующему поставщику (по email)."
        />
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-medium text-white">Регистрация компании</p>
            <Input
              label="Название компании *"
              value={regForm.name}
              onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
              placeholder="ТОО DentSupply"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="БИН" value={regForm.bin} onChange={(e) => setRegForm({ ...regForm, bin: e.target.value })} />
              <Input label="Телефон" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} />
              <Input label="Email" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} />
              <Input label="Контактное лицо" value={regForm.contactPerson} onChange={(e) => setRegForm({ ...regForm, contactPerson: e.target.value })} />
            </div>
            <Input
              label="Юр. адрес"
              value={regForm.legalAddress}
              onChange={(e) => setRegForm({ ...regForm, legalAddress: e.target.value })}
            />
            <div className="flex justify-end pt-1">
              <Button onClick={handleRegister} disabled={regSaving}>
                {regSaving ? 'Создание…' : 'Создать кабинет'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TABS: Array<{ id: typeof tab; label: string; icon: React.ReactNode }> = [
    { id: 'catalog', label: 'Каталог', icon: <Package size={15} /> },
    { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={15} /> },
    { id: 'profile', label: 'Профиль', icon: <Building2 size={15} /> },
  ];

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <PageHeader
        title="Кабинет продавца"
        subtitle={me?.name || 'Магазин поставщика'}
        icon={<Store size={22} />}
        actions={me && (
          <Badge variant={me.status === 'VERIFIED' || me.status === 'OFFICIAL_PARTNER' ? 'success' : 'gold'}>
            {me.status === 'VERIFIED' || me.status === 'OFFICIAL_PARTNER' ? <ShieldCheck size={12} className="inline mr-1" /> : <Clock size={12} className="inline mr-1" />}
            {STATUS_LABEL[me.status] || me.status}
          </Badge>
        )}
      />

      {/* Tabs */}
      <div className="flex gap-1 mt-4 mb-5 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-transparent text-[#7A8899] hover:text-white'}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Catalog */}
      {tab === 'catalog' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#7A8899]">Товаров: {products.length}</p>
            {canWrite && <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>Добавить товар</Button>}
          </div>
          {products.length === 0 ? (
            <EmptyState icon={<Package size={32} />} title="Нет товаров" description="Добавьте первый товар в свой каталог." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                  <Card>
                    <CardContent>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{p.name}</p>
                          <p className="text-xs text-[#7A8899] mt-0.5">{p.category || 'Без категории'} · остаток {p.stock}</p>
                          <p className="text-sm text-[#C9A96E] font-semibold mt-1.5">{Number(p.price).toLocaleString('ru-RU')} ₸</p>
                        </div>
                        {canWrite && (
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-[#E74C3C] hover:bg-[#E74C3C]/10 transition-colors shrink-0" aria-label="Удалить">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics */}
      {tab === 'analytics' && analytics && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCell icon={<Wallet size={16} />} label="Баланс кошелька" value={fmtMoney(analytics.balanceMinor)} />
            <StatCell icon={<BarChart3 size={16} />} label="Всего заработано" value={fmtMoney(analytics.earnedMinor)} />
            <StatCell icon={<CheckCircle2 size={16} />} label="Продаж" value={String(analytics.salesCount)} />
            <StatCell icon={<Package size={16} />} label="Товаров" value={String(analytics.productCount)} />
          </div>
          <div className="mt-5">
            <Button variant="outline" icon={<Wallet size={15} />} disabled={!canWrite || Number(analytics.balanceMinor) <= 0} onClick={handlePayout}>
              Запросить выплату ({fmtMoney(analytics.balanceMinor)})
            </Button>
            <p className="text-xs text-[#7A8899] mt-2">Выплаты подтверждаются платформой.</p>
          </div>
        </div>
      )}

      {/* Profile */}
      {tab === 'profile' && me && (
        <ProfileTab me={me} canWrite={canWrite} token={token!} onSaved={() => token && loadAll(token)} />
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Новый товар">
        <div className="space-y-3">
          <Input label="Название *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Имплант Straumann BLT" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Цена, ₸ *" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="150000" />
            <Input label="Остаток" type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} placeholder="10" />
          </div>
          <Input label="Категория" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Импланты" />
          <Input label="Описание" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Краткое описание" />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button variant="primary" loading={saving} onClick={handleAdd} icon={<Plus size={15} />}>Добавить</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-4 bg-[#0D1B2E] border border-[rgba(255,255,255,0.06)] rounded-[14px]">
      <div className="flex items-center gap-2 text-[#C9A96E] mb-2">{icon}</div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-[#7A8899] mt-0.5">{label}</p>
    </div>
  );
}

function ProfileTab({ me, canWrite, token, onSaved }: { me: any; canWrite: boolean; token: string; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: me.name || '', bin: me.bin || '', legalAddress: me.legalAddress || '', contactPerson: me.contactPerson || '', phone: me.phone || '', email: me.email || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.supplierWs.updateMe(token, form);
      toast.success('Профиль сохранён');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[560px] space-y-3">
      <Input label="Название компании" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={!canWrite} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="БИН" value={form.bin} onChange={(e) => setForm((f) => ({ ...f, bin: e.target.value }))} disabled={!canWrite} />
        <Input label="Контактное лицо" value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} disabled={!canWrite} />
      </div>
      <Input label="Юридический адрес" value={form.legalAddress} onChange={(e) => setForm((f) => ({ ...f, legalAddress: e.target.value }))} disabled={!canWrite} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Телефон" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} disabled={!canWrite} />
        <Input label="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!canWrite} />
      </div>
      {canWrite && <Button variant="primary" loading={saving} onClick={save}>Сохранить профиль</Button>}
    </div>
  );
}
