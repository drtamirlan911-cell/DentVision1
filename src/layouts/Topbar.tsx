import React from 'react';
import { Bell, Search, ChevronDown } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { T } from '../utils/constants';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...classes: (string | undefined | null | false)[]) {
  return twMerge(clsx(classes));
}

interface TopbarProps {
  user: any;
  clinic: any;
  onSearch?: (query: string) => void;
}

export function Topbar({ user, clinic, onSearch }: TopbarProps) {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-[#0D1B2E]/80 backdrop-blur-md border-[rgba(201,169,110,0.15)]">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left: Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8899]"
            />
            <input
              type="text"
              placeholder="Поиск пациентов, записей..."
              onChange={(e) => onSearch?.(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-[rgba(201,169,110,0.15)] text-sm text-white placeholder:text-[#7A8899] focus:border-[#C9A96E] focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
            <Bell size={20} className="text-[#7A8899]" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#E74C3C]" />
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-[rgba(201,169,110,0.15)]" />

          {/* User Menu */}
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white">{user?.name || user?.login}</p>
              <p className="text-xs text-[#7A8899]">{clinic?.name || ''}</p>
            </div>
            <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{
                  background: `${T.gold}18`,
                  border: `2px solid ${T.gold}40`,
                }}
              >
                {user?.name?.charAt(0) || '👤'}
              </div>
              <ChevronDown size={16} className="text-[#7A8899]" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
