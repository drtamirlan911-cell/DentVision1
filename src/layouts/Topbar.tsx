import React, { useEffect, useRef, useState } from 'react';
import { Bell, Search, ChevronDown, Menu, UserCircle2, Settings, LogOut, Sparkles } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { T } from '../utils/constants';

interface TopbarProps {
  user: any;
  clinic: any;
  onSearch?: (query: string) => void;
  onLogout?: () => void;
}

export function Topbar({ user, clinic, onSearch, onLogout }: TopbarProps) {
  const { toggleSidebar } = useUIStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const todayLabel = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const notifications = [
    { title: 'Новая запись', text: 'Пациент Иванова М. записана на 14:30', type: 'info' },
    { title: 'Долг по оплате', text: 'Петров В.В. — 120 000 ₸', type: 'warning' },
    { title: 'Склад', text: 'Анестетик заканчивается', type: 'success' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[rgba(201,169,110,0.15)] bg-[#0D1B2E]/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="rounded-lg p-2 transition-colors hover:bg-white/5 lg:hidden">
            <Menu size={18} className="text-[#C9A96E]" />
          </button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-white">Оперативная панель</p>
            <p className="text-xs text-[#7A8899]">{todayLabel}</p>
          </div>
        </div>

        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8899]" />
            <input
              type="text"
              placeholder="Поиск по пациентам и задачам"
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-full rounded-lg border border-[rgba(201,169,110,0.15)] bg-white/5 py-2 pl-10 pr-4 text-sm text-white transition-colors placeholder:text-[#7A8899] focus:border-[#C9A96E] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications((v) => !v)}
              className="relative rounded-lg p-2 transition-colors hover:bg-white/5"
            >
              <Bell size={20} className="text-[#7A8899]" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#E74C3C]" />
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[rgba(201,169,110,0.2)] bg-[#0F1A2D] p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Уведомления</p>
                  <span className="text-xs text-[#7A8899]">3 новых</span>
                </div>
                <div className="space-y-2">
                  {notifications.map((item, index) => (
                    <div key={index} className="rounded-lg border border-white/10 bg-white/5 p-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[#C9A96E]" />
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                      </div>
                      <p className="mt-1 text-xs text-[#7A8899]">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden h-6 w-px bg-[rgba(201,169,110,0.15)] md:block" />

          <div className="relative flex items-center gap-3 pl-2" ref={profileRef}>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-white">{user?.name || user?.login}</p>
              <p className="text-xs text-[#7A8899]">{clinic?.name || ''}</p>
            </div>
            <button
              onClick={() => setShowProfile((v) => !v)}
              className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-white/5"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm"
                style={{ background: `${T.gold}18`, border: `2px solid ${T.gold}40` }}
              >
                {user?.name?.charAt(0) || '👤'}
              </div>
              <ChevronDown size={16} className="text-[#7A8899]" />
            </button>
            {showProfile && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[rgba(201,169,110,0.2)] bg-[#0F1A2D] p-3 shadow-xl">
                <div className="mb-3 flex items-center gap-3 rounded-lg bg-white/5 p-2">
                  <UserCircle2 size={18} className="text-[#C9A96E]" />
                  <div>
                    <p className="text-sm font-semibold text-white">{user?.name || user?.login}</p>
                    <p className="text-xs text-[#7A8899]">{user?.role || 'Сотрудник'}</p>
                  </div>
                </div>
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#DDE4EA] transition-colors hover:bg-white/10">
                  <Settings size={16} className="text-[#7A8899]" />
                  Настройки профиля
                </button>
                <button
                  onClick={onLogout}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#E74C3C] transition-colors hover:bg-[#E74C3C]/10"
                >
                  <LogOut size={16} />
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
