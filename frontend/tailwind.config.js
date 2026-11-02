/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: '#EBEFF9',
        surface: '#FFFFFF',
        'card-subtle': '#F8FAFD',
        finnova: {
          bg: '#EBEFF9',
          dark: '#13141F',
          darkCard: '#1E2033',
          purple: '#635BFF',
          purpleHover: '#5349EE',
          purpleLight: '#F3F2FF',
          purpleMuted: '#3D3E5D',
          lavender: '#E5E8F7',
          accent: '#7B61FF',
          blue: '#3B82F6',
          teal: '#14B8A6',
          rose: '#F43F5E',
          amber: '#F59E0B',
          slate: '#64748B',
          darkSlate: '#0F101A',
        },
        primary: {
          DEFAULT: '#635BFF',
          hover: '#5349EE',
          active: '#4438CA',
          light: '#F3F2FF',
          border: '#D8D4FF',
        },
        secondary: {
          blue: '#7B61FF',
        },
        navy: {
          950: '#0B0C14',
          900: '#181926',
          800: '#23253B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          100: '#F1F4F9',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#ECFDF5',
          border: '#A7F3D0',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FFFBEB',
          border: '#FDE68A',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEF2F2',
          border: '#FECACA',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        shell: '0 24px 70px -15px rgba(24, 25, 38, 0.07), 0 2px 10px rgba(24, 25, 38, 0.02)',
        card: '0 4px 20px -2px rgba(24, 25, 38, 0.04), 0 1px 3px rgba(24, 25, 38, 0.02)',
        'card-hover': '0 12px 30px -4px rgba(99, 91, 255, 0.12), 0 4px 10px rgba(24, 25, 38, 0.04)',
        purple: '0 10px 25px -5px rgba(99, 91, 255, 0.35)',
        'dark-card': '0 15px 35px -5px rgba(0, 0, 0, 0.35)',
      },
      borderRadius: {
        shell: '32px',
        card: '22px',
        finnova: '28px',
      },
    },
  },
  plugins: [],
};
