import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../context/AuthContext';

export function AppLayout() {
  const { user, clinic, loading, logout, roleInfo } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(201,169,110,0.14),_transparent_40%),_#060D18]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#C9A96E]/30 border-t-[#C9A96E]" />
          <p className="text-sm text-[#7A8899]">Загрузка DentVision…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowedPages = roleInfo?.pages || ['schedule', 'patients'];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,169,110,0.08),_transparent_35%),_#060D18] text-slate-100">
      <Sidebar
        user={user}
        clinic={clinic}
        roleInfo={roleInfo}
        allowedPages={allowedPages}
        onLogout={logout}
      />
      <div className="lg:pl-72">
        <Topbar user={user} clinic={clinic} onLogout={logout} />
        <main className="mx-auto max-w-7xl p-4 lg:p-6">
          <Outlet context={{ user, clinic, roleInfo }} />
        </main>
      </div>
    </div>
  );
}
