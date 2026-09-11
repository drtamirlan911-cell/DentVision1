import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Search, Activity, Phone, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { API_URL } from '@/utils/apiOrigin';

interface Study { id: string; name: string; category?: string | null; price?: number | null }
interface Center { id: string; name: string; city?: string | null; address?: string | null; phone?: string | null; rating?: number | null; studies: Study[] }

export default function PublicDiagnosticsDiscovery() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Center | null>(null);

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
          <p className="mt-4 max-w-2xl text-sm leading-6 text-txt-secondary md:text-base">Сравните диагностические центры, исследования и цены. Для персонального заказа и доступа к результатам потребуется авторизация.</p>
        </section>

        <Card padding="md" className="mt-8 border-bdr-subtle">
          <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
            <label className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && discovery.refetch()} placeholder="Город" className="min-h-12 w-full rounded-xl border border-bdr-subtle bg-surface-1 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" />
            </label>
            <label className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && discovery.refetch()} placeholder="Исследование, категория или центр" className="min-h-12 w-full rounded-xl border border-bdr-subtle bg-surface-1 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-dv-gold" />
            </label>
            <Button variant="primary" className="min-h-12" onClick={() => discovery.refetch()} icon={<Search size={15} />}>Найти</Button>
          </div>
        </Card>

        {discovery.isError ? (
          <Card padding="lg" className="mt-6"><p className="text-sm text-txt-muted">Каталог временно недоступен. Повторите поиск.</p></Card>
        ) : discovery.isLoading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2"><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-52 rounded-2xl" /></div>
        ) : centers.length === 0 ? (
          <Card padding="lg" className="mt-6"><div className="flex min-h-40 flex-col items-center justify-center text-center"><Activity size={36} className="opacity-20" /><p className="mt-3 text-sm text-txt-muted">По вашему запросу центры не найдены</p><p className="mt-1 text-xs text-txt-ghost">Измените город или название исследования.</p></div></Card>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {centers.map(center => (
              <motion.button key={center.id} type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSelected(center)} className="text-left">
                <Card padding="md" className="h-full transition-colors hover:border-dv-gold/35">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{center.name}</h2>
                      <p className="mt-1 flex items-center gap-1 text-xs text-txt-muted"><MapPin size={12} />{center.city || 'Город не указан'}{center.address ? ` · ${center.address}` : ''}</p>
                    </div>
                    {center.rating != null && <span className="shrink-0 text-xs text-txt-muted">{Number(center.rating).toFixed(1)}</span>}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {center.studies.slice(0, 6).map(study => <span key={study.id} className="rounded-full border border-bdr-subtle bg-surface-1 px-2.5 py-1 text-xs text-txt-muted">{study.name}{study.price != null ? ` · ${Number(study.price).toLocaleString('ru-RU')} ₸` : ''}</span>)}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs text-txt-muted"><span>{center.studies.length} исследований</span><span className="flex items-center gap-1 text-txt-primary">Подробнее <ArrowRight size={13} /></span></div>
                </Card>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 md:items-center" onClick={() => setSelected(null)}>
          <Card padding="lg" className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-xl font-semibold">{selected.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-txt-muted"><MapPin size={13} />{selected.city || '—'}{selected.address ? ` · ${selected.address}` : ''}</p></div>
              <button type="button" aria-label="Закрыть" onClick={() => setSelected(null)} className="min-h-11 min-w-11 rounded-xl text-txt-muted hover:bg-surface-1"><X size={18} /></button>
            </div>
            {selected.phone && <p className="mt-4 flex items-center gap-2 text-sm text-txt-secondary"><Phone size={14} />{selected.phone}</p>}
            <div className="mt-6 space-y-2">
              {selected.studies.map(study => <div key={study.id} className="flex items-center justify-between gap-4 rounded-xl border border-bdr-subtle bg-surface-1 px-3 py-3"><div><p className="text-sm font-medium">{study.name}</p><p className="mt-0.5 text-xs text-txt-muted">{study.category || 'Диагностика'}</p></div><span className="shrink-0 text-sm font-semibold">{study.price != null ? `${Number(study.price).toLocaleString('ru-RU')} ₸` : 'По запросу'}</span></div>)}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setSelected(null)}>Закрыть</Button>
              <Button variant="primary" onClick={() => navigate(`/login?role=patient&redirect=${encodeURIComponent(`/diagnostics?centerId=${selected.id}`)}`)} icon={<ArrowRight size={15} />}>Заказать исследование</Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
