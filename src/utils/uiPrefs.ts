/** Persisted interface preferences for Settings → «Настройки интерфейса». */
import { containsSensitivePatientData, isPatientScopedDraftKey } from '../lib/localStoragePrivacy';

export type UiPrefs = {
  darkMode: boolean
  notifications: boolean
  autoSave: boolean
}

export const UI_PREFS_KEY = 'dv_ui_prefs'
export const AUTOSAVE_PREFIX = 'dv_autosave:'

const DEFAULTS: UiPrefs = {
  darkMode: true,
  notifications: true,
  autoSave: true,
}

export function readUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<UiPrefs>
    return {
      darkMode: parsed.darkMode !== false,
      notifications: parsed.notifications !== false,
      autoSave: parsed.autoSave !== false,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeUiPrefs(prefs: UiPrefs): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Apply dark/light theme to <html> and theme-color meta. Safe to call before React mounts. */
export function applyTheme(darkMode: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', darkMode)
  root.classList.toggle('light', !darkMode)
  root.style.colorScheme = darkMode ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', darkMode ? '#080F1A' : '#F0F4F8')
}

export function isAutoSaveEnabled(): boolean {
  return readUiPrefs().autoSave
}

export function isBrowserNotificationsEnabled(): boolean {
  return readUiPrefs().notifications
}

export function loadAutosaveDraft<T>(key: string): T | null {
  if (!isAutoSaveEnabled()) return null
  const storageKey = AUTOSAVE_PREFIX + key
  try {
    // Patient/clinical forms are never restored from localStorage. Also scrub
    // legacy drafts that were saved before the privacy guard was introduced.
    if (isPatientScopedDraftKey(key)) {
      localStorage.removeItem(storageKey)
      return null
    }
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as T
    if (containsSensitivePatientData(parsed)) {
      localStorage.removeItem(storageKey)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveAutosaveDraft(key: string, value: unknown): void {
  if (!isAutoSaveEnabled()) return
  const storageKey = AUTOSAVE_PREFIX + key
  try {
    // Fail closed: do not persist a patient-scoped form or a draft containing
    // identifiable/clinical fields. Remove a previous draft for the same key.
    if (isPatientScopedDraftKey(key) || containsSensitivePatientData(value)) {
      localStorage.removeItem(storageKey)
      return
    }
    localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/** Clear data caches and drafts that may contain previous-version PHI at logout. */
export function clearPatientSensitiveLocalStorage(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key === 'dv_schedule_sync_queue_v1' || key.startsWith('dv_schedule_day_') || key.startsWith(AUTOSAVE_PREFIX)) {
        keys.push(key)
      }
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    /* ignore private-mode / disabled storage */
  }
}

export function clearAutosaveDraft(key: string): void {
  try {
    localStorage.removeItem(AUTOSAVE_PREFIX + key)
  } catch {
    /* ignore */
  }
}

/** Show a browser push notification when the preference + permission allow it. */
export function showBrowserNotification(title: string, options?: NotificationOptions): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (!isBrowserNotificationsEnabled()) return
  if (Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  try {
    new Notification(title, {
      icon: '/vite.svg',
      badge: '/vite.svg',
      ...options,
    })
  } catch {
    /* ignore */
  }
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission
  }
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}
