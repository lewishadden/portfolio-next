'use client';

import { Icon } from '@iconify/react';
import { useTheme } from 'contexts/ThemeContext';
import './ThemeToggle.scss';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      type="button"
    >
      <Icon
        icon={theme === 'light' ? 'ph:moon-fill' : 'ph:sun-fill'}
        className="theme-toggle__icon"
        aria-hidden="true"
      />
      <span className="sr-only">{theme === 'light' ? 'Dark' : 'Light'} Mode</span>
    </button>
  );
};

export default ThemeToggle;
