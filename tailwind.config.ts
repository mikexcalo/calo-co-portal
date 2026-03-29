import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'nav-bg': '#1a1f2e',
        'page-bg': '#f4f5f7',
        'primary': '#2563eb',
        'amber': '#f59e0b',
        'slate-dark': '#0f172a',
        'slate-mid': '#1e293b',
        'slate-border': '#334155',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
