'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { ThemeToggle } from 'components/ThemeToggle/ThemeToggle';

import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useActiveSection } from '@/hooks/useActiveSection';

import { Header as HeaderProps, NavItem } from '@/types';

import './Header.scss';

export const Header = ({ header, navItems }: { header: HeaderProps; navItems: NavItem[] }) => {
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastYRef = useRef(0);
  const linksRef = useRef<HTMLUListElement | null>(null);
  const mobileMenuRef = useFocusTrap<HTMLDivElement>(mobileOpen);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, show: false });

  const sectionIds = navItems.map((i) => i.href.replace(/^#/, ''));
  const active = useActiveSection(sectionIds);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 160 && y > lastYRef.current);
      lastYRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const container = linksRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>('.header__link.is-active');
    if (el) {
      const r = el.getBoundingClientRect();
      const p = container.getBoundingClientRect();
      setIndicator({ x: r.left - p.left, w: r.width, show: true });
    } else {
      setIndicator((i) => ({ ...i, show: false }));
    }
  }, [active]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
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
      window.scrollTo({ top: targetTop - 20, behavior: 'smooth' });
    }
  }, []);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="header__backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={-1}
        />
      )}
      <header className={`header${hidden ? ' header--hidden' : ''}`} role="banner">
        <nav className="header__nav" aria-label="Main navigation">
          <a href={header.home.href} className="header__logo" aria-label={header.home.ariaLabel}>
            {header.home.label}
          </a>

          <ul className="header__links" ref={linksRef}>
            {navItems.map(({ href, label }) => {
              const id = href.replace(/^#/, '');
              const isActive = active === id;
              return (
                <li key={href}>
                  <a
                    href={href}
                    className={`header__link${isActive ? ' is-active' : ''}`}
                    onClick={handleNavClick}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
            <span
              className="header__indicator"
              style={{
                transform: `translateX(${indicator.x}px)`,
                width: `${indicator.w}px`,
                opacity: indicator.show ? 1 : 0,
              }}
              aria-hidden="true"
            />
          </ul>

          <div className="header__actions">
            <ThemeToggle />
            <button
              className={`header__hamburger${mobileOpen ? ' header__hamburger--open' : ''}`}
              onClick={() => setMobileOpen((p) => !p)}
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

        <div
          ref={mobileMenuRef}
          className={`header__mobile${mobileOpen ? ' header__mobile--open' : ''}`}
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
                  <Icon icon={header.mobile.icon} width={14} aria-hidden="true" />
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
