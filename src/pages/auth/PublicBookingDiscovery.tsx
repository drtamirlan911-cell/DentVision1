import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, MapPin, Search, Stethoscope } from 'lucide-react';

type Clinic = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  logo?: string | null;
  doctors?: Array<{ id: string; name: string; spec?: string }>;
};

export default function PublicBookingDiscovery() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [city, setCity] = React.useState(params.get('city') || '');
  const [q, setQ] = React.useState(params.get('q') || '');
  const [loading, setLoading] = React.useState(false);
  const [clinics, setClinics] = React.useState<Clinic[]>([]);
  const [error, setError] = React.useState('');

  const search = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (city.trim()) query.set('city', city.trim());
      if (q.trim()) query.set('q', q.trim());
      query.set('limit', '12');
      const response = await fetch(`/api/public/clinics/discover?${query.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Не удалось найти клиники');
      setClinics(data.data?.clinics || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить поиск');
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }, [city, q]);

  React.useEffect(() => { void search(); }, []); // initial discovery

  return (
    <main className="min-h-[100dvh] bg-surface-0 px-4 py-6 text-txt-primary md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate('/')} className="mb-8 text-sm text-txt-secondary hover:text-txt-primary">← DentVision</button>
        <div className="mb-8 max-w-3xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-dv-gold">Запись к врачу</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Найдите стоматолога и удобное время</h1>
          <p className="mt-3 text-txt-secondary md:text-lg">Выберите клинику, врача и свободный слот. Регистрация нужна только на этапе подтверждения записи.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void search(); }} className="mb-8 grid gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-4 md:grid-cols-[1fr_1.5fr_auto]">
          <label className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-0 px-4 py-3">
            <MapPin className="h-4 w-4 text-txt-secondary" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город" className="w-full bg-transparent outline-none" />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-0 px-4 py-3">
            <Search className="h-4 w-4 text-txt-secondary" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Врач, клиника или услуга" className="w-full bg-transparent outline-none" />
          </label>
          <button type="submit" disabled={loading} className="rounded-xl bg-dv-gold px-5 py-3 font-medium text-black disabled:opacity-60">{loading ? 'Поиск…' : 'Найти'}</button>
        </form>

        {error && <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}
        {!loading && !error && clinics.length === 0 && <div className="rounded-2xl border border-border-subtle bg-surface-1 p-8 text-center text-txt-secondary">По вашему запросу пока ничего не найдено.</div>}

        <div className="grid gap-4 md:grid-cols-2">
          {clinics.map((clinic) => (
            <article key={clinic.id} className="rounded-2xl border border-border-subtle bg-surface-1 p-5 transition hover:border-dv-gold/40">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-0"><Stethoscope className="h-5 w-5 text-dv-gold" /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{clinic.name}</h2>
                  <p className="mt-1 text-sm text-txt-secondary">{[clinic.city, clinic.address].filter(Boolean).join(' · ') || 'Адрес уточняется'}</p>
                  {clinic.doctors?.length ? <p className="mt-2 text-xs text-txt-secondary">{clinic.doctors.slice(0, 3).map((d) => d.name).join(', ')}{clinic.doctors.length > 3 ? ' и ещё' : ''}</p> : null}
                </div>
              </div>
              <button onClick={() => navigate(`/book/${clinic.id}`)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-border-subtle px-4 py-3 text-sm font-medium hover:border-dv-gold/50">
                Выбрать клинику <ArrowRight className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
