import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query';
import { Building2, FlaskConical, GraduationCap, Store, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';

interface Workspace {
  id: string;
  type: 'CLINIC' | 'DIAGNOSTIC_CENTER' | 'LABORATORY' | 'SUPPLIER' | 'ACADEMY';
  name: string;
  role: string;
  active: boolean;
}

const TYPE_ICON = {
  CLINIC: Building2,
  DIAGNOSTIC_CENTER: FlaskConical,
  LABORATORY: FlaskConical,
  SUPPLIER: Store,
  ACADEMY: GraduationCap,
} as const;

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { user, clinic, activeMembership } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', user?.id],
    queryFn: async (): Promise<Workspace[]> => {
      const res = await api.getMyContexts();
      const contexts: Workspace[] = (res.contexts || []).map((c: any) => ({
        id: c.scopeId || c.organizationId,
        type: c.scopeType || c.organizationType || 'CLINIC',
        name: c.name || c.scopeName || 'Workspace',
        role: c.role || 'member',
        active: false,
      }));
      // Add the active clinic context
      if (clinic?.id) {
        contexts.unshift({
          id: clinic.id,
          type: 'CLINIC',
          name: clinic.name || 'Моя клиника',
          role: activeMembership?.role || user?.role || 'user',
          active: true,
        });
      }
      return contexts;
    },
    enabled: !!user,
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = workspaces.find((w) => w.active) || workspaces[0];
  const Icon = current ? TYPE_ICON[current.type] || Building2 : Building2;

  const handleSwitch = async (ws: Workspace) => {
    setOpen(false);
    if (ws.active) return;
    if (ws.type === 'CLINIC') {
      await api.switchClinic(ws.id);
    } else {
      await api.switchContext(ws.type, ws.id);
    }
    window.location.reload();
  };

  if (workspaces.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
          'bg-surface-2 border border-bdr-subtle text-txt-secondary hover:text-txt-primary hover:border-dv-gold/30',
        )}
      >
        <Icon size={13} className="text-dv-gold" />
        <span className="max-w-[8rem] truncate">{current?.name || 'Клиника'}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-bdr-subtle bg-surface-1 shadow-xl p-1.5 space-y-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold text-txt-ghost uppercase tracking-wider">Рабочие пространства</p>
          {workspaces.map((ws) => {
            const WsIcon = TYPE_ICON[ws.type] || Building2;
            return (
              <button
                key={`${ws.type}-${ws.id}`}
                type="button"
                onClick={() => handleSwitch(ws)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors',
                  ws.active ? 'bg-dv-gold/10 text-dv-gold' : 'text-txt-primary hover:bg-white/[0.04]',
                )}
              >
                <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: 'var(--dv-sidebar-brand-bg, rgba(201,169,110,0.12))' }}>
                  <WsIcon size={14} className="text-dv-gold" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{ws.name}</p>
                  <p className="text-[10px] text-txt-muted capitalize">{ws.role}</p>
                </div>
                {ws.active && <Check size={14} className="text-dv-gold shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
