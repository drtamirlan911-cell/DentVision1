/**
 * Google Identity Services — script loading and button rendering.
 *
 * We render Google's own button rather than drawing our own. Google's branding
 * terms govern the mark, the wording and the minimum size, while the wrapper
 * keeps the official button aligned with the DentVision auth form.
 */

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

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
 * Render Google's official button at the exact width available to the auth
 * form. Google supports a 200–400px standard button, so callers should pass a
 * measured width in that range whenever possible.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (idToken: string) => void,
  opts: {
    theme?: 'light' | 'dark'
    locale?: string
    text?: GoogleButtonOptions['text']
    width?: number
  } = {},
): Promise<void> {
  const google = await loadGoogleIdentity()

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (response?.credential) onCredential(response.credential)
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  })

  parent.replaceChildren()

  const measuredWidth = Number.isFinite(opts.width) ? Math.round(opts.width as number) : 400
  const width = Math.max(200, Math.min(measuredWidth, 400))

  google.accounts.id.renderButton(parent, {
    type: 'standard',
    // The official outline variant gives the cleanest contrast on both light
    // and dark DentVision surfaces without creating a second black rectangle.
    theme: 'outline',
    size: 'large',
    text: opts.text || 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    locale: opts.locale || 'ru',
    width,
  })
}
