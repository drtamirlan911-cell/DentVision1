import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  ShoppingCart,
  GraduationCap,
  Bot,
  User,
  Stethoscope,
  Calendar,
  Users,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  badge?: number
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'crm', label: 'CRM', icon: <Stethoscope size={20} />, path: '/crm' },
  { id: 'shop', label: 'Shop', icon: <ShoppingCart size={20} />, path: '/shop' },
  { id: 'school', label: 'School', icon: <GraduationCap size={20} />, path: '/school' },
  { id: 'ai', label: 'AI', icon: <Bot size={20} />, path: '/ai' },
  { id: 'profile', label: 'Профиль', icon: <User size={20} />, path: '/profile' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/profile') return location.pathname === '/profile'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Backdrop blur background */}
      <div className="bg-surface-1/80 backdrop-blur-xl border-t border-bdr-subtle">
        <div className="flex items-center justify-around h-14 px-2">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item.path)
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center justify-center w-14 h-full gap-0.5"
              >
                <div
                  className={cn(
                    'relative flex items-center justify-center w-10 h-7 rounded-xl transition-all duration-200',
                    active
                      ? 'text-dv-gold'
                      : 'text-txt-muted'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="bottomnav-indicator"
                      className="absolute inset-0 bg-dv-gold/10 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{item.icon}</span>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-error text-white text-2xs font-bold px-1">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-2xs font-medium transition-colors',
                    active ? 'text-dv-gold' : 'text-txt-muted'
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
        {/* Safe area padding for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  )
}

export { PRIMARY_NAV }
