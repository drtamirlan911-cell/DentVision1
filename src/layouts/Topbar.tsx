import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Bell, Search, ChevronDown, Menu, UserCircle2, Settings, LogOut, Sparkles, AlertTriangle, Package, Calendar } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { T, tg, today } from '../utils/constants';

interface TopbarProps {
  user: any;
  clinic: any;
  data?: any;
  onSearch?: (query: string) => void;
  onLogout?: () => void;
}

function generateNotifications(data: any) {
  if (!data) return [];
  const notes: Array<{ title: string; text: string; type: string; icon: React.ReactNode }> = [];
  const todayStr = today();

  // Today's appointments
  const todayAppts = (data.appointments || []).filter((a: any) => a.date === todayStr && a.status !== 'cancelled');
  if (todayAppts.length > 0) {
    const nextAppt = todayAppts[0];
    const patient = (data.patients || []).find((p: any) => p.id === nextAppt.patientId);
    notes.push({
      title: 'Записи на сегодня',
      text: `${todayAppts.length} записей${patient ? `, ближайшая: ${patient.name} на ${nextAppt.time}` : ''}`,
      type: 'info',
      icon: <Calendar size={14} className="text-[#C9A96E]" />,
    });
  }

  // Debts
  const debts = (data.debts || []).filter((d: any) => d.status === 'pending' && d.amount > (d.paidAmount || 0));
  if (debts.length > 0) {
    const totalDebt = debts.reduce((sum: number, d: any) => sum + (d.amount - (d.paidAmount || 0)), 0);
    notes.push({
      title: 'Долги по оплате',
      text: `${debts.length} должников — ${tg(totalDebt)}`,
      type: 'warning',
      icon: <AlertTriangle size={14} className="text-[#F39C12]" />,
    });
  }

  // Low stock inventory
  const lowStock = (data.inventory || []).filter((i: any) => {
    const min = i.minQuantity || i.min || 0;
    return min > 0 && i.quantity <= min;
  });
  if (lowStock.length > 0) {
    notes.push({
      title: 'Склад',
      text: `${lowStock.length} позиций заканчивается: ${lowStock.map((i: any) => i.name).slice(0, 2).join(', ')}`,
      type: 'warning',
      icon: <Package size={14} className="text-[#E74C3C]" />,
    });
  }

  // Active promotions
  const activePromos = (data.promotions || []).filter((p: any) => p.active);
  if (activePromos.length > 0) {
    notes.push({
      title: 'Акции',
      text: `${activePromos.length} активных промоций`,
      type: 'success',
      icon: <Sparkles size={14} className="text-[#27AE60]" />,
    });
  }

  // Pending bookings
  const pendingBookings = (data.bookings || []).filter((b: any) => b.status === 'pending');
  if (pendingBookings.length > 0) {
    notes.push({
      title: 'Онлайн-записи',
      text: `${pendingBookings.length} заявок ожидают подтверждения`,
      type: 'info',
      icon: <Calendar size={14} className="text-[#2980B9]" />,
    });
  }

  return notes.length > 0 ? notes : [{ title: 'Всё в порядке', text: 'Нет активных уведомлений', type: 'info', icon: <Sparkles size={14} className="text-[#7A8899]" /> }];
}

export function Topbar({ user, clinic, data, onSearch, onLogout }: TopbarProps) {
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

  const notifications = useMemo(() => generateNotifications(data), [data]);
  const unreadCount = notifications.filter(n => n.type !== 'info' || n.title !== 'Всё в порядке').length;

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
              onClick={() => { setShowNotifications((v) => !v); setShowProfile(false); }}
              className="relative rounded-lg p-2 transition-colors hover:bg-white/5"
            >
              <Bell size={20} className="text-[#7A8899]" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E74C3C] text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-[rgba(201,169,110,0.2)] bg-[#0F1A2D] p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Уведомления</p>
                  <span className="text-xs text-[#7A8899]">{notifications.length} новых</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {notifications.map((item, index) => (
                    <div key={index} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                      </div>
                      <p className="mt-1 text-xs text-[#B0BEC5]">{item.text}</p>
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
              onClick={() => { setShowProfile((v) => !v); setShowNotifications(false); }}
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
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[rgba(201,169,110,0.2)] bg-[#0F1A2D] p-3 shadow-xl">
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
