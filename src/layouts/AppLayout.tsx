import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../context/AuthContext';
import clsx from 'clsx';

const ALL_NAV_PAGES = [
  'dashboard',
  'schedule',
  'patients',
  'cashier',
  'pricelist',
  'lab',
  'ai',
  'staff',
  'admin',
];

export function AppLayout() {
  const { user, clinic, loading, logout, roleInfo } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#C9A96E]/30 border-t-[#C9A96E] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#7A8899] text-sm">Загрузка DentVision…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowedPages = roleInfo?.pages || ['schedule', 'patients'];

  return (
    <div className="min-h-screen bg-[#080F1A]">
      <Sidebar
        user={user}
        clinic={clinic}
        roleInfo={roleInfo}
        allowedPages={allowedPages}
        onLogout={logout}
      />
      <div className="lg:pl-72">
        <Topbar user={user} clinic={clinic} />
        <main className="p-4 lg:p-6">
          <Outlet context={{ user, clinic, roleInfo }} />
        </main>
      </div>
    </div>
  );
}
