import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d0d0f',
        foreground: '#f5f5f2',
        muted: '#b8b8b1',
        accent: '#f0f0eb',
        panel: '#151518'
      },
      boxShadow: {
        premium: '0 18px 60px rgba(0,0,0,0.35)'
      }
    }
  },
  plugins: []
};

export default config;
