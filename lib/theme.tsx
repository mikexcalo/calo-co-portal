'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';

const darkTokens = {
  bg: { primary: '#111113', surface: '#1a1a1d', surfaceHover: '#222225', elevated: '#222225', sidebar: '#111113' },
  border: { default: 'rgba(255,255,255,0.08)', hover: 'rgba(255,255,255,0.15)', active: 'rgba(255,255,255,0.2)' },
  text: { primary: '#f5f5f5', secondary: '#8a8a8d', tertiary: '#5a5a5d', inverse: '#111113' },
  accent: { primary: '#ff4d00', primaryHover: '#ff6a2a', subtle: 'rgba(255,77,0,0.08)', text: '#ff6a2a' },
  status: { success: '#00c853', warning: '#ffab00', danger: '#ff3d3d', info: '#4da6ff' },
  radius: { sm: '6px', md: '8px', lg: '12px' },
  shadow: { card: '0 1px 2px rgba(0,0,0,0.3)', elevated: '0 4px 12px rgba(0,0,0,0.4)' },
};

const lightTokens = {
  bg: { primary: '#f7f7f8', surface: '#ffffff', surfaceHover: '#f0f0f2', elevated: '#ffffff', sidebar: '#ffffff' },
  border: { default: 'rgba(0,0,0,0.08)', hover: 'rgba(0,0,0,0.15)', active: 'rgba(0,0,0,0.2)' },
  text: { primary: '#111113', secondary: '#6b6b6f', tertiary: '#9b9b9f', inverse: '#f7f7f8' },
  accent: { primary: '#ff4d00', primaryHover: '#e54400', subtle: 'rgba(255,77,0,0.06)', text: '#e54400' },
  status: { success: '#16a34a', warning: '#d97706', danger: '#dc2626', info: '#2563eb' },
  radius: { sm: '6px', md: '8px', lg: '12px' },
  shadow: { card: '0 1px 3px rgba(0,0,0,0.06)', elevated: '0 4px 12px rgba(0,0,0,0.08)' },
};

export type Tokens = typeof darkTokens;

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: Tokens;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  t: darkTokens,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('calo-theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') setThemeState(stored);
    setMounted(true);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('calo-theme', t);
  };

  const t = theme === 'light' ? lightTokens : darkTokens;

  // Apply to body
  useEffect(() => {
    if (!mounted) return;
    document.body.style.background = t.bg.primary;
    document.body.style.color = t.text.primary;
  }, [t, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Static export for non-context usage (SSR-safe, always dark)
export { darkTokens, lightTokens };
