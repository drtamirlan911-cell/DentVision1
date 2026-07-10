import React from 'react';
import { useNavigate } from 'react-router-dom';
import { T, PLANS, tg, today } from '../utils/constants';
import { Card, StatCard, Badge } from '../components/ui/BaseComponents';
import { useSubscription, useData } from '../hooks/useData';

export default function Dashboard({ user, clinic }) {
  const navigate = useNavigate();
  const { subscription } = useSubscription(clinic?.id);
  const { patients, appointments, receipts, doctors } = useData(clinic?.id);

  const todayKey = today();
  const todayReceipts = receipts.filter((r) => (r.date || todayKey) === todayKey && (r.status === 'paid' || r.status === 'completed'));
  const todayRevenue = todayReceipts.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const todayAppointments = appointments.filter((a) => (a.date || todayKey) === todayKey);
  const avgCheck = todayReceipts.length ? Math.round(todayRevenue / todayReceipts.length) : 0;
  const conversion = patients.length && appointments.length ? Math.round((patients.length / appointments.length) * 100) : 0;

  const stats = [
    { title: 'Доход за сегодня', value: tg(todayRevenue), icon: '💰', trend: '+12%', color: T.gold },
    { title: 'Пациентов в клинике', value: patients.length, icon: '👥', trend: '+5%', color: T.emerald },
    { title: 'Средний чек', value: tg(avgCheck), icon: '🧾', trend: '+3%', color: T.sapphire },
    { title: 'Конверсия', value: `${conversion}%`, icon: '📈', trend: '+2%', color: T.purple },
  ];

  const doctorLoad = doctors.slice(0, 3).map((doctor, index) => ({
    name: doctor.name || `Врач ${index + 1}`,
    load: 70 + index * 8,
    patients: Math.max(4, patients.length - index),
    spec: doctor.spec || 'Стоматолог',
  }));

  const topServices = [
    { name: 'Профгигиена', count: Math.max(1, Math.round(patients.length / 2)), revenue: 180000 },
    { name: 'Терапия', count: Math.max(1, Math.round(patients.length / 3)), revenue: 250000 },
    { name: 'Имплантация', count: Math.max(1, Math.round(patients.length / 6)), revenue: 400000 },
  ];

  const adSources = [
    { source: 'Рекомендации', patients: Math.max(4, Math.round(patients.length * 0.4)), color: T.gold },
    { source: 'Instagram', patients: Math.max(3, Math.round(patients.length * 0.25)), color: T.pink },
    { source: 'Google Ads', patients: Math.max(2, Math.round(patients.length * 0.2)), color: T.sapphire },
    { source: '2GIS', patients: Math.max(1, Math.round(patients.length * 0.15)), color: T.emerald },
  ];

  const quickActions = [
    { label: 'Новый пациент', icon: '👤', color: T.gold, path: '/patients' },
    { label: 'Новая запись', icon: '📅', color: T.sapphire, path: '/schedule' },
    { label: 'Прайс-лист', icon: '📋', color: T.emerald, path: '/pricelist' },
    { label: 'AI помощник', icon: '🤖', color: T.teal, path: '/ai' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C9A96E]">DentVision CRM</p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-white">
            Добро пожаловать{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-[#7A8899]">
            {clinic?.name || 'DentVision'} · {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {subscription && (
            <Badge type={subscription.plan === 'pro' ? 'warning' : 'info'} size="md">
              ✦ {PLANS[subscription.plan]?.name || 'Pro'}
            </Badge>
          )}
          <button
            onClick={() => navigate('/schedule')}
            className="rounded-lg border border-[#C9A96E]/25 bg-[#C9A96E]/10 px-3 py-2 text-sm font-semibold text-[#C9A96E] transition-colors hover:bg-[#C9A96E]/20"
          >
            Открыть расписание
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <StatCard key={i} title={s.title} value={s.value} icon={s.icon} trend={s.trend} color={s.color} />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { title: 'Пациентов сегодня', value: patients.length, icon: '👥' },
          { title: 'Записей сегодня', value: todayAppointments.length, icon: '📅' },
          { title: 'Врачей', value: doctors.length, icon: '🧑‍⚕️' },
          { title: 'Чеков', value: todayReceipts.length, icon: '🧾' },
          { title: 'Клиника', value: clinic?.name || 'DentVision', icon: '🏥' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-[rgba(201,169,110,0.15)] bg-[#0E1A2B]/80 p-4 text-center">
            <div className="mb-2 text-2xl">{s.icon}</div>
            <div className="font-serif text-2xl font-bold text-white">{s.value}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[#7A8899]">{s.title}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">⚡ Что важно сегодня</div>
            <span className="text-xs text-[#7A8899]">{todayAppointments.length} записей</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Записи на сегодня', value: todayAppointments.length, hint: 'Проверьте очередь', action: () => navigate('/schedule') },
              { label: 'Новых пациентов', value: patients.length, hint: 'Обработайте обращения', action: () => navigate('/patients') },
              { label: 'Выручка', value: tg(todayRevenue), hint: 'Сравните с прошлым днём', action: () => navigate('/cashier') },
            ].map((item) => (
              <button key={item.label} onClick={item.action} className="flex w-full items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/5 px-3 py-3 text-left transition-colors hover:bg-white/10">
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-[#7A8899]">{item.hint}</p>
                </div>
                <span className="text-sm font-semibold text-[#C9A96E]">{item.value}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-sm font-semibold text-white">🚀 Быстрые действия</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.06)] bg-white/5 px-3 py-4 text-center transition-colors hover:bg-white/10"
                style={{ color: action.color }}
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="text-sm font-semibold">{action.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 text-sm font-semibold text-white">⚡ Загрузка врачей</div>
          <div className="space-y-4">
            {doctorLoad.map((d, i) => (
              <div key={i}>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">{d.name}</span>
                    <span className="ml-2 text-xs text-[#7A8899]">{d.spec}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#7A8899]">
                    <span>{d.patients} пац.</span>
                    <span className="font-semibold" style={{ color: d.load > 85 ? T.ruby : d.load > 70 ? T.amber : T.emerald }}>
                      {d.load}%
                    </span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.load}%`, background: d.load > 85 ? T.ruby : d.load > 70 ? T.amber : T.emerald }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-sm font-semibold text-white">🏆 Топ услуг</div>
          <div className="space-y-3">
            {topServices.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C9A96E]/20 text-[11px] font-bold text-[#C9A96E]">
                    {i + 1}
                  </div>
                  <span className="text-sm text-[#DDE4EA]">{s.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">{s.count} шт</div>
                  <div className="text-xs text-[#C9A96E]">{tg(s.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 text-sm font-semibold text-white">📣 Источники пациентов</div>
          <div className="space-y-3">
            {adSources.map((a, i) => {
              const total = adSources.reduce((s, x) => s + x.patients, 0);
              const pct = Math.round((a.patients / total) * 100);
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-[#DDE4EA]">{a.source}</span>
                    <span className="font-semibold" style={{ color: a.color }}>+{a.patients}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: a.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-sm font-semibold text-white">📌 Краткая подсказка</div>
          <div className="space-y-2 text-sm text-[#DDE4EA]">
            <p>• Следите за сегодняшними записями и не пропускайте активные обращения.</p>
            <p>• Используйте AI-помощник для быстрых ответов по ценам, расписанию и маркетингу.</p>
            <p>• Основные данные на этой странице обновляются по текущей клинике автоматически.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
