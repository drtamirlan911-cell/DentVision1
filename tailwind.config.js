/**
 * A theme colour that still honours an opacity modifier.
 *
 * These tokens are CSS variables holding a hex, and Tailwind 3 cannot inject an
 * alpha into a bare `var()` — it drops the utility entirely and says nothing.
 * `border-bdr-subtle/50` therefore compiled to no rule at all in 42 places,
 * `bg-surface-1/50` in 12 more: 101 classes across the app that looked right in
 * source and rendered as something else. Nothing catches that — not tsc, not
 * eslint, not the build.
 *
 * `color-mix` keeps the variables exactly as they are, so everything that reads
 * `var(--dv-*)` directly (inline styles, hand-written CSS) is untouched.
 */
const themed = (variable) => ({ opacityValue }) => {
  // For the plain utility Tailwind passes its own `var(--tw-bg-opacity)` here,
  // not `undefined` — feeding that to Number() yields NaN and emits `NaN%`.
  // Anything that is not a literal number means "no modifier was written".
  const alpha = Number(opacityValue)
  if (!Number.isFinite(alpha)) return `var(${variable})`
  return `color-mix(in srgb, var(${variable}) ${alpha * 100}%, transparent)`
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DentVision Brand.
        //
        // These were literals, so `html.light { --dv-gold: … }` in global.css
        // was dead for every one of the ~1000 `*-dv-gold` utilities and the
        // accent never inverted with the theme. Measured on the light surface,
        // gold text sat at 2.03:1 against a 4.5:1 AA floor, and the primary
        // button was ivory-on-gold at the same 2.03:1.
        //
        // `gold-on` is a separate role, not a shade: the foreground that sits
        // on a solid gold fill. One token cannot be both an accessible
        // foreground and a saturated fill, because the accent has to invert
        // between themes while the text on it has to invert the other way.
        dv: {
          gold: themed('--dv-gold'),
          'gold-light': themed('--dv-gold-light'),
          'gold-dim': themed('--dv-gold-dim'),
          'gold-on': themed('--dv-gold-on'),
          'gold-from': themed('--dv-gold-from'),
          'gold-to': themed('--dv-gold-to'),
          'gold-muted': 'rgba(201, 169, 110, 0.15)',
        },
        // Brand palette sampled from the DentVision logo
        brand: {
          navy: '#1C3E6B',
          'navy-ink': '#121A37',
          teal: '#2AA4B4',
          'teal-text': '#157594',
          cyan: '#54CFE0',
        },
        // Surface hierarchy (CSS vars — switch with html.dark / html.light)
        surface: {
          0: themed('--dv-surface-0'),
          1: themed('--dv-surface-1'),
          2: themed('--dv-surface-2'),
          3: themed('--dv-surface-3'),
          4: themed('--dv-surface-4'),
          raised: themed('--dv-surface-raised'),
          'raised-hover': themed('--dv-surface-raised-hover'),
          overlay: themed('--dv-overlay'),
        },
        // Semantic
        success: '#27AE60',
        error: '#E74C3C',
        warning: '#F39C12',
        info: '#2980B9',
        accent: {
          purple: '#8E44AD',
          cyan: '#00BCD4',
          pink: '#E91E8C',
          teal: '#009688',
          orange: '#FF5722',
        },
        // Neutral text
        txt: {
          primary: themed('--dv-text-primary'),
          secondary: themed('--dv-text-secondary'),
          muted: themed('--dv-text-muted'),
          ghost: themed('--dv-text-ghost'),
        },
        // Border
        bdr: {
          DEFAULT: themed('--dv-border'),
          subtle: themed('--dv-border-subtle'),
          focus: themed('--dv-border-focus'),
        },
      },
      fontFamily: {
        sans: [
          'Inter', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif',
        ],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.8125rem', { lineHeight: '1.125rem' }],
        'base': ['0.875rem', { lineHeight: '1.25rem' }],
        'lg': ['1rem', { lineHeight: '1.5rem' }],
        'xl': ['1.125rem', { lineHeight: '1.625rem' }],
        '2xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.5rem', { lineHeight: '2rem' }],
        '4xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '5xl': ['2.25rem', { lineHeight: '2.75rem' }],
        // The scale is deliberately one step down from Tailwind's defaults
        // (base = 14px) for a dense UI, which left nothing above 36px — a hero
        // figure needs at least 48px to read as the number a screen leads with.
        '6xl': ['3rem', { lineHeight: '1' }],
        '7xl': ['3.75rem', { lineHeight: '1' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        'sidebar': '17rem',
        'sidebar-collapsed': '4.5rem',
        'topbar': '3.5rem',
        'bottomnav': '3.5rem',
      },
      borderRadius: {
        'xs': '0.25rem',
        'sm': '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(201, 169, 110, 0.15)',
        'glow-sm': '0 0 10px rgba(201, 169, 110, 0.1)',
        'glow-lg': '0 0 40px rgba(201, 169, 110, 0.2)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.3)',
        'modal': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-up': 'fadeUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
