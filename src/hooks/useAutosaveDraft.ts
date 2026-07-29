import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/ui.store'
import { clearAutosaveDraft, loadAutosaveDraft, saveAutosaveDraft } from '@/utils/uiPrefs'

/**
 * Persist a form draft to localStorage when «Автосохранение» is on.
 * Restores once on mount (if a draft exists). Call clear() after successful save.
 */
export function useAutosaveDraft<T>(
  key: string,
  value: T,
  setValue: (next: T) => void,
  opts?: { onRestore?: (draft: T) => void; enabled?: boolean },
) {
  const autoSave = useUIStore((s) => s.autoSave)
  const restored = useRef(false)
  const skipNext = useRef(false)
  const enabled = opts?.enabled !== false

  useEffect(() => {
    if (!enabled) return
    if (restored.current) return
    restored.current = true
    const draft = loadAutosaveDraft<T>(key)
    if (draft != null) {
      skipNext.current = true
      setValue(draft)
      opts?.onRestore?.(draft)
    }
    // intentionally only on mount / key change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  useEffect(() => {
    if (!enabled || !autoSave) return
    if (skipNext.current) {
      skipNext.current = false
      return
    }
    const t = window.setTimeout(() => {
      saveAutosaveDraft(key, value)
    }, 400)
    return () => window.clearTimeout(t)
  }, [autoSave, key, value, enabled])

  return {
    clear: () => {
      skipNext.current = true
      clearAutosaveDraft(key)
    },
  }
}
