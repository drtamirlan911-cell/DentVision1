import React from 'react';
import { T, PLANS, tg, today } from '../utils/constants';
import { Card, StatCard, Badge } from '../components/ui/BaseComponents';
import { useSubscription, useData } from '../hooks/useData';

const S = { padding: '24px' };

export default function Dashboard({ user, clinic }) {
  const { subscription } = useSubscription(clinic?.id);
  const { patients, appointments, receipts, doctors } = useData(clinic?.id);

  const todayKey = today();
  const todayReceipts = receipts.filter(r => (r.date || todayKey) === todayKey && (r.status === 'paid' || r.status === 'completed'));
  const todayRevenue = todayReceipts.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const todayAppointments = appointments.filter(a => (a.date || todayKey) === todayKey);
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
    load: 70 + (index * 8),
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

  return (
    <div style={S}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 700, color: T.white, margin: 0 }}>
            Добро пожаловать{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ fontSize: 13, color: T.slate, marginTop: 4 }}>
            {clinic?.name || 'DentVision'} · {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {subscription && (
          <Badge type={subscription.plan === 'pro' ? 'warning' : 'info'} size="md">
            ✦ {PLANS[subscription.plan]?.name || 'Pro'}
          </Badge>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <StatCard key={i} title={s.title} value={s.value} icon={s.icon} trend={s.trend} color={s.color} />
        ))}
      </div>

      {/* Additional KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { title: 'Пациентов сегодня', value: patients.length, icon: '👥' },
          { title: 'Записей сегодня', value: todayAppointments.length, icon: '📅' },
          { title: 'Врачей', value: doctors.length, icon: '🧑‍⚕️' },
          { title: 'Чеков', value: todayReceipts.length, icon: '🧾' },
          { title: 'Клиника', value: clinic?.name || 'DentVision', icon: '🏥' },
        ].map((s, i) => (
          <div key={i} style={{
            background: T.card,
            border: `1px solid ${T.borderSub}`,
            borderRadius: 11,
            padding: '14px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.white, fontFamily: 'Georgia,serif' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.slate, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{s.title}</div>
          </div>
        ))}
      </div>

      {/* Doctor Load + Top Services */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="grid-2">
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 18 }}>⚡ Загрузка врачей</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {doctorLoad.map((d, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>{d.name}</span>
                    <span style={{ fontSize: 11, color: T.slate, marginLeft: 8 }}>{d.spec}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: T.slate }}>{d.patients} пац.</span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: d.load > 85 ? T.ruby : d.load > 70 ? T.amber : T.emerald,
                    }}>{d.load}%</span>
                  </div>
                </div>
                <div style={{
                  height: 6,
                  background: 'rgba(255,255,255,0.07)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${d.load}%`,
                    background: d.load > 85 ? T.ruby : d.load > 70 ? T.amber : T.emerald,
                    borderRadius: 4,
                    transition: 'width 1s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 18 }}>🏆 Топ услуг</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topServices.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: `${T.gold}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    color: T.gold,
                    fontWeight: 700,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: T.slateL }}>{s.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: T.white, fontWeight: 600 }}>{s.count} шт</div>
                  <div style={{ fontSize: 11, color: T.gold }}>{tg(s.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Ad Sources + Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-2">
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 16 }}>📣 Источники пациентов</div>
          {adSources.map((a, i) => {
            const total = adSources.reduce((s, x) => s + x.patients, 0);
            const pct = Math.round((a.patients / total) * 100);
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: T.slateL }}>{a.source}</span>
                  <span style={{ fontSize: 13, color: a.color, fontWeight: 600 }}>+{a.patients}</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: a.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 16 }}>🚀 Быстрые действия</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: '+ Новый пациент',    icon: '👤', color: T.gold },
              { label: '+ Запись',           icon: '📅', color: T.sapphire },
              { label: 'Отчёт за день',      icon: '📊', color: T.emerald },
              { label: 'WhatsApp рассылка',  icon: '💬', color: T.teal },
            ].map((a, i) => (
              <button key={i} style={{
                padding: '14px 12px',
                background: `${a.color}10`,
                border: `1px solid ${a.color}25`,
                borderRadius: 10,
                color: a.color,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all .15s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
