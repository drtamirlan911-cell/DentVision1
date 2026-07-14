import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  FileText,
  FlaskConical,
  Bot,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Megaphone,
  Package,
  Stethoscope,
  BookOpen,
  ClipboardList,
  Shield,
  Database,
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { T } from '../utils/constants';
import { ROLES } from '../context/AuthContext';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...classes: (string | undefined | null | false)[]) {
  return twMerge(clsx(classes));
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ALL_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Главная', icon: <LayoutDashboard size={18} />, path: '/dashboard' },
  { id: 'schedule', label: 'Расписание', icon: <Calendar size={18} />, path: '/schedule' },
  { id: 'patients', label: 'Пациенты', icon: <Users size={18} />, path: '/patients' },
  { id: 'medical-card', label: 'Мед. карты', icon: <Stethoscope size={18} />, path: '/medical-card' },
  { id: 'visits', label: 'Журнал посещений', icon: <ClipboardList size={18} />, path: '/visits' },
  { id: 'icd10', label: 'МКБ-10', icon: <BookOpen size={18} />, path: '/icd10' },
  { id: 'documents', label: 'Документы', icon: <FileText size={18} />, path: '/documents' },
  { id: 'cashier', label: 'Финансы', icon: <DollarSign size={18} />, path: '/cashier' },
  { id: 'pricelist', label: 'Прайс-лист', icon: <FileText size={18} />, path: '/pricelist' },
  { id: 'lab', label: 'Лаборатория', icon: <FlaskConical size={18} />, path: '/lab' },
  { id: 'ai', label: 'AI помощник', icon: <Bot size={18} />, path: '/ai' },
  { id: 'promotions', label: 'Акции', icon: <Megaphone size={18} />, path: '/promotions' },
  { id: 'inventory', label: 'Склад', icon: <Package size={18} />, path: '/inventory' },
  { id: 'staff', label: 'Сотрудники', icon: <UserCog size={18} />, path: '/staff' },
  { id: 'audit', label: 'Аудит-журнал', icon: <Shield size={18} />, path: '/audit' },
  { id: 'backup', label: 'Резерв. копии', icon: <Database size={18} />, path: '/backup' },
  { id: 'admin', label: 'Super Admin', icon: <Settings size={18} />, path: '/admin' },
];

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  director: 'Руководитель',
  admin: 'Администратор',
  doctor: 'Врач',
  assistant: 'Ассистент',
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: T.purple,
  director: T.gold,
  admin: T.sapphire,
  doctor: T.emerald,
  assistant: T.teal,
};

interface SidebarProps {
  user: any;
  clinic: any;
  roleInfo: any;
  allowedPages: string[];
  onLogout: () => void;
}

export function Sidebar({ user, clinic, roleInfo, allowedPages, onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarOpen, toggleSidebar, darkMode, toggleDarkMode } = useUIStore();

  const menuItems = ALL_NAV.filter((item) => allowedPages.includes(item.id));
  const roleColor = ROLE_COLORS[user?.role] || T.gold;

  const handleNavClick = (path: string) => {
    navigate(path);
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={toggleSidebar} />
      )}

      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r transition-colors duration-300',
          'border-[rgba(201,169,110,0.15)] bg-[#0D1B2E]'
        )}
      >
        <div className="border-b border-[rgba(201,169,110,0.15)] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🦷</div>
              <div>
                <h1 className="font-serif text-xl font-bold tracking-tight text-[#C9A96E]">DentVision</h1>
                <p className="max-w-[180px] truncate text-xs text-[#7A8899]">{clinic?.name || 'CRM панель'}</p>
              </div>
            </div>
            <button onClick={toggleSidebar} className="rounded-lg p-2 transition-colors hover:bg-white/5 lg:hidden">
              <X size={20} className="text-[#7A8899]" />
            </button>
          </div>
        </div>

        <div className="border-b border-[rgba(255,255,255,0.06)] p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
              style={{ background: `${roleColor}18`, border: `2px solid ${roleColor}40` }}
            >
              {ROLES[user?.role]?.icon || '👤'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{user?.name || user?.login}</p>
              <p className="text-xs font-semibold" style={{ color: roleColor }}>
                {ROLE_LABELS[user?.role] || 'Сотрудник'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="mb-2 px-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#7A8899]">Основное</p>
          </div>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  'mb-1 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-200',
                  isActive
                    ? 'border-l-3 border-[#C9A96E] bg-[#C9A96E]/12 font-semibold text-[#C9A96E]'
                    : 'text-[#7A8899] hover:bg-white/5 hover:text-[#B0BEC5]'
                )}
              >
                <span className={isActive ? 'text-[#C9A96E]' : ''}>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-[rgba(201,169,110,0.15)] p-4">
          {clinic && (
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-[#7A8899]">Тариф</span>
              <span className="text-xs font-semibold uppercase text-[#C9A96E]">{clinic.plan || 'Starter'}</span>
            </div>
          )}

          <div className="rounded-lg border border-[#C9A96E]/15 bg-[#0B1627] p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#7A8899]">Состояние</p>
            <p className="mt-1 text-sm font-semibold text-white">{menuItems.length} рабочих разделов доступно</p>
          </div>

          <button
            onClick={toggleDarkMode}
            className="flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
          >
            <span className="text-xs text-[#7A8899]">{darkMode ? 'Тёмная тема' : 'Светлая тема'}</span>
            {darkMode ? <Moon size={16} className="text-[#C9A96E]" /> : <Sun size={16} className="text-[#F39C12]" />}
          </button>

          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg border border-[#E74C3C]/22 px-3 py-2 text-[#E74C3C] transition-colors hover:bg-[#E74C3C]/10"
          >
            <LogOut size={16} />
            <span className="text-sm font-semibold">Выйти из системы</span>
          </button>
        </div>
      </motion.aside>

      <button
        onClick={toggleSidebar}
        className="fixed left-4 top-4 z-30 rounded-lg border border-[rgba(201,169,110,0.15)] bg-[#0D1B2E] p-3 shadow-lg lg:hidden"
      >
        <Menu size={20} className="text-[#C9A96E]" />
      </button>
    </>
  );
}
