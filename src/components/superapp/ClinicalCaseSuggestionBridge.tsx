import { useEffect } from 'react'
import { useAIStore } from '@/store/ai.store'
import { useWorkspaceStore } from '@/store/workspace.store'

const PATIENT_SUGGESTIONS = [
  'История лечения',
  'План лечения',
  'Зубная карта',
  'Записать на приём',
]

/** Keeps the AI command line focused on the active clinical case. */
export function ClinicalCaseSuggestionBridge() {
  const focusType = useWorkspaceStore((s) => s.context.focusType)
  const focusId = useWorkspaceStore((s) => s.context.focusId)
  const setSuggestionsFromStrings = useAIStore((s) => s.setSuggestionsFromStrings)

  useEffect(() => {
    if (focusType !== 'patient' || !focusId) return
    setSuggestionsFromStrings(PATIENT_SUGGESTIONS)
  }, [focusType, focusId, setSuggestionsFromStrings])

  return null
}
