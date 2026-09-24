'use client';

import { Icon } from '@iconify/react';
import { useTheme } from 'contexts/ThemeContext';
import './ThemeToggle.scss';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle theme-toggle--${theme}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      type="button"
      role="switch"
      aria-checked={theme === 'light'}
    >
      <span className="theme-toggle__orbit" aria-hidden="true">
        <Icon icon="ph:sun-bold" className="theme-toggle__icon theme-toggle__icon--sun" />
        <Icon icon="ph:moon-stars-bold" className="theme-toggle__icon theme-toggle__icon--moon" />
      </span>
    </button>
  );
};

export default ThemeToggle;
