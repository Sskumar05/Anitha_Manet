/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: '#E4E7EE',
        surface: '#FFFFFF',
        'card-subtle': '#F8FAFD',
        primary: {
          DEFAULT: '#2864E8',
          hover: '#1E52C7',
          active: '#1742A4',
          light: '#EDF3FF',
          border: '#D0E0FC',
        },
        secondary: {
          blue: '#5D8DF0',
        },
        navy: {
          900: '#24324A',
          700: '#334155',
          500: '#77839A',
          400: '#9AA6BD',
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
        shell: '0 20px 60px -15px rgba(36, 50, 74, 0.08), 0 2px 8px rgba(36, 50, 74, 0.03)',
        card: '0 4px 18px -2px rgba(36, 50, 74, 0.04), 0 1px 3px rgba(36, 50, 74, 0.02)',
        'card-hover': '0 12px 28px -4px rgba(36, 50, 74, 0.08), 0 2px 6px rgba(36, 50, 74, 0.03)',
      },
      borderRadius: {
        shell: '28px',
        card: '20px',
      },
    },
  },
  plugins: [],
};
