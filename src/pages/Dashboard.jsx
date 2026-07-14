import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { T, PLANS, tg, today } from '../utils/constants';
import { Card, StatCard, Badge } from '../components/ui/BaseComponents';
import { useSubscription, useData } from '../hooks/useData';
import QrCode from '../components/ui/QrCode';

export default function Dashboard() {
  const { user, clinic } = useOutletContext();
  const navigate = useNavigate();
  const { subscription } = useSubscription(clinic?.id);
  const { patients, appointments, receipts, doctors } = useData(clinic?.id);

  const todayKey = today();
  const currentClinicId = clinic?.id;
  const clinicPatients = patients.filter((p) => !currentClinicId || p.clinicId === currentClinicId);
  const clinicAppointments = appointments.filter((a) => !currentClinicId || a.clinicId === currentClinicId);
  const clinicReceipts = receipts.filter((r) => !currentClinicId || r.clinicId === currentClinicId);
  const clinicDoctors = doctors.filter((d) => !currentClinicId || d.clinicId === currentClinicId);
  const todayReceipts = clinicReceipts.filter((r) => (r.date || todayKey) === todayKey && (r.status === 'paid' || r.status === 'completed'));
  const todayRevenue = todayReceipts.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const todayAppointments = clinicAppointments.filter((a) => (a.date || todayKey) === todayKey);
  const avgCheck = todayReceipts.length ? Math.round(todayRevenue / todayReceipts.length) : 0;
  const conversion = clinicPatients.length && clinicAppointments.length ? Math.round((clinicPatients.length / clinicAppointments.length) * 100) : 0;

  const stats = [
    { title: 'Доход за сегодня', value: tg(todayRevenue, clinic), icon: '💰', trend: '+12%', color: T.gold },
    { title: 'Пациентов в клинике', value: clinicPatients.length, icon: '👥', trend: '+5%', color: T.emerald },
    { title: 'Средний чек', value: tg(avgCheck, clinic), icon: '🧾', trend: '+3%', color: T.sapphire },
    { title: 'Конверсия', value: `${conversion}%`, icon: '📈', trend: '+2%', color: T.purple },
  ];

  const doctorLoad = clinicDoctors.slice(0, 3).map((doctor) => {
    const doctorAppointments = todayAppointments.filter((a) => a.doctorId === doctor.id);
    const uniquePatients = new Set(doctorAppointments.map((a) => a.patientId).filter(Boolean));
    const busyMinutes = doctorAppointments.reduce((sum, a) => sum + Number(a.duration || 60), 0);
    return {
      name: doctor.name || 'Врач',
      load: Math.min(100, Math.round((busyMinutes / 480) * 100)),
      patients: uniquePatients.size,
      spec: doctor.spec || 'Стоматолог',
    };
  });

  const serviceMap = new Map();
  todayReceipts.forEach((receipt) => {
    (receipt.items?.length ? receipt.items : [{ name: receipt.service || 'Услуга', price: receipt.total || receipt.amount || 0, qty: 1 }]).forEach((item) => {
      const key = item.serviceId || item.name || 'service';
      const current = serviceMap.get(key) || { name: item.name || 'Услуга', count: 0, revenue: 0 };
      const qty = Number(item.qty || 1);
      current.count += qty;
      current.revenue += Number(item.price || 0) * qty;
      serviceMap.set(key, current);
    });
  });
  const topServices = Array.from(serviceMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 3);

  const sourceColors = [T.gold, T.pink, T.sapphire, T.emerald];
  const sourceMap = new Map();
  clinicPatients.forEach((patient) => {
    const source = patient.source || patient.referralSource || patient.channel;
    if (source) sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });
  const adSources = Array.from(sourceMap.entries()).map(([source, count], index) => ({
    source, patients: count, color: sourceColors[index % sourceColors.length],
  }));

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const bookingUrl = `${window.location.origin}/book/${clinic?.id || 'your-clinic-id'}`;

  const copyBookingUrl = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = bookingUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

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
          { title: 'Пациентов сегодня', value: clinicPatients.length, icon: '👥' },
          { title: 'Записей сегодня', value: todayAppointments.length, icon: '📅' },
          { title: 'Врачей', value: clinicDoctors.length, icon: '🧑‍⚕️' },
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

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">🌐 Онлайн-запись</div>
            <span className="text-xs text-[#7A8899]">Доступна для пациентов</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="mb-2 text-xs text-[#7A8899]">Ссылка для записи:</p>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/5 px-3 py-2">
                <span className="flex-1 truncate font-mono text-xs text-[#DDE4EA]">{bookingUrl}</span>
                <button onClick={copyBookingUrl} className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors" style={{ background: copiedUrl ? T.emerald : T.gold, color: T.bg }}>
                  {copiedUrl ? '✓ Скопировано' : 'Копировать'}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.open(bookingUrl, '_blank')} className="flex-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/5 px-3 py-2 text-xs font-semibold text-[#DDE4EA] transition-colors hover:bg-white/10">
                  Открыть страницу
                </button>
                <button onClick={() => setShowQr(!showQr)} className="flex-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/5 px-3 py-2 text-xs font-semibold text-[#DDE4EA] transition-colors hover:bg-white/10">
                  {showQr ? 'Скрыть QR' : 'QR-код'}
                </button>
              </div>
            </div>
            {showQr && (
              <div className="shrink-0">
                <QrCode value={bookingUrl} size={120} label="Сканируйте для записи" />
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-sm font-semibold text-white">🎯 Сегодняшняя активность</div>
          <div className="space-y-3">
            {[
              { label: 'Записи на сегодня', value: todayAppointments.length, icon: '📅', hint: 'Проверьте очередь' },
              { label: 'Новых пациентов', value: clinicPatients.length, icon: '👥', hint: 'Обработайте обращения' },
              { label: 'Выручка', value: tg(todayRevenue, clinic), icon: '💰', hint: 'Сравните с прошлым днём' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/5 px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-[#7A8899]">{item.hint}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-[#C9A96E]">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
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
              { label: 'Новых пациентов', value: clinicPatients.length, hint: 'Обработайте обращения', action: () => navigate('/patients') },
              { label: 'Выручка', value: tg(todayRevenue, clinic), hint: 'Сравните с прошлым днём', action: () => navigate('/cashier') },
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
            {doctorLoad.length === 0 && <div className="text-sm text-[#7A8899]">Нет врачей в текущей клинике.</div>}
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
            {topServices.length === 0 && <div className="text-sm text-[#7A8899]">Нет оплаченных услуг за сегодня.</div>}
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
                  <div className="text-xs text-[#C9A96E]">{tg(s.revenue, clinic)}</div>
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
            {adSources.length === 0 && <div className="text-sm text-[#7A8899]">Источники не указаны у пациентов этой клиники.</div>}
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
