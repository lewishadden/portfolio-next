'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';
import { ThemeToggle } from 'components/ThemeToggle/ThemeToggle';

import { useFocusTrap } from '@/hooks/useFocusTrap';

import { Header as HeaderProps, NavItem } from '@/types';

import './Header.scss';

export const Header = ({ header, navItems }: { header: HeaderProps; navItems: NavItem[] }) => {
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastYRef = useRef(0);
  const linksRef = useRef<HTMLUListElement | null>(null);
  const mobileMenuRef = useFocusTrap<HTMLDivElement>(mobileOpen);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, show: false });

  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

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
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

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
          <Link href={header.home.href} className="header__logo" aria-label={header.home.ariaLabel}>
            {header.home.label}
          </Link>

          <ul className="header__links" ref={linksRef}>
            {navItems.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link href={href} className={`header__link${active ? ' is-active' : ''}`}>
                    {label}
                  </Link>
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
                <Link
                  href={href}
                  className="header__mobile-link"
                  tabIndex={mobileOpen ? 0 : -1}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon icon={header.mobile.icon} width={14} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </header>
    </>
  );
};

export default Header;
