import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Search, Activity, Phone, X, Check, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { API_URL } from '@/utils/apiOrigin';

interface Study { id: string; name: string; category?: string | null; price?: number | null; durationMin?: number | null }
interface Center { id: string; name: string; city?: string | null; address?: string | null; phone?: string | null; rating?: number | null; studies: Study[] }
interface OrderResult { id: string; centerName: string; studyName: string; date: string; time: string; status: string }

const tomorrow = () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

export default function PublicDiagnosticsDiscovery() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Center | null>(null);
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [orderError, setOrderError] = useState('');
  const [trackId, setTrackId] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [tracking, setTracking] = useState<any>(null);
  const [trackError, setTrackError] = useState('');

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (city.trim()) p.set('city', city.trim());
    if (query.trim()) p.set('q', query.trim());
    return p.toString();
  }, [city, query]);

  const discovery = useQuery({
    queryKey: ['public-diagnostics', city, query],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/public/diagnostics/discover${params ? `?${params}` : ''}`);
      if (!response.ok) throw new Error('Не удалось загрузить каталог');
      return response.json() as Promise<{ ok: boolean; data?: { centers?: Center[] } }>;
    },
    staleTime: 60_000,
  });

  const centers = discovery.data?.data?.centers ?? [];

  const openOrder = (center: Center, study: Study) => {
    setSelected(center);
    setSelectedStudy(study);
    setOrderOpen(true);
    setOrderError('');
    setOrder(null);
  };

  const submitOrder = async () => {
    if (!selected || !selectedStudy) return;
    setSubmitting(true); setOrderError('');
    try {
      const response = await fetch(`${API_URL}/api/public/diagnostics/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centerId: selected.id, studyId: selectedStudy.id, patientName: name, patientPhone: phone, date, time, notes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Не удалось отправить заявку');
      setOrder(payload.data);
      setTrackId(payload.data.id);
      setTrackPhone(phone);
    } catch (error: any) {
      setOrderError(error?.message || 'Не удалось отправить заявку');
    } finally { setSubmitting(false); }
  };

  const checkStatus = async () => {
    setTracking(null); setTrackError('');
    try {
      const p = new URLSearchParams({ phone: trackPhone });
      const response = await fetch(`${API_URL}/api/public/diagnostics/order/${encodeURIComponent(trackId)}?${p}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Заявка не найдена');
      setTracking(payload.data);
    } catch (error: any) { setTrackError(error?.message || 'Не удалось получить статус'); }
  };

  return (
    <main className="min-h-[100dvh] bg-surface-0 text-txt-primary">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <header className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate('/')} className="text-left min-h-11">
            <span className="block text-[20px] leading-6 tracking-[-0.02em]">DentVision</span>
            <span className="block text-[10px] leading-3 text-dv-gold">Diagnostics · by Dr.Tamirlan</span>
          </button>
          <Button variant="ghost" onClick={() => navigate('/login')} className="min-h-11">Войти</Button>
        </header>

        <section className="mt-12 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-medium text-dv-gold"><Activity size={15} /> Диагностика</div>
          <h1 className="mt-4 text-4xl font-normal tracking-[-0.035em] md:text-6xl">Найдите нужное исследование</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-txt-secondary md:text-base">Сравните диагностические центры и цены, затем отправьте заявку без регистрации. После отправки сохраните номер заявки — он нужен для проверки статуса.</p>
        </section>

        <Card padding="md" className="mt-8 border-bdr-subtle">
          <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
            <label className="relative"><MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" /><input value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && discovery.refetch()} placeholder="Город" className="min-h-12 w-full rounded-xl border border-bdr-subtle bg-surface-1 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /></label>
            <label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && discovery.refetch()} placeholder="Исследование, категория или центр" className="min-h-12 w-full rounded-xl border border-bdr-subtle bg-surface-1 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /></label>
            <Button variant="primary" className="min-h-12" onClick={() => discovery.refetch()} icon={<Search size={15} />}>Найти</Button>
          </div>
        </Card>

        {discovery.isError ? <Card padding="lg" className="mt-6"><p className="text-sm text-txt-muted">Каталог временно недоступен. Повторите поиск.</p></Card>
          : discovery.isLoading ? <div className="mt-6 grid gap-4 md:grid-cols-2"><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-52 rounded-2xl" /></div>
          : centers.length === 0 ? <Card padding="lg" className="mt-6"><div className="flex min-h-40 flex-col items-center justify-center text-center"><Activity size={36} className="opacity-20" /><p className="mt-3 text-sm text-txt-muted">По вашему запросу центры не найдены</p><p className="mt-1 text-xs text-txt-ghost">Измените город или название исследования.</p></div></Card>
          : <div className="mt-6 grid gap-4 md:grid-cols-2">{centers.map(center => (
            <motion.div key={center.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card padding="md" className="h-full border-bdr-subtle">
                <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="truncate text-base font-semibold">{center.name}</h2><p className="mt-1 flex items-center gap-1 text-xs text-txt-muted"><MapPin size={12} />{center.city || 'Город не указан'}{center.address ? ` · ${center.address}` : ''}</p></div>{center.rating != null && <span className="shrink-0 text-xs text-txt-muted">{Number(center.rating).toFixed(1)}</span>}</div>
                <div className="mt-5 space-y-2">{center.studies.slice(0, 6).map(study => <div key={study.id} className="flex items-center justify-between gap-3 rounded-xl border border-bdr-subtle bg-surface-1 px-3 py-3"><div className="min-w-0"><p className="text-sm font-medium truncate">{study.name}</p><p className="mt-0.5 text-xs text-txt-muted">{study.category || 'Диагностика'}{study.durationMin ? ` · ${study.durationMin} мин` : ''}</p></div><div className="flex shrink-0 items-center gap-2"><span className="text-sm font-semibold">{study.price != null ? `${Number(study.price).toLocaleString('ru-RU')} ₸` : 'По запросу'}</span><Button variant="ghost" className="min-h-9 px-3" onClick={() => openOrder(center, study)}>Записаться</Button></div></div>)}</div>
                <div className="mt-5 flex items-center justify-between text-xs text-txt-muted"><span>{center.studies.length} исследований</span>{center.phone && <span className="flex items-center gap-1"><Phone size={12} />{center.phone}</span>}</div>
              </Card>
            </motion.div>
          ))}</div>}

        <Card padding="md" className="mt-8 border-bdr-subtle">
          <div className="flex items-start gap-3"><ClipboardList size={18} className="mt-0.5 text-dv-gold" /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Проверить заявку</h2><p className="mt-1 text-xs text-txt-muted">Введите номер заявки и телефон, который указали при записи.</p><div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]"><input value={trackId} onChange={e => setTrackId(e.target.value)} placeholder="Номер заявки" className="min-h-11 rounded-xl border border-bdr-subtle bg-surface-1 px-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /><input value={trackPhone} onChange={e => setTrackPhone(e.target.value)} placeholder="Телефон" className="min-h-11 rounded-xl border border-bdr-subtle bg-surface-1 px-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /><Button variant="secondary" className="min-h-11" onClick={checkStatus}>Проверить</Button></div>{trackError && <p className="mt-2 text-xs text-red-400">{trackError}</p>}{tracking && <div className="mt-3 rounded-xl border border-bdr-subtle bg-surface-1 p-3 text-sm"><div className="flex items-center justify-between gap-3"><span>{tracking.study?.name || 'Исследование'}</span><span className="font-medium">{tracking.status === 'confirmed' ? 'Подтверждено' : tracking.status === 'completed' ? 'Завершено' : tracking.status === 'cancelled' ? 'Отменено' : 'Ожидает подтверждения'}</span></div><p className="mt-1 text-xs text-txt-muted">{tracking.center?.name} · {tracking.date} · {tracking.time}</p></div>}</div></div>
        </Card>
      </div>

      {orderOpen && selected && selectedStudy && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 md:items-center" onClick={() => !submitting && setOrderOpen(false)}>
        <Card padding="lg" className="w-full max-w-xl max-h-[92dvh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-dv-gold">Запись на исследование</p><h2 className="mt-1 text-xl font-semibold">{selectedStudy.name}</h2><p className="mt-1 text-sm text-txt-muted">{selected.name} · {selected.city || 'Город не указан'}</p></div><button type="button" onClick={() => !submitting && setOrderOpen(false)} className="min-h-11 min-w-11 rounded-xl text-txt-muted hover:bg-surface-1"><X size={18} /></button></div>
          {order ? <div className="mt-7"><div className="flex h-12 w-12 items-center justify-center rounded-full border border-dv-gold/40 text-dv-gold"><Check size={22} /></div><h3 className="mt-4 text-lg font-semibold">Заявка отправлена</h3><p className="mt-2 text-sm text-txt-secondary">Центр должен подтвердить выбранное время.</p><div className="mt-4 rounded-2xl border border-bdr-subtle bg-surface-1 p-4 text-sm"><div className="flex justify-between gap-3"><span className="text-txt-muted">Номер заявки</span><span className="font-mono font-medium">{order.id}</span></div><div className="mt-2 flex justify-between gap-3"><span className="text-txt-muted">Дата и время</span><span>{order.date} · {order.time}</span></div></div><div className="mt-5 flex gap-2"><Button variant="primary" onClick={() => { setOrderOpen(false); setTrackId(order.id); setTrackPhone(phone); }}>Готово</Button><Button variant="ghost" onClick={() => { setOrderOpen(false); setSelected(null); setSelectedStudy(null); }}>Закрыть</Button></div></div>
            : <div className="mt-6 space-y-3"><label className="block"><span className="mb-1.5 block text-xs text-txt-muted">ФИО</span><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Ваше имя" className="min-h-12 w-full rounded-xl border border-bdr-subtle bg-surface-1 px-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /></label><label className="block"><span className="mb-1.5 block text-xs text-txt-muted">Телефон</span><input value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="+7 700 000 00 00" className="min-h-12 w-full rounded-xl border border-bdr-subtle bg-surface-1 px-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs text-txt-muted">Дата</span><input type="date" min={tomorrow()} value={date} onChange={e => setDate(e.target.value)} className="min-h-12 w-full rounded-xl border border-bdr-subtle bg-surface-1 px-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /></label><label className="block"><span className="mb-1.5 block text-xs text-txt-muted">Желаемое время</span><input type="time" value={time} onChange={e => setTime(e.target.value)} className="min-h-12 w-full rounded-xl border border-bdr-subtle bg-surface-1 px-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /></label></div><label className="block"><span className="mb-1.5 block text-xs text-txt-muted">Комментарий <span className="text-txt-ghost">необязательно</span></span><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Например: нужен CBCT верхней челюсти" className="w-full resize-none rounded-xl border border-bdr-subtle bg-surface-1 px-3 py-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" /></label>{orderError && <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">{orderError}</p>}<div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><Button variant="ghost" disabled={submitting} onClick={() => setOrderOpen(false)}>Отмена</Button><Button variant="primary" disabled={submitting || !name.trim() || !phone.trim() || !date || !time} onClick={submitOrder} icon={<ArrowRight size={15} />}>{submitting ? 'Отправляем…' : 'Отправить заявку'}</Button></div><p className="text-[11px] leading-5 text-txt-ghost">Заявка отправляется выбранному диагностическому центру. Медицинские данные на этом шаге не требуются.</p></div>}
        </Card>
      </div>}
    </main>
  );
}
