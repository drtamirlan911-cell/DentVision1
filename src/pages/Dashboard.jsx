import React, { useState } from 'react';
import { T, PLANS, tg } from '../utils/constants';
import { Card, StatCard, Badge, PBtn, GBtn } from '../components/ui/BaseComponents';
import { useSubscription } from '../hooks/useData';

const S = { padding: '24px' };

export default function Dashboard({ user, clinic }) {
  const { subscription } = useSubscription(clinic?.id);

  const stats = [
    { title: 'Доход за день',    value: tg(125000), icon: '💰', trend: '+12%', color: T.gold },
    { title: 'Доход за месяц',   value: tg(2450000), icon: '📊', trend: '+8%',  color: T.emerald },
    { title: 'Средний чек',      value: tg(45000),  icon: '🧾', trend: '+5%',  color: T.sapphire },
    { title: 'Конверсия',        value: '68%',      icon: '📈', trend: '+3%',  color: T.purple },
  ];

  const doctorLoad = [
    { name: 'Д-р Ахметов',  load: 85, patients: 12, spec: 'Терапевт' },
    { name: 'Д-р Омарова',  load: 72, patients: 9,  spec: 'Ортопед' },
    { name: 'Д-р Ким',      load: 90, patients: 14, spec: 'Хирург' },
  ];

  const topServices = [
    { name: 'Лечение кариеса',  count: 45, revenue: 675000 },
    { name: 'Профгигиена',       count: 38, revenue: 684000 },
    { name: 'Удаление',          count: 22, revenue: 264000 },
    { name: 'Имплантация',       count: 15, revenue: 3000000 },
  ];

  const adSources = [
    { source: 'Рекомендации', patients: 32, color: T.gold },
    { source: 'Instagram',    patients: 24, color: T.pink },
    { source: 'Google Ads',   patients: 18, color: T.sapphire },
    { source: '2GIS',         patients: 11, color: T.emerald },
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
          { title: 'Пациентов сегодня', value: '14', icon: '👥' },
          { title: 'Записей на неделю', value: '67', icon: '📅' },
          { title: 'Отмен за месяц',    value: '8',  icon: '❌' },
          { title: 'Неявки',            value: '3',  icon: '🚫' },
          { title: 'NPS клиники',       value: '4.8 ⭐', icon: '⭐' },
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
