'use client';

import { useCallback, useEffect, useState } from 'react';
import { useHeadroom } from '@/hooks/useHeadroom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Icon } from '@iconify/react';
import { ThemeToggle } from 'components/ThemeToggle/ThemeToggle';

import './Header.scss';

const navItems = [
  { href: '#about', label: 'About' },
  { href: '#experience', label: 'Experience' },
  { href: '#projects', label: 'Projects' },
  { href: '#skills', label: 'Skills' },
  { href: '#contact', label: 'Contact' },
];

export const Header = () => {
  const isPinned = useHeadroom();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useFocusTrap<HTMLDivElement>(mobileOpen);

  useEffect(() => {
    document.documentElement.setAttribute('data-header-pinned', String(isPinned));
  }, [isPinned]);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute('href');
    if (!href?.startsWith('#')) return;

    const target = document.getElementById(href.slice(1));
    if (!target) return;

    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    const isScrollingDown = targetTop > window.scrollY;

    if (isScrollingDown) {
      e.preventDefault();
      const scrollDownOffset = 20;
      window.scrollTo({ top: targetTop - scrollDownOffset, behavior: 'smooth' });
    }
    // scrolling up: let default behavior apply scroll-margin-top
  }, []);

  return (
    <>
      {/* Backdrop overlay for mobile menu */}
      {mobileOpen && (
        <button
          type="button"
          className="header__backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={-1}
        />
      )}
      <header
        className={`header ${isPinned ? 'header--visible' : ''}`}
        role="banner"
        ref={mobileMenuRef}
      >
        <nav className="header__nav" aria-label="Main navigation">
          <a href="#home" className="header__logo" aria-label="Go to top">
            LH
          </a>

          <ul className="header__links">
            {navItems.map(({ href, label }) => (
              <li key={href}>
                <a href={href} className="header__link" onClick={handleNavClick}>
                  {label}
                </a>
              </li>
            ))}
          </ul>

          <div className="header__actions">
            <ThemeToggle />
            <button
              className={`header__hamburger ${mobileOpen ? 'header__hamburger--open' : ''}`}
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div
          className={`header__mobile ${mobileOpen ? 'header__mobile--open' : ''}`}
          aria-hidden={!mobileOpen}
        >
          <ul className="header__mobile-links">
            {navItems.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="header__mobile-link"
                  tabIndex={mobileOpen ? 0 : -1}
                  onClick={(e) => {
                    setMobileOpen(false);
                    handleNavClick(e);
                  }}
                >
                  <Icon icon="ph:arrow-up-right" width={14} aria-hidden="true" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </header>
    </>
  );
};

export default Header;
