import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Check, ChevronDown, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth.store'
import { useToast } from '@/components/ui/ds/Toast'
import { queryKeys } from '@/queries/keys'

/**
 * Compact clinic switcher for the top bar.
 * One tap → switch JWT clinic; AI chat rebinds via clinic-scoped session.
 */
export function ClinicSwitcher({ className }: { className?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { clinics, clinic, activeMembership, switchClinic, isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!isAuthenticated || !clinics?.length) return null

  const activeId = clinic?.id || activeMembership?.clinicId || null
  const activeName = clinic?.name || clinics.find((m) => m.clinicId === activeId)?.clinic?.name || 'Клиника'
  const multi = clinics.length > 1

  const pick = async (clinicId: string) => {
    if (!clinicId || clinicId === activeId || busyId) return
    setBusyId(clinicId)
    try {
      await switchClinic(clinicId)
      const name = clinics.find((m) => m.clinicId === clinicId)?.clinic?.name || 'клинику'
      toast.success(`Активна: ${name}`)
      setOpen(false)
      // Refresh CRM caches for the new clinic JWT scope.
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitingList })
      void queryClient.invalidateQueries({ queryKey: queryKeys.chairs })
      if (!location.pathname.startsWith('/crm')) {
        navigate('/crm/schedule')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось переключить клинику')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => (multi ? setOpen((v) => !v) : navigate('/my-clinics'))}
        className={cn(
          'flex items-center gap-1.5 max-w-[9.5rem] sm:max-w-[14rem] px-2 py-1 rounded-lg',
          'bg-surface-2 border border-bdr-subtle text-txt-secondary hover:text-txt-primary hover:border-dv-gold/30 transition-colors',
        )}
        aria-label={multi ? 'Переключить клинику' : 'Мои клиники'}
        aria-expanded={multi ? open : undefined}
      >
        <Building2 size={13} className="text-dv-gold shrink-0" />
        <span className="text-[11px] font-medium truncate">{activeName}</span>
        {multi && <ChevronDown size={12} className={cn('shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />}
      </button>

      {multi && open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-[min(220px,calc(100vw-1.5rem))] max-w-[calc(100vw-1rem)] rounded-xl border border-bdr-subtle bg-surface-1 shadow-xl p-1.5">
          <p className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-txt-muted">Рабочее пространство</p>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {clinics.map((m) => {
              const id = m.clinicId
              const name = m.clinic?.name || 'Клиника'
              const city = m.clinic?.city
              const active = id === activeId
              const loading = busyId === id
              return (
                <button
                  key={m.id || id}
                  type="button"
                  disabled={!!busyId}
                  onClick={() => void pick(id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors',
                    active ? 'bg-dv-gold/10 text-dv-gold' : 'text-txt-primary hover:bg-white/[0.04]',
                  )}
                >
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: `${(m.clinic as any)?.color || '#C9A96E'}22`,
                      color: (m.clinic as any)?.color || '#C9A96E',
                    }}
                  >
                    {name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate m-0">{name}</p>
                    <p className="text-[10px] text-txt-muted m-0 truncate">
                      {[city, m.role].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {loading ? (
                    <Loader2 size={14} className="animate-spin shrink-0" />
                  ) : active ? (
                    <Check size={14} className="shrink-0" />
                  ) : null}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/my-clinics') }}
            className="mt-1 w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-txt-secondary hover:text-txt-primary hover:bg-white/[0.04] transition-colors"
          >
            <Plus size={13} />
            Все клиники
          </button>
        </div>
      )}
    </div>
  )
}
