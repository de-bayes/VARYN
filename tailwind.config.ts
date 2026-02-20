import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#101113',
        foreground: '#f1f0ed',
        muted: '#a39f96',
        accent: '#b9a47b',
        panel: '#16181b'
      },
      boxShadow: {
        premium: '0 18px 60px rgba(0,0,0,0.35)'
      }
    }
  },
  plugins: []
};

export default config;
