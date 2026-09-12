import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isGoogleConfigured, renderGoogleButton } from '@/lib/googleSignIn'
import { cn } from '@/lib/utils'

/**
 * Official Google Identity Services button, fitted to the DentVision auth form.
 * Google owns the button artwork and wording; DentVision controls only the
 * responsive container around it.
 */
function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

export interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  divider?: boolean
  className?: string
}

export function GoogleSignInButton({
  onCredential,
  text = 'continue_with',
  divider = true,
  className,
}: GoogleSignInButtonProps) {
  const { i18n } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme)

  const handler = useRef(onCredential)
  handler.current = onCredential

  const draw = useCallback(() => {
    const host = hostRef.current
    if (!host) return

    const availableWidth = Math.round(host.getBoundingClientRect().width)
    const width = Math.max(200, Math.min(availableWidth || 400, 400))

    renderGoogleButton(host, (token) => handler.current(token), {
      theme,
      locale: i18n.language || 'ru',
      text,
      width,
    })
      .then(() => {
        setReady(true)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }, [theme, i18n.language, text])

  useEffect(() => {
    if (!isGoogleConfigured()) return
    draw()

    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(draw)
    }
    window.addEventListener('resize', onResize)

    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
    }
  }, [draw])

  if (!isGoogleConfigured()) return null

  return (
    <div className={cn('space-y-3', className)}>
      {divider && (
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-bdr-subtle" />
          <span className="text-xs uppercase tracking-wider text-txt-ghost">или</span>
          <span className="h-px flex-1 bg-bdr-subtle" />
        </div>
      )}

      <div className="flex w-full justify-center overflow-hidden rounded-xl">
        <div
          ref={hostRef}
          className={cn(
            'w-full min-w-0 overflow-hidden rounded-xl transition-opacity duration-200 [color-scheme:normal]',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          style={{ minHeight: 44 }}
        />
      </div>

      {failed && (
        <p className="text-center text-xs text-txt-muted">
          Не удалось загрузить Google. Проверьте подключение или войдите по паролю.
        </p>
      )}
    </div>
  )
}
