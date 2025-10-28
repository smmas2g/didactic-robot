import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'orb-blue': '#2E86AB',
        'orb-gold': '#F6C85F',
        'orb-purple': '#8A508F',
        'orb-teal': '#00A6A6',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      },
      animation: {
        'pulse-soft': 'pulseSoft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
