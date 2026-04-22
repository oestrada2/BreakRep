import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'midnight' | 'ocean' | 'forest' | 'carbon' | 'rose' | 'nebula' | 'bluegray';

export interface ThemeMeta {
  id: Theme;
  label: string;
  bg: string;      // swatch preview — page bg
  card: string;    // swatch preview — card color
  accent: string;  // swatch preview — accent dot
  text: string;    // swatch preview — text color
}

export const THEMES: ThemeMeta[] = [
  { id: 'dark',     label: 'Dark',     bg: '#0B1C2D', card: '#0D1F33', accent: '#38BDF8', text: '#EAF2FF' },
  { id: 'light',    label: 'Light',    bg: '#EFF5FF', card: '#FFFFFF', accent: '#0369A1', text: '#0B1C2D' },
  { id: 'midnight', label: 'Midnight', bg: '#0F0B2A', card: '#140E35', accent: '#A78BFA', text: '#EEE8FF' },
  { id: 'ocean',    label: 'Ocean',    bg: '#051E28', card: '#062430', accent: '#22D3EE', text: '#D0F4FF' },
  { id: 'forest',   label: 'Forest',   bg: '#091810', card: '#0B1E13', accent: '#4ADE80', text: '#DAFAE5' },
  { id: 'carbon',   label: 'Carbon',   bg: '#111111', card: '#181818', accent: '#60A5FA', text: '#F2F2F2' },
  { id: 'rose',     label: 'Rose',     bg: '#1A0912', card: '#200B16', accent: '#F472B6', text: '#FFE0EE' },
  { id: 'nebula',   label: 'Nebula',   bg: '#08041A', card: '#100830', accent: '#A855F7', text: '#EDE0FF' },
  { id: 'bluegray', label: 'Blue Gray', bg: '#0C1018', card: '#141C26', accent: '#94A3B8', text: '#E2E8F0' },
];

const STORAGE_KEY = 'puh_theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** @deprecated use setTheme */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && THEMES.some(t => t.id === saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
