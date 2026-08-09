/**
 * Google Identity Services — script loading and button rendering.
 *
 * We render Google's own button rather than drawing our own. Google's branding
 * terms govern the mark, the wording and the minimum size, and their button is
 * the one that stays compliant when those terms change. What we control is
 * everything around it: width, corner radius, and which of Google's themes to
 * use so it sits with the rest of the page instead of on top of it.
 */

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/** Without a client id the feature is off and every entry point hides itself. */
export function isGoogleConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0
}

interface GoogleCredentialResponse {
  credential: string
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
  locale?: string
  logo_alignment?: 'left' | 'center'
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(config: {
        client_id: string
        callback: (response: GoogleCredentialResponse) => void
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
        use_fedcm_for_prompt?: boolean
      }): void
      renderButton(parent: HTMLElement, options: GoogleButtonOptions): void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

/** One load per page, shared by every entry point that asks for it. */
let loader: Promise<GoogleIdentity> | null = null

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (!isGoogleConfigured()) return Promise.reject(new Error('Google sign-in is not configured'))
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (loader) return loader

  loader = new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')

    const settle = () => {
      if (window.google?.accounts?.id) resolve(window.google)
      else reject(new Error('Google Identity Services loaded without the expected API'))
    }

    script.addEventListener('load', settle)
    script.addEventListener('error', () => {
      // Let a later attempt retry rather than caching the failure forever — an
      // ad blocker or a flaky network should not disable the button for the
      // rest of the session.
      loader = null
      reject(new Error('Не удалось загрузить Google'))
    })

    if (!existing) {
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    } else if (window.google?.accounts?.id) {
      settle()
    }
  })

  return loader
}

/**
 * Render Google's button into `parent`.
 *
 * `theme` follows the app's theme: Google's outline button is drawn on white,
 * which would sit as a bright rectangle in the dark theme.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (idToken: string) => void,
  opts: { theme?: 'light' | 'dark'; locale?: string; text?: GoogleButtonOptions['text'] } = {},
): Promise<void> {
  const google = await loadGoogleIdentity()

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (response?.credential) onCredential(response.credential)
    },
    // No One Tap: an account chooser that appears unbidden over a login form is
    // a surprise, and this button is already on the screen.
    auto_select: false,
    cancel_on_tap_outside: true,
  })

  parent.replaceChildren()
  google.accounts.id.renderButton(parent, {
    type: 'standard',
    theme: opts.theme === 'dark' ? 'filled_black' : 'outline',
    size: 'large',
    text: opts.text || 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    locale: opts.locale || 'ru',
    // Google caps this at 400; the wrapper scales it to the real width below.
    width: 400,
  })
}
