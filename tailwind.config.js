/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '480px', // очень маленькие телефоны
        sm: '640px', // телефоны в портретной ориентации
        md: '768px', // планшеты
        lg: '1024px', // ноутбуки
        xl: '1280px', // десктопы
        '2xl': '1536px', // большие мониторы
      },
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        status: {
          active: '#4caf50',
          inactive: '#f44336',
        },
      },
      animation: {
        bounce: 'bounce 1s infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        bounce: {
          '0%, 100%': {
            transform: 'translateY(-25%)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
      },
    },
  },
  plugins: [],
}
