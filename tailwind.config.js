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
        // DentVision Brand
        dv: {
          gold: '#C9A96E',
          'gold-light': '#E2C898',
          'gold-dim': '#8B6F3E',
          'gold-muted': 'rgba(201, 169, 110, 0.15)',
        },
        // Surface hierarchy (CSS vars — switch with html.dark / html.light)
        surface: {
          0: 'var(--dv-surface-0)',
          1: 'var(--dv-surface-1)',
          2: 'var(--dv-surface-2)',
          3: 'var(--dv-surface-3)',
          4: 'var(--dv-surface-4)',
          raised: 'var(--dv-surface-raised)',
          'raised-hover': 'var(--dv-surface-raised-hover)',
          overlay: 'var(--dv-overlay)',
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
          primary: 'var(--dv-text-primary)',
          secondary: 'var(--dv-text-secondary)',
          muted: 'var(--dv-text-muted)',
          ghost: 'var(--dv-text-ghost)',
        },
        // Border
        bdr: {
          DEFAULT: 'var(--dv-border)',
          subtle: 'var(--dv-border-subtle)',
          focus: 'var(--dv-border-focus)',
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
