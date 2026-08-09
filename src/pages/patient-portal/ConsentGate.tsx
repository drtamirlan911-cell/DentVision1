import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { FileCheck, Loader2 } from 'lucide-react'

import { Card } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'

/**
 * The agreements a patient has to accept before the portal will answer.
 *
 * `requireConsent()` guards every patient-portal route, so a patient who has
 * accepted nothing gets 403 `CONSENT_REQUIRED` from all six tabs. Nothing in
 * the app presented those agreements — there was no consent UI anywhere — so
 * the portal was unusable for every patient who had not been walked through it
 * by a clinic. This is the missing screen.
 *
 * Renders `children` once nothing is pending, so the portal below never has to
 * know about the gate.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [accepting, setAccepting] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['required-consents'],
    queryFn: () => api.getRequiredConsents(),
    retry: false,
  })

  const accept = useMutation({
    mutationFn: (type: string) => api.updateConsent(type, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['required-consents'] }),
    onError: (e: any) => toast.error(e?.message || 'Не удалось сохранить согласие'),
    onSettled: () => setAccepting(null),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-dv-gold" />
      </div>
    )
  }

  // A failure here must not lock the patient out of a portal they may already
  // be entitled to — let the tabs below report their own errors.
  if (isError || !data || data.allSatisfied) return <>{children}</>

  // `pending` is a list of type keys; the readable detail lives in `items`.
  const pending = (data.items || []).filter((i) => i.mandatory && i.status !== 'accepted')
  if (pending.length === 0) return <>{children}</>

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-lg p-4 sm:p-6"
    >
      <Card padding="lg">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10">
              <FileCheck size={22} className="text-dv-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-txt-primary">Прежде чем продолжить</h2>
              <p className="text-sm text-txt-muted">
                Личный кабинет показывает медицинские данные — для доступа нужно принять соглашения.
              </p>
            </div>
          </div>

          <ul className="divide-y divide-bdr-subtle">
            {pending.map((item) => (
              <li key={item.type} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-dv-gold hover:underline">
                      {item.title}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-txt-primary">{item.title}</p>
                  )}
                  <p className="text-sm text-txt-muted">
                    Версия {item.requiredVersion}
                    {/* A version bump means re-acceptance, not a first-time one. */}
                    {item.status === 'stale' ? ' · обновилась, нужно принять заново' : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  className="min-h-11"
                  loading={accepting === item.type}
                  onClick={() => { setAccepting(item.type); accept.mutate(item.type) }}
                >
                  Принимаю
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </motion.div>
  )
}
