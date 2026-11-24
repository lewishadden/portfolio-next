'use client';

import { createContext, useContext, useEffect, useSyncExternalStore, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themeListeners = new Set<() => void>();
/** In-memory copy of the choice, so it applies even when storage is blocked */
let override: Theme | undefined;

function notifyThemeChange() {
  themeListeners.forEach((listener) => listener());
}

function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key !== 'theme') return;
    override = undefined; // another tab changed it: storage is the truth again
    callback();
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    themeListeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function readSaved(): Theme | null {
  try {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    // Storage blocked (privacy settings): fall back to the system preference
    return null;
  }
}

function getThemeSnapshot(): Theme {
  if (override) return override;
  const saved = readSaved();
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getThemeServerSnapshot(): Theme {
  return 'dark';
}

const emptySubscribe = () => () => {};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Update document attributes when theme changes
  useEffect(() => {
    if (mounted) {
      document.body.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    override = newTheme;
    try {
      localStorage.setItem('theme', newTheme);
    } catch {
      // Storage blocked: the choice still applies until reload
    }
    notifyThemeChange();
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
