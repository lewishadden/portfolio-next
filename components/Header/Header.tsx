'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';

import { ThemeToggle } from 'components/ThemeToggle/ThemeToggle';
import { WorldToggle } from 'components/WorldToggle/WorldToggle';
import { ScrambleText } from 'components/Motion/ScrambleText';

import { useFocusTrap } from '@/hooks/useFocusTrap';

import { Header as HeaderProps, NavItem } from '@/types';

import './Header.scss';

export const Header = ({
  header,
  navItems,
  available = false,
}: {
  header: HeaderProps;
  navItems: NavItem[];
  available?: boolean;
}) => {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, show: false });
  const lastYRef = useRef(0);
  const linksRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useFocusTrap<HTMLDivElement>(mobileOpen);

  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastYRef.current;
      // Smooth scrolling eases out in tiny steps — only react to deliberate movement
      if (y < 200) setHidden(false);
      else if (delta > 4) setHidden(true);
      else if (delta < -4) setHidden(false);
      setScrolled(y > 24);
      lastYRef.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const measure = useCallback(() => {
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
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [pathname, measure]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.documentElement.classList.add('menu-open');
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.classList.remove('menu-open');
    };
  }, [mobileOpen]);

  return (
    <header
      className={`header${hidden && !mobileOpen ? ' header--hidden' : ''}${scrolled ? ' header--scrolled' : ''}${mobileOpen ? ' header--open' : ''}`}
    >
      <nav className="header__bar" aria-label="Main navigation">
        <Link href={header.home.href} className="header__logo" aria-label={header.home.ariaLabel}>
          <span className="header__logo-orbit" aria-hidden="true">
            <span className="header__logo-planet" />
          </span>
          <span className="header__logo-mark" aria-hidden="true">
            {header.home.label}
          </span>
        </Link>

        <div className="header__links" ref={linksRef}>
          <span
            className="header__indicator"
            style={{
              transform: `translateX(${indicator.x}px)`,
              width: `${indicator.w}px`,
              opacity: indicator.show ? 1 : 0,
            }}
            aria-hidden="true"
          />
          <ul className="header__list">
            {navItems.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`header__link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <ScrambleText text={label} hover trigger="none" duration={420} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="header__actions">
          <WorldToggle />
          <ThemeToggle />
          <Link href="/contact" className="header__cta">
            {available && <span className="header__cta-dot" aria-hidden="true" />}
            <span>Let&rsquo;s talk</span>
            <Icon icon="ph:arrow-up-right-bold" width={14} height={14} aria-hidden="true" />
          </Link>
          <button
            className="header__burger"
            onClick={() => setMobileOpen((p) => !p)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            type="button"
          >
            <span />
            <span />
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        ref={mobileMenuRef}
        className="header__mobile"
        aria-hidden={!mobileOpen}
        data-lenis-prevent
      >
        <ul className="header__mobile-links">
          {navItems.map(({ href, label }, i) => (
            <li key={href} style={{ '--i': i } as React.CSSProperties}>
              <Link
                href={href}
                className={`header__mobile-link${isActive(href) ? ' is-active' : ''}`}
                tabIndex={mobileOpen ? 0 : -1}
                onClick={() => setMobileOpen(false)}
              >
                <span className="header__mobile-index" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{label}</span>
                <Icon icon={header.mobile.icon} width={22} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="header__mobile-foot">
          <span className="header__cta-dot" aria-hidden="true" />
          Peterborough, UK · UK &amp; EU remote
        </p>
      </div>
    </header>
  );
};

export default Header;
