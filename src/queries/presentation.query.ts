import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/utils/api'
import { queryKeys } from './keys'

/** Every release for a plan, superseded and withdrawn versions included. */
export function usePlanReleases(planId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.planReleases(planId || ''),
    queryFn: () => api.getPlanReleases(planId as string),
    enabled: !!planId,
  })
}

export function usePlanPresentation(releaseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.planPresentation(releaseId || ''),
    queryFn: () => api.getPlanPresentation(releaseId as string),
    enabled: !!releaseId,
  })
}

/** Freeze the plan as signed, without publishing it to the patient yet. */
export function useApproveTreatmentPlan(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.approveTreatmentPlan(planId as string, { publish: false }),
    onSuccess: () => {
      if (planId) qc.invalidateQueries({ queryKey: queryKeys.planReleases(planId) })
    },
  })
}

/** Publish the plain deterministic release, bypassing any generated presentation. */
export function usePublishPlanRelease(planId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (releaseId: string) => api.publishPlanRelease(releaseId),
    onSuccess: () => {
      if (planId) qc.invalidateQueries({ queryKey: queryKeys.planReleases(planId) })
    },
  })
}

export function useGeneratePresentation(releaseId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.generatePlanPresentation(releaseId as string),
    onSuccess: () => {
      if (releaseId) qc.invalidateQueries({ queryKey: queryKeys.planPresentation(releaseId) })
    },
  })
}

export function useEditPresentationBeat(releaseId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ presentationId, beatId, say, saySimple }: { presentationId: string; beatId: string; say: string; saySimple?: string | null }) =>
      api.editPresentationBeat(presentationId, beatId, { say, saySimple }),
    onSuccess: () => {
      if (releaseId) qc.invalidateQueries({ queryKey: queryKeys.planPresentation(releaseId) })
    },
  })
}

export function usePublishPresentation(releaseId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (presentationId: string) => api.publishPresentation(presentationId),
    onSuccess: () => {
      if (releaseId) qc.invalidateQueries({ queryKey: queryKeys.planPresentation(releaseId) })
    },
  })
}
