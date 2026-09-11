import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, Clock3, Loader2, Phone, X } from 'lucide-react'

import { Card } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { QueryError } from '@/components/ui/ds/QueryError'
import { apiRequest } from '@/utils/api'

type OnlineBooking = {
  id: string
  studyId: string
  patientName: string
  patientPhone: string
  date: string
  time: string
  durationMin?: number | null
  notes?: string | null
  status: string
  createdAt: string
  updatedAt?: string | null
  study?: { id: string; name: string; category?: string | null; price?: number | null; durationMin?: number | null }
}

const statusLabel: Record<string, string> = {
  pending: 'Новая',
  confirmed: 'Подтверждена',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена',
  declined: 'Отклонена',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function nextAction(status: string) {
  if (status === 'pending') return [{ value: 'confirmed', label: 'Подтвердить', icon: <Check size={15} /> }, { value: 'declined', label: 'Отклонить', icon: <X size={15} /> }]
  if (status === 'confirmed') return [{ value: 'in_progress', label: 'Принять в работу', icon: <Clock3 size={15} /> }]
  if (status === 'in_progress') return [{ value: 'completed', label: 'Завершить', icon: <Check size={15} /> }]
  return []
}

export function OnlineBookingsTab({ centerId }: { centerId: string }) {
  const queryClient = useQueryClient()
  const queryKey = ['diagnostics', 'online-bookings', centerId]

  const query = useQuery({
    queryKey,
    queryFn: () => apiRequest(`/api/public/diagnostics/center/${encodeURIComponent(centerId)}/bookings?limit=100`),
    enabled: !!centerId,
    refetchInterval: 30000,
  })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/public/diagnostics/center/${encodeURIComponent(centerId)}/bookings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const bookings: OnlineBooking[] = query.data?.bookings || query.data?.data?.bookings || []
  const counts = query.data?.counts || query.data?.data?.counts || {}
  const pendingCount = Number(counts.pending || 0)

  const visible = useMemo(() => bookings.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status)), [bookings])

  if (query.isLoading) {
    return <Card padding="lg"><div className="flex items-center gap-2 text-sm text-txt-secondary"><Loader2 size={17} className="animate-spin" /> Загружаем онлайн-запись…</div></Card>
  }
  if (query.isError) {
    return <QueryError what="онлайн-запись диагностического центра" onRetry={() => query.refetch()} />
  }

  return (
    <div className="space-y-4">
      <Card padding="lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock size={20} />
              <h3 className="text-base font-semibold text-txt-primary">Онлайн-запись</h3>
              {pendingCount > 0 && <Badge variant="gold">{pendingCount} новых</Badge>}
            </div>
            <p className="mt-1 text-sm text-txt-secondary">Заявки пациентов с публичной страницы диагностики. Обновляется автоматически.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>Обновить</Button>
        </div>
      </Card>

      {visible.length === 0 ? (
        <Card padding="lg">
          <div className="py-8 text-center text-sm text-txt-secondary">Активных заявок нет.</div>
        </Card>
      ) : (
        visible.map((booking) => (
          <Card key={booking.id} padding="lg">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-txt-primary">{booking.patientName}</h4>
                  <Badge variant={booking.status === 'pending' ? 'gold' : 'outline'}>{statusLabel[booking.status] || booking.status}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-txt-secondary">
                  <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} /> {formatDate(booking.date)} · {booking.time}</span>
                  <span className="inline-flex items-center gap-1.5"><Phone size={14} /> {booking.patientPhone}</span>
                  {booking.durationMin && <span>{booking.durationMin} мин</span>}
                </div>
                <div className="mt-3 text-sm text-txt-primary">{booking.study?.name || 'Исследование'}</div>
                {booking.study?.price != null && <div className="mt-1 text-sm font-medium text-txt-secondary">{Number(booking.study.price).toLocaleString('ru-RU')} ₸</div>}
                {booking.notes && <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-txt-secondary">{booking.notes}</div>}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {nextAction(booking.status).map((action) => (
                  <Button
                    key={action.value}
                    variant={action.value === 'declined' ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ id: booking.id, status: action.value })}
                  >
                    {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

export default OnlineBookingsTab
