import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        red: { DEFAULT: '#CC0000', dark: '#a80000', light: '#fff5f5', mid: '#ffe0e0' },
        brand: { black: '#0a0a0a' },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease forwards',
        'pulse-dot': 'pulse 2s infinite',
      },
    },
  },
  plugins: [],
};
export default config;
