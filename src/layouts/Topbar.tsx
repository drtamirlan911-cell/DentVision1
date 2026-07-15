import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  User,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Badge } from '@/components/ui/ds/Badge'
import { Separator } from '@/components/ui/ds/Misc'
import { useUIStore } from '@/stores/useUIStore'
import { useAuth } from '@/context/AuthContext'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Главная',
  '/crm/schedule': 'Расписание',
  '/crm/patients': 'Пациенты',
  '/crm/medical-card': 'Мед. карты',
  '/crm/visits': 'Журнал посещений',
  '/crm/icd10': 'МКБ-10',
  '/crm/documents': 'Документы',
  '/crm/cashier': 'Финансы',
  '/crm/pricelist': 'Прайс-лист',
  '/crm/lab': 'Лаборатория',
  '/ai': 'AI Помощник',
  '/crm/promotions': 'Акции',
  '/crm/inventory': 'Склад',
  '/crm/staff': 'Сотрудники',
  '/admin': 'Super Admin',
  '/audit': 'Аудит-журнал',
  '/backup': 'Резерв. копии',
  '/shop': 'DentVision Shop',
  '/school': 'DentVision School',
  '/analytics': 'Аналитика',
  '/settings': 'Настройки',
}

export function Topbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clinic, logout } = useAuth()
  const { toggleSidebar } = useUIStore()
  const [showProfile, setShowProfile] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const profileRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const pageTitle = PAGE_TITLES[location.pathname] || (() => {
    const parts = location.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      const subPath = '/' + parts[0] + '/' + parts[1]
      if (PAGE_TITLES[subPath]) return PAGE_TITLES[subPath]
    }
    return 'DentVision'
  })()

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 bg-surface-1/80 backdrop-blur-xl border-b border-bdr-subtle">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="hidden md:block">
            <h2 className="text-base font-semibold text-txt-primary">{pageTitle}</h2>
          </div>
        </div>

        {/* Center — Search */}
        <button
          onClick={() => setShowSearch(true)}
          className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg bg-surface-2 border border-bdr-subtle text-txt-muted text-sm hover:border-bdr/50 transition-colors max-w-xs w-64"
        >
          <Search size={14} />
          <span className="flex-1 text-left truncate">Поиск...</span>
          <kbd className="text-2xs bg-surface-3 px-1.5 py-0.5 rounded text-txt-ghost font-mono">Ctrl+K</kbd>
        </button>

        {/* Right */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-white/5 transition-colors">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error" />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Avatar name={user?.name || user?.login || '?'} size="xs" />
              <span className="hidden md:block text-sm text-txt-secondary max-w-[100px] truncate">
                {user?.name || user?.login}
              </span>
              <ChevronDown size={14} className="text-txt-muted" />
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-bdr-subtle bg-surface-1 shadow-modal overflow-hidden"
                >
                  {/* User info */}
                  <div className="px-3 py-3 border-b border-bdr-subtle">
                    <p className="text-sm font-medium text-txt-primary truncate">{user?.name || user?.login}</p>
                    <p className="text-2xs text-txt-muted mt-0.5">{clinic?.name}</p>
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5">
                    <button
                      onClick={() => { navigate('/settings'); setShowProfile(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-txt-secondary hover:bg-white/5 hover:text-txt-primary transition-colors"
                    >
                      <Settings size={15} />
                      Настройки
                    </button>
                    <button
                      onClick={() => { navigate('/crm/schedule'); setShowProfile(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-txt-secondary hover:bg-white/5 hover:text-txt-primary transition-colors"
                    >
                      <User size={15} />
                      Мой профиль
                    </button>
                  </div>

                  <Separator />

                  <div className="p-1.5">
                    <button
                      onClick={() => { logout(); navigate('/login') }}
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-error hover:bg-error/10 transition-colors"
                    >
                      <LogOut size={15} />
                      Выйти
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Search overlay */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSearch(false)} />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-lg rounded-2xl border border-bdr-subtle bg-surface-1 shadow-modal overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 h-12">
                <Search size={18} className="text-txt-muted shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск пациентов, документов, товаров..."
                  className="flex-1 bg-transparent text-sm text-txt-primary placeholder:text-txt-muted outline-none"
                />
                <button
                  onClick={() => setShowSearch(false)}
                  className="flex h-6 items-center rounded bg-surface-3 px-1.5 text-2xs text-txt-muted"
                >
                  Esc
                </button>
              </div>
              <div className="border-t border-bdr-subtle p-3">
                <p className="text-xs text-txt-muted text-center py-6">
                  Начните вводить для поиска...
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
