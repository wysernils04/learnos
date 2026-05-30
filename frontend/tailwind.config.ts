import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // LearnOS design system: Glassmorphism, teal primary, orange CTA
      colors: {
        primary: {
          DEFAULT: '#0D9488',
          50:  '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          900: '#134E4A',
          foreground: '#ffffff',
        },
        cta: {
          DEFAULT: '#F97316',
          hover:   '#EA580C',
          foreground: '#ffffff',
        },
        background: '#F0FDFA',
        foreground: '#134E4A',
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        border: '#E2E8F0',
        input:  '#E2E8F0',
        ring:   '#0D9488',
        destructive: {
          DEFAULT:    '#EF4444',
          foreground: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(13, 148, 136, 0.12)',
        'glass-lg': '0 20px 60px rgba(13, 148, 136, 0.15)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
