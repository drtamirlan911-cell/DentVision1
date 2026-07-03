import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Stethoscope,
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
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/dashboard' },
  { id: 'schedule', label: 'Расписание', icon: <Calendar size={18} />, path: '/schedule' },
  { id: 'patients', label: 'Пациенты', icon: <Users size={18} />, path: '/patients' },
  { id: 'cashier', label: 'Финансы', icon: <DollarSign size={18} />, path: '/cashier' },
  { id: 'pricelist', label: 'Прайс-лист', icon: <FileText size={18} />, path: '/pricelist' },
  { id: 'lab', label: 'Лаборатория', icon: <FlaskConical size={18} />, path: '/lab' },
  { id: 'ai', label: 'AI Команда', icon: <Bot size={18} />, path: '/ai' },
  { id: 'staff', label: 'Сотрудники', icon: <UserCog size={18} />, path: '/staff' },
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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col',
          'w-72 border-r transition-colors duration-300',
          'bg-[#0D1B2E] border-[rgba(201,169,110,0.15)]'
        )}
      >
        {/* Logo */}
        <div className="p-5 border-b border-[rgba(201,169,110,0.15)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🦷</div>
              <div>
                <h1 className="font-serif text-xl font-bold text-[#C9A96E] tracking-tight">
                  DentVision
                </h1>
                <p className="text-xs text-[#7A8899] truncate max-w-[180px]">
                  {clinic?.name || 'CRM Панель'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X size={20} className="text-[#7A8899]" />
            </button>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{
                background: `${roleColor}18`,
                border: `2px solid ${roleColor}40`,
              }}
            >
              {ROLES[user?.role]?.icon || '👤'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {user?.name || user?.login}
              </p>
              <p className="text-xs" style={{ color: roleColor, fontWeight: 600 }}>
                {ROLE_LABELS[user?.role] || 'Сотрудник'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1',
                  'transition-all duration-200 text-left',
                  isActive
                    ? 'bg-[#C9A96E]/12 border-l-3 border-[#C9A96E] text-[#C9A96E] font-semibold'
                    : 'text-[#7A8899] hover:text-[#B0BEC5] hover:bg-white/5'
                )}
              >
                <span className={isActive ? 'text-[#C9A96E]' : ''}>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-[rgba(201,169,110,0.15)] space-y-3">
          {/* Plan Badge */}
          {clinic && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
              <span className="text-xs text-[#7A8899]">Тариф:</span>
              <span className="text-xs font-semibold uppercase text-[#C9A96E]">
                {clinic.plan || 'Starter'}
              </span>
            </div>
          )}

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="text-xs text-[#7A8899]">
              {darkMode ? 'Тёмная тема' : 'Светлая тема'}
            </span>
            {darkMode ? <Moon size={16} className="text-[#C9A96E]" /> : <Sun size={16} className="text-[#F39C12]" />}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E74C3C]/22 text-[#E74C3C] hover:bg-[#E74C3C]/10 transition-colors"
          >
            <LogOut size={16} />
            <span className="text-sm font-semibold">Выйти из системы</span>
          </button>
        </div>
      </motion.aside>

      {/* Mobile Header Button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-30 p-3 rounded-lg bg-[#0D1B2E] border border-[rgba(201,169,110,0.15)] shadow-lg"
      >
        <Menu size={20} className="text-[#C9A96E]" />
      </button>
    </>
  );
}
