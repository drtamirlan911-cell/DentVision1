import React from 'react';
import { EcosystemSidebar } from './EcosystemSidebar';
import EcosystemContextCard from '@/components/ecosystem/EcosystemContextCard';
import type { User as UserType } from '@/types';
import { usePendingApprovalCount } from '@/queries/ai.query';
import { useIam } from '@/iam';
import '../styles/dentvision-superapp.css';
import '../styles/dentvision-polish.css';
import '../styles/dentvision-unified-theme.css';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  sidebarVisible: boolean;
  isMobile: boolean;
  sidebarOpen: boolean;
  user: UserType | null;
  roleInfo: any;
  logout: () => void;
  toggleSidebar: () => void;
  isGuest?: boolean;
  onToggleCollapsed?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed, sidebarVisible, isMobile, sidebarOpen, user, logout, toggleSidebar, isGuest = false }) => {
  const iam = useIam();
  const canSeeApprovals = !isGuest && iam.canAccessPage('ai-approvals');
  const pendingApprovals = usePendingApprovalCount(canSeeApprovals);
  const isAdmin = !isGuest && (iam.pages.includes('admin'));
  return (
    <>
      <EcosystemSidebar
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
      {!isMobile && sidebarVisible && (
        <div className="pointer-events-none fixed bottom-16 left-0 z-[51] w-[272px] pr-0">
          <div className="pointer-events-auto">
            <EcosystemContextCard user={user} collapsed={collapsed} isGuest={isGuest} />
          </div>
        </div>
      )}
    </>
  );
};
export default Sidebar;
