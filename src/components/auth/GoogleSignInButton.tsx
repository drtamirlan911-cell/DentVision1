import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isGoogleConfigured, renderGoogleButton } from '@/lib/googleSignIn'
import { cn } from '@/lib/utils'

/**
 * "Continue with Google" — Google's own button, fitted to our layout.
 *
 * Three things make it sit with the page rather than on it:
 *
 *  - it is rendered at the container's measured width, so it lines up flush
 *    with the form above instead of floating at Google's default 400px;
 *  - it follows the app theme (Google's outline button is drawn on white and
 *    would glare in the dark theme);
 *  - it renders nothing at all when `VITE_GOOGLE_CLIENT_ID` is unset, so before
 *    the OAuth client exists the screen looks exactly as it does today.
 *
 * The mark, the wording and the minimum size are Google's to dictate, which is
 * why this wraps their button instead of drawing one.
 */

/** The app has no theme switcher yet; the class on <html> is the truth. */
function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

export interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void
  /** Google's approved wordings. */
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  /** Show the "или" rule above the button. */
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

  // Keep the latest callback without making it a render dependency — Google's
  // button is imperative, and re-rendering it on every parent render would make
  // it flicker.
  const handler = useRef(onCredential)
  handler.current = onCredential

  const draw = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    const width = Math.min(Math.round(host.getBoundingClientRect().width) || 320, 400)
    host.style.setProperty('--gsi-width', `${width}px`)
    renderGoogleButton(host, (token) => handler.current(token), {
      theme,
      locale: i18n.language || 'ru',
      text,
    })
      .then(() => { setReady(true); setFailed(false) })
      .catch(() => setFailed(true))
  }, [theme, i18n.language, text])

  useEffect(() => {
    if (!isGoogleConfigured()) return
    draw()

    // Re-fit on resize; Google's button is a fixed-width iframe and will not
    // reflow on its own.
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(draw)
    }
    window.addEventListener('resize', onResize)

    // And follow the theme if one is ever switched at runtime.
    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
    }
  }, [draw])

  if (!isGoogleConfigured()) return null

  return (
    <div className={cn('space-y-4', className)}>
      {divider && (
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-bdr-subtle" />
          <span className="text-xs uppercase tracking-wider text-txt-ghost">или</span>
          <span className="h-px flex-1 bg-bdr-subtle" />
        </div>
      )}

      <div className="flex justify-center">
        {/* Google draws into this node. The min-height reserves the row so the
            form below does not jump when the script finishes loading. */}
        <div
          ref={hostRef}
          className={cn(
            'w-full overflow-hidden rounded-xl transition-opacity duration-200 [color-scheme:normal]',
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
