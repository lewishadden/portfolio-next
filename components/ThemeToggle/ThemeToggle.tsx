'use client';

import { Icon } from '@iconify/react';
import { useTheme } from 'contexts/ThemeContext';
import './ThemeToggle.scss';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle ${theme === 'light' ? 'theme-toggle--light' : 'theme-toggle--dark'}`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      type="button"
      role="switch"
      aria-checked={theme === 'light'}
    >
      <span className="theme-toggle__track">
        <span className="theme-toggle__icon-container">
          <Icon
            icon="ph:sun-fill"
            className="theme-toggle__icon theme-toggle__icon--sun"
            aria-hidden="true"
          />
          <Icon
            icon="ph:moon-fill"
            className="theme-toggle__icon theme-toggle__icon--moon"
            aria-hidden="true"
          />
        </span>
        <span className="theme-toggle__thumb"></span>
      </span>
      <span className="sr-only">{theme === 'light' ? 'Light' : 'Dark'} Mode</span>
    </button>
  );
};

export default ThemeToggle;
