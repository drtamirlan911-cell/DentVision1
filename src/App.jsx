import React, { useState } from 'react';
import { useAuth, ROLES } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Patients from './pages/Patients';
import Cashier from './pages/Cashier';
import Lab from './pages/Lab';
import AITeam from './pages/AITeam';
import SuperAdmin from './pages/SuperAdmin';
import Staff from './pages/Staff';
import { T, GLOBAL_CSS } from './utils/constants';
import { Spinner, Badge } from './components/ui/BaseComponents';

// All possible nav items
const ALL_NAV = [
  { id: 'dashboard', label: 'Dashboard',    icon: '📊' },
  { id: 'schedule',  label: 'Расписание',   icon: '📅' },
  { id: 'patients',  label: 'Пациенты',     icon: '🦷' },
  { id: 'cashier',   label: 'Финансы',      icon: '💰' },
  { id: 'lab',       label: 'Лаборатория',  icon: '🔬' },
  { id: 'ai',        label: 'AI Команда',   icon: '🤖' },
  { id: 'staff',     label: 'Сотрудники',   icon: '👥' },
  { id: 'admin',     label: 'Super Admin',  icon: '⚙️' },
];

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  director:   'Руководитель',
  admin:      'Администратор',
  doctor:     'Врач',
  assistant:  'Ассистент',
};

const ROLE_COLORS = {
  superadmin: T.purple,
  director:   T.gold,
  admin:      T.sapphire,
  doctor:     T.emerald,
  assistant:  T.teal,
};

export default function App() {
  const { user, clinic, loading, logout, roleInfo } = useAuth();
  const [page, setPage] = useState(() => {
    if (!user) return 'dashboard';
    const r = ROLES[user?.role];
    return r?.pages[0] || 'schedule';
  });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <Spinner size={40} />
        <div style={{ fontSize: 14, color: T.slate }}>Загрузка DentVision…</div>
      </div>
    );
  }

  if (!user) return <Login />;

  // Build nav based on role
  const allowedPages = roleInfo?.pages || ['schedule', 'patients'];
  const menuItems = ALL_NAV.filter(item => allowedPages.includes(item.id));

  // Set first valid page if current page not accessible
  const activePage = allowedPages.includes(page) ? page : allowedPages[0];

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard user={user} clinic={clinic} roleInfo={roleInfo} />;
      case 'schedule':  return <Schedule  clinic={clinic} user={user} roleInfo={roleInfo} />;
      case 'patients':  return <Patients  clinic={clinic} user={user} roleInfo={roleInfo} />;
      case 'cashier':   return <Cashier   clinic={clinic} user={user} roleInfo={roleInfo} />;
      case 'lab':       return <Lab       clinic={clinic} user={user} roleInfo={roleInfo} />;
      case 'ai':        return <AITeam    clinic={clinic} user={user} />;
      case 'staff':     return <Staff     clinic={clinic} user={user} />;
      case 'admin':     return <SuperAdmin user={user} />;
      default:          return <Schedule  clinic={clinic} user={user} roleInfo={roleInfo} />;
    }
  };

  const roleColor = ROLE_COLORS[user.role] || T.gold;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display: 'flex', minHeight: '100vh', background: T.bg }}>

        {/* Sidebar */}
        <aside className="sidebar" style={{
          width: 224,
          background: T.navy,
          borderRight: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
        }}>
          {/* Logo */}
          <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 19, fontWeight: 700, color: T.gold, letterSpacing: '-0.01em' }}>
              🦷 DentVision
            </div>
            <div style={{ fontSize: 10, color: T.slate, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clinic?.name || 'CRM Панель'}
            </div>
          </div>

          {/* Role badge */}
          <div style={{ padding: '10px 18px', borderBottom: `1px solid ${T.borderSub}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: `${roleColor}18`, border: `2px solid ${roleColor}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>
                {ROLES[user.role]?.icon || '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.name || user.login}
                </div>
                <div style={{ fontSize: 10, color: roleColor, fontWeight: 600 }}>
                  {ROLE_LABELS[user.role] || 'Сотрудник'}
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
            {menuItems.map(item => {
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 18px',
                    background: active ? `${T.gold}12` : 'transparent',
                    border: 'none',
                    borderLeft: `3px solid ${active ? T.gold : 'transparent'}`,
                    color: active ? T.gold : T.slate,
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', transition: 'all .12s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = T.slateL; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = T.slate; }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border}` }}>
            {clinic && (
              <div style={{
                fontSize: 10, color: T.slate, marginBottom: 10,
                padding: '6px 8px', background: 'rgba(255,255,255,0.03)',
                borderRadius: 6, display: 'flex', justifyContent: 'space-between',
              }}>
                <span>Тариф:</span>
                <span style={{ color: T.gold, fontWeight: 600, textTransform: 'uppercase' }}>
                  {clinic.plan || 'Starter'}
                </span>
              </div>
            )}
            <button
              onClick={logout}
              style={{
                width: '100%', padding: '8px 12px',
                background: `${T.ruby}10`, border: `1px solid ${T.ruby}22`,
                color: T.ruby, borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >
              🚪 Выйти из системы
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, marginLeft: 224, minHeight: '100vh', background: T.bg }}>
          {renderPage()}
        </main>

        {/* Mobile nav */}
        <nav className="mobile-nav" style={{
          display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
          background: T.navy, borderTop: `1px solid ${T.border}`, zIndex: 100,
          justifyContent: 'space-around', padding: '8px 0',
        }}>
          {menuItems.slice(0, 5).map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              style={{
                background: 'none', border: 'none',
                color: activePage === item.id ? T.gold : T.slate,
                fontSize: 10, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, cursor: 'pointer', padding: '4px 6px', fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
