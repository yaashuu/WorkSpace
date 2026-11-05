/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6558D9',
          hover: '#5245C4',
          light: '#EEEDFB',
          50: '#F5F4FE',
          100: '#EEEDFB',
          200: '#D5D2F7',
          500: '#6558D9',
          600: '#5245C4',
          700: '#4236A6',
        },
        sidebar: {
          DEFAULT: '#1F2937',
          darker: '#111827',
          hover: '#374151',
          border: '#374151',
          text: '#9CA3AF',
        },
        canvas: '#F5F6FA',
        surface: '#FFFFFF',
        status: {
          success: '#16A34A',
          'success-bg': '#DCFCE7',
          warning: '#F59E0B',
          'warning-bg': '#FEF3C7',
          error: '#EF4444',
          'error-bg': '#FEE2E2',
          info: '#3B82F6',
          'info-bg': '#DBEAFE',
          purple: '#6558D9',
          'purple-bg': '#EEEDFB',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};
