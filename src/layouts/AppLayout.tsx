import React from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { BottomNav } from '@/components/ui/ds/BottomNav'
import { useAuth } from '@/context/AuthContext'

export function AppLayout() {
  const { user, isAuthenticated, roleInfo, logout } = useAuth()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  const allowedPages = roleInfo?.pages || []

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar allowedPages={allowedPages} onLogout={logout} />
      </div>

      {/* Mobile sidebar */}
      <div className="md:hidden">
        <Sidebar allowedPages={allowedPages} onLogout={logout} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 md:ml-[var(--dv-sidebar-width)]">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="page-enter p-4 md:p-6 pb-20 md:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  )
}
