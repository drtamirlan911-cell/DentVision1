import React from 'react';
import { ArrowLeftRight, Building2, ChevronRight, Globe2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth.store';
import { getWorkspaceHomeTarget } from '@/lib/workspaceNavigation';
import { firstAllowedCrmPath } from '@/lib/roleAccess';
import { cn } from '@/lib/utils';
import type { User as UserType } from '@/types';

interface Props { user: UserType | null; collapsed?: boolean; isGuest?: boolean }

const ROLE_LABELS: Record<string, string> = {
  doctor: 'Врач', owner: 'Руководитель', director: 'Директор', admin: 'Администратор', assistant: 'Ассистент',
  diagnostic_center: 'Диагностический центр', lab_diagnostic: 'Медицинская лаборатория', laboratory: 'Зуботехническая лаборатория',
  lab: 'Лаборатория', supplier: 'Поставщик', lecturer: 'Преподаватель', student: 'Студент', employer: 'Работодатель',
  job_seeker: 'Соискатель', patient: 'Пациент',
  diagnostic_owner: 'Владелец диагностического центра', diagnostic_admin: 'Администратор диагностического центра', diagnostic_manager: 'Управляющий диагностического центра', diagnostic_operator: 'Оператор диагностического центра', radiologist: 'Рентгенолог', radiology_technician: 'Рентген-лаборант', diagnostic_reception: 'Регистратура диагностического центра', diagnostic_finance: 'Финансы диагностического центра', diagnostic_quality: 'Контроль качества диагностики',
  medical_lab_owner: 'Владелец медицинской лаборатории', medical_lab_admin: 'Администратор медицинской лаборатории', medical_lab_manager: 'Управляющий медицинской лаборатории', medical_lab_reception: 'Регистратура медицинской лаборатории', medical_lab_technician: 'Лаборант', medical_lab_validator: 'Валидатор результатов', medical_lab_doctor: 'Врач лаборатории', medical_lab_finance: 'Финансы медицинской лаборатории', medical_lab_quality: 'Контроль качества лаборатории',
  dental_lab_owner: 'Владелец зуботехнической лаборатории', dental_lab_admin: 'Администратор зуботехнической лаборатории', dental_lab_manager: 'Управляющий зуботехнической лаборатории', lab_coordinator: 'Координатор лаборатории', dental_technician: 'Зубной техник', cad_designer: 'CAD-дизайнер', ceramist: 'Керамист', orthodontic_technician: 'Ортодонтический техник', qc_specialist: 'Контроль качества лаборатории', lab_finance: 'Финансы лаборатории', user: 'Участник экосистемы', guest: 'Гость',
};

function roleLabel(user: UserType | null, activeRole?: string | null) {
  const raw = String(activeRole || (user as any)?.effectiveRole || (user as any)?.platformRole || (user as any)?.role || 'user').toLowerCase();
  return ROLE_LABELS[raw] || raw.replace(/_/g, ' ');
}

function organizationLabel(user: UserType | null) {
  const u = user as any;
  return u?.organizationName || u?.clinicName || u?.clinic?.name || u?.organization?.name || null;
}

export const EcosystemContextCard: React.FC<Props> = ({ user, collapsed = false, isGuest = false }) => {
  const navigate = useNavigate();
  const { activeWorkspace, workspaceContexts, pages } = useAuth();
  const hasUnselectedWorkspaces = workspaceContexts.length > 0 && !activeWorkspace;
  const org = activeWorkspace?.name || (!workspaceContexts.length ? organizationLabel(user) : null);
  const label = hasUnselectedWorkspaces ? 'Контекст не выбран' : activeWorkspace?.roleLabel || roleLabel(user, activeWorkspace?.roleKey);
  const home = activeWorkspace ? getWorkspaceHomeTarget({
    scopeType: activeWorkspace.scopeType,
    roleKey: activeWorkspace.roleKey || (user as any)?.effectiveRole || (user as any)?.role,
    hasClinic: activeWorkspace.scopeType === 'CLINIC',
  }) : null;
  const hasOrg = Boolean(activeWorkspace?.id || (!workspaceContexts.length && ((user as any)?.organizationId || (user as any)?.clinicId || org)));
  const homePath = home?.scopeType === 'CLINIC' ? (pages.length ? firstAllowedCrmPath(pages) : home.path) : home?.path;
  const openSwitcher = () => window.dispatchEvent(new CustomEvent('dentvision:open-workspace-switcher'));
  const canSwitchWorkspace = !isGuest && workspaceContexts.length > 1;
  const openWorkspace = () => {
    if (activeWorkspace && homePath) navigate(homePath);
    else if (workspaceContexts.length > 0) openSwitcher();
    else navigate('/my-clinics');
  };

  if (collapsed) {
    return (
      <div className="mx-auto mb-2 flex flex-col items-center gap-1">
        <button type="button" title={`Мой рабочий кабинет · ${org || home?.label || label}`} aria-label="Открыть рабочий кабинет" data-testid="active-workspace-link" onClick={openWorkspace} className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--dv-accent-soft)] text-[var(--dv-accent)] hover:opacity-90"><Building2 size={16} /></button>
        {canSwitchWorkspace && <button type="button" title="Сменить рабочее пространство" aria-label="Сменить рабочее пространство" onClick={openSwitcher} className="grid h-9 w-9 place-items-center rounded-xl text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-text)]"><ArrowLeftRight size={15} /></button>}
      </div>
    );
  }

  return <div className={cn('mx-3 mb-2 rounded-xl border border-[var(--dv-border)] bg-[var(--dv-surface)] p-2.5', isGuest && 'border-[var(--dv-accent)]/20')}>
    <button type="button" aria-label="Открыть рабочий кабинет" data-testid="active-workspace-link" onClick={openWorkspace} className="flex min-h-11 w-full items-center gap-2.5 text-left">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]">{hasOrg ? <Building2 size={15} /> : <Globe2 size={15} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-[var(--dv-text)]">{hasUnselectedWorkspaces ? 'Выберите рабочее пространство' : 'Мой рабочий кабинет'}</span>
        <span className="mt-0.5 block truncate text-[10px] text-[var(--dv-muted)]">{hasUnselectedWorkspaces ? 'Организация и роль пока не выбраны' : [org || home?.label || 'Личный контекст', label, home?.label].filter(Boolean).join(' · ')}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-[var(--dv-muted)]" />
    </button>
    {canSwitchWorkspace && (
      <button
        type="button"
        onClick={openSwitcher}
        aria-label="Сменить рабочее пространство"
        className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--dv-border)] px-2 py-1.5 text-[10px] font-medium text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-text)]"
      >
        <ArrowLeftRight size={12} /> Сменить рабочее пространство
      </button>
    )}
    {!isGuest && !hasOrg && <button type="button" onClick={() => navigate('/my-clinics')} className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--dv-border)] px-2 py-1.5 text-[10px] font-medium text-[var(--dv-muted)] hover:bg-[var(--dv-nav-hover)] hover:text-[var(--dv-text)]"><UserRound size={12} /> Подключить рабочий контекст</button>}
  </div>;
};

export default EcosystemContextCard;
