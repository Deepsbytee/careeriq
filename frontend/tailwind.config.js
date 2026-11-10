/** @type {import('tailwindcss').Config} */
// Cherry and matcha. A light "paper" theme: the existing slate/indigo/emerald class names
// are remapped here, so every component picks up the new palette.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        ink: '#2A1A1E',
        blossom: '#F7D9DF',
        matcha: { DEFAULT: '#8FA859', deep: '#4F7A2E', mist: '#EEF2DF' },
        cherry: { DEFAULT: '#7A1633', deep: '#5C0F26', bright: '#C2294A' },

        surface: {
          DEFAULT: '#EEF2DF',
          1: '#F6F8EC',
          2: '#FBFCF5',
          3: '#E6EBD2',
          card: 'rgba(251, 252, 245, 0.92)',
        },
        border: { DEFAULT: '#D3DBB8', light: '#E1E7CB' },
        accent: {
          DEFAULT: '#7A1633',
          hover: '#8F1B3D',
          dim: 'rgba(122, 22, 51, 0.08)',
          glow: 'rgba(122, 22, 51, 0.18)',
        },
        success: { DEFAULT: '#527F31', dim: 'rgba(94, 138, 58, 0.14)' },
        warning: { DEFAULT: '#A86A0C', dim: 'rgba(201, 138, 26, 0.14)' },
        danger: { DEFAULT: '#C2294A', dim: 'rgba(194, 41, 74, 0.10)' },
        info: { DEFAULT: '#4F72A3', dim: 'rgba(79, 114, 163, 0.12)' },

        // Neutral text/border scale, inverted for a light page (100 = darkest ink, 900 = lightest tint).
        slate: {
          50: '#1C1114', 100: '#2A1A1E', 200: '#3A292D', 300: '#4D3C40', 400: '#5F5254',
          500: '#6F6563', 600: '#A39A94', 700: '#CCC6B6', 800: '#E0E3CF', 900: '#EAEEDA', 950: '#F4F7E9',
        },
        // Former indigo/purple/violet accent family -> cherry
        indigo: {
          50: '#FDF0F3', 100: '#FADCE3', 200: '#F2B8C6', 300: '#CC5A78', 400: '#8F1B3D',
          500: '#7A1633', 600: '#5C0F26', 700: '#4A0C1F', 800: '#3A0918', 900: '#2A0510', 950: '#1E030B',
        },
        purple: {
          50: '#FBEEF2', 100: '#F6D6DF', 200: '#EDB0C1', 300: '#D58AA0', 400: '#B5456A',
          500: '#8F2349', 600: '#5C0F26', 700: '#4A0C1F', 800: '#3A0918', 900: '#2A0510',
        },
        violet: {
          50: '#FBEEF2', 100: '#F6D6DF', 200: '#EDB0C1', 300: '#D58AA0', 400: '#B5456A',
          500: '#8F2349', 600: '#5C0F26', 700: '#4A0C1F', 800: '#3A0918', 900: '#2A0510',
        },
        // emerald/teal -> matcha, red -> bright cherry, amber/yellow -> ochre
        emerald: {
          50: '#F3F8E8', 100: '#E3EFCC', 200: '#CBE0A0', 300: '#A9C871', 400: '#4F7A2E',
          500: '#527F31', 600: '#44702A', 700: '#3F5F27', 800: '#304A1E', 900: '#223414',
        },
        teal: { 300: '#B4C98A', 400: '#6E8F3F', 500: '#8FA859', 600: '#718A44' },
        red: {
          50: '#FDF0F3', 100: '#FADCE3', 200: '#F2B8C6', 300: '#E27A92', 400: '#C2294A',
          500: '#C2294A', 600: '#A31F3C', 700: '#841830', 800: '#651224', 900: '#470C18',
        },
        orange: { 400: '#C2631F', 500: '#D9772B', 600: '#B85F1E' },
        amber: { 400: '#9A6008', 500: '#A86A0C', 600: '#8F5A06' },
        yellow: { 400: '#9A6008', 500: '#A86A0C', 600: '#8F5A06' },
        blue: { 400: '#3E5C86', 500: '#4F72A3', 600: '#3E5C86' },
      },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '20px' },
      boxShadow: {
        glow: '0 8px 30px rgba(92, 15, 38, 0.14)',
        card: '0 2px 14px rgba(42, 26, 30, 0.06)',
        button: '0 6px 18px -8px rgba(92, 15, 38, 0.55)',
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
        'fade-in': 'fadeIn 0.35s ease both',
        'slide-up': 'slideUp 0.4s ease both',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
}
