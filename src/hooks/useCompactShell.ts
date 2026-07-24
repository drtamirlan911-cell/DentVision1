import { useEffect, useState } from 'react'

/**
 * Compact shell = phone / short landscape viewport.
 * Width alone is not enough: iPhone landscape is often >768px wide but too short for desktop chrome.
 */
export function useCompactShell(): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === 'undefined') return false
    const next = window.innerWidth < 768 || window.innerHeight < 520
    try {
      document.documentElement.dataset.shell = next ? 'compact' : 'wide'
    } catch { /* ignore */ }
    return next
  })

  useEffect(() => {
    const check = () => {
      const next = window.innerWidth < 768 || window.innerHeight < 520
      setCompact(next)
      try {
        document.documentElement.dataset.shell = next ? 'compact' : 'wide'
      } catch { /* ignore */ }
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  return compact
}
