import React from 'react';
import { Building2, ChevronRight, Globe2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { User as UserType } from '@/types';

interface Props { user: UserType | null; collapsed?: boolean; isGuest?: boolean }

const ROLE_LABELS: Record<string, string> = {
  doctor: 'Врач', owner: 'Владелец', director: 'Директор', admin: 'Администратор', assistant: 'Ассистент',
  diagnostic_center: 'Диагностический центр', lab_diagnostic: 'Медицинская лаборатория', laboratory: 'Зуботехническая лаборатория',
  lab: 'Лаборатория', supplier: 'Поставщик', lecturer: 'Преподаватель', student: 'Студент', employer: 'Работодатель',
  job_seeker: 'Соискатель', patient: 'Пациент', user: 'Участник экосистемы', guest: 'Гость',
};

function roleLabel(user: UserType | null) {
  const raw = String((user as any)?.platformRole || (user as any)?.role || 'user').toLowerCase();
  return ROLE_LABELS[raw] || raw.replace(/_/g, ' ');
}

function organizationLabel(user: UserType | null) {
  const u = user as any;
  return u?.organizationName || u?.clinicName || u?.clinic?.name || u?.organization?.name || null;
}

export const EcosystemContextCard: React.FC<Props> = ({ user, collapsed = false, isGuest = false }) => {
  const navigate = useNavigate();
  const org = organizationLabel(user);
  const label = roleLabel(user);
  const hasOrg = Boolean((user as any)?.organizationId || (user as any)?.clinicId || org);
  const target = hasOrg ? '/my-clinics' : '/profile';

  if (collapsed && !isGuest) {
    return <button type="button" title={`${label}${org ? ` · ${org}` : ''}`} onClick={() => navigate(target)} className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-[var(--dv-accent-soft)] text-[var(--dv-accent)] hover:opacity-90"><Building2 size={16} /></button>;
  }

  return <div className={cn('mx-3 mb-2 rounded-xl border border-[var(--dv-border)] bg-[var(--dv-surface)] p-2.5', isGuest && 'border-[var(--dv-accent)]/20')}>
    <button type="button" onClick={() => navigate(target)} className="flex w-full items-center gap-2.5 text-left">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--dv-accent-soft)] text-[var(--dv-accent)]">{hasOrg ? <Building2 size={15} /> : <Globe2 size={15} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-[var(--dv-text)]">{org || 'Личный контекст'}</span>
        <span className="mt-0.5 block truncate text-[10px] text-[var(--dv-muted)]">{label}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-[var(--dv-muted)]" />
    </button>
    {!isGuest && !hasOrg && <button type="button" onClick={() => navigate('/my-clinics')} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--dv-border)] px-2 py-1.5 text-[10px] font-medium text-[var(--dv-muted)] hover:text-[var(--dv-text)] hover:bg-[var(--dv-nav-hover)]"><UserRound size={12} /> Подключить рабочий контекст</button>}
  </div>;
};

export default EcosystemContextCard;
