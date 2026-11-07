import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171827',
        paper: '#fbf7f4',
        purple: '#4b146d',
        lavender: '#ddcbea',
        muted: '#5e5b65',
      },
      fontFamily: { sans: ['Barlow', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
