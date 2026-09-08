import React from 'react';
import { SuperAppSidebar } from './SuperAppSidebar';
import type { User as UserType, RoleInfo } from '@/types';
import { usePendingApprovalCount } from '@/queries/ai.query';
import { useIam } from '@/iam';
import '../styles/dentvision-superapp.css';

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
 * Stable compatibility boundary for the existing IntelligenceLayout contract.
 * Navigation UI is implemented once by SuperAppSidebar, while IAM and approval
 * state remain owned by the existing auth/query infrastructure.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  sidebarVisible,
  isMobile,
  sidebarOpen,
  user,
  roleInfo,
  logout,
  toggleSidebar,
  isGuest = false,
}) => {
  const iam = useIam();
  const canSeeApprovals = !isGuest && iam.canAccessPage('ai-approvals');
  const pendingApprovals = usePendingApprovalCount(canSeeApprovals);
  const isAdmin = !isGuest && (iam.pages.includes('admin') || roleInfo?.canSeeSuperAdmin === true);

  return (
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
      pendingApprovals={pendingApprovals || 0}
      isAdmin={isAdmin}
    />
  );
};

export default Sidebar;
