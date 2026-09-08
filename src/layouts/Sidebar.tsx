import React from 'react';
import { SuperAppSidebar } from './SuperAppSidebar';
import type { User as UserType, RoleInfo } from '@/types';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  sidebarVisible: boolean;
  isMobile: boolean;
  sidebarOpen: boolean;
  user: UserType | null;
  roleInfo: RoleInfo | null;
  logout: () => void;
  toggleSidebar: () => void;
  isGuest?: boolean;
  onToggleCollapsed?: () => void;
}

/**
 * Compatibility boundary for the legacy IntelligenceLayout contract.
 * The visual/navigation implementation now lives in SuperAppSidebar so every
 * route receives the same Super App navigation model.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  sidebarVisible,
  isMobile,
  sidebarOpen,
  user,
  logout,
  toggleSidebar,
  isGuest = false,
}) => (
  <SuperAppSidebar
    collapsed={collapsed}
    setCollapsed={setCollapsed}
    sidebarVisible={sidebarVisible}
    isMobile={isMobile}
    sidebarOpen={sidebarOpen}
    user={user}
    logout={logout}
    toggleSidebar={toggleSidebar}
    isGuest={isGuest}
    pendingApprovals={0}
    isAdmin={false}
  />
);

export default Sidebar;
