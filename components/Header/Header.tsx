'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';

import { commandPalette } from 'components/CommandPalette/CommandPalette';
import { ThemeToggle } from 'components/ThemeToggle/ThemeToggle';
import { WorldToggle } from 'components/WorldToggle/WorldToggle';
import { SoundToggle } from 'components/Sound/SoundToggle';
import { HeaderMark } from 'components/BrandMark/HeaderMark';
import { ScrambleText } from 'components/Motion/ScrambleText';
import { MobileMenu } from 'components/MobileMenu/MobileMenu';

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
  const closeMenu = useCallback(() => setMobileOpen(false), []);

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
    <>
      <header
        className={`header${hidden && !mobileOpen ? ' header--hidden' : ''}${scrolled ? ' header--scrolled' : ''}${mobileOpen ? ' header--open' : ''}`}
      >
        <nav className="header__bar" aria-label="Main navigation">
          <Link href={header.home.href} className="header__logo" aria-label={header.home.ariaLabel}>
            <HeaderMark className="header__logo-mark" />
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
            <button
              type="button"
              className="header__palette"
              onClick={commandPalette.open}
              aria-label="Open command palette"
              aria-keyshortcuts="Meta+K Control+K"
              title="Command palette (⌘K / Ctrl+K)"
            >
              <Icon icon="ph:command-bold" width={17} height={17} aria-hidden="true" />
            </button>
            <WorldToggle />
            <SoundToggle />
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
      </header>
      <MobileMenu
        open={mobileOpen}
        navItems={navItems}
        icon={header.mobile.icon}
        onClose={closeMenu}
      />
    </>
  );
};

export default Header;
