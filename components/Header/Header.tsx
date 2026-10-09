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
import { HeaderHud } from 'components/HeaderHud/HeaderHud';
import { setChrome } from 'components/World/worldStore';

import { useTheme } from '@/contexts/ThemeContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWorldPreference } from '@/hooks/useWorldPreference';

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
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, show: false });
  const headerRef = useRef<HTMLElement | null>(null);
  const linksRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useCallback(() => setMobileOpen(false), []);
  // With 3D effects on, the bar is a cockpit HUD (HeaderHud); its flat look
  // stays until the hologram is drawing, and comes back if WebGL fails
  const { enabled, supported } = useWorldPreference();
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const [hudFailed, setHudFailed] = useState(false);
  const [hudLive, setHudLive] = useState(false);
  const hud = enabled && supported && !hudFailed;
  const onHudLive = useCallback((live: boolean) => {
    setHudLive(live);
    if (!live) setHudFailed(true);
  }, []);

  const pathname = usePathname();
  // A new page closes the menu, whatever opened it: its own links close it
  // as they're tapped, but the logo stays in reach above it, and so do the
  // command palette and the browser's back button
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileOpen(false);
  }
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The header stays put as the page scrolls, but on a loose spring: it
  // trails a little after the page (up as you scroll down, down as you
  // scroll up) and settles back once the page stops
  useEffect(() => {
    const el = headerRef.current;
    if (!el || reduced) return;
    let frame = 0;
    let last = performance.now();
    let lastY = window.scrollY;
    let velocity = 0;
    let at = 0;
    let speed = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (dt <= 0) return;
      const y = window.scrollY;
      // A jump (a new page scrolled back to the top) isn't scrolling
      if (Math.abs(y - lastY) < 1200) {
        velocity += ((y - lastY) / dt - velocity) * (1 - Math.exp(-14 * dt));
      }
      lastY = y;
      const target = Math.max(-22, Math.min(22, -velocity * 0.012));
      speed += ((target - at) * 45 - speed * 8) * dt;
      at += speed * dt;
      if (Math.abs(target - at) < 0.01 && Math.abs(speed) < 0.02) {
        at = target;
        speed = 0;
      }
      const transform = Math.abs(at) < 0.01 ? '' : `translate3d(0, ${at.toFixed(2)}px, 0)`;
      if (el.style.transform !== transform) el.style.transform = transform;
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      el.style.transform = '';
    };
  }, [reduced]);

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
    // The menu only shows on narrow screens (MobileMenu.scss): widened past
    // them (a tablet turned to landscape) it closes, rather than stay open
    // unseen and out of reach, holding the page and the world still
    const wide = window.matchMedia('(min-width: 901px)');
    const handleWiden = () => {
      if (wide.matches) setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    wide.addEventListener('change', handleWiden);
    document.documentElement.classList.add('menu-open');
    // The menu is opaque and covers the world: it stops drawing until it closes
    setChrome({ menuOpen: true });
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      wide.removeEventListener('change', handleWiden);
      document.documentElement.classList.remove('menu-open');
      setChrome({ menuOpen: false });
    };
  }, [mobileOpen]);

  return (
    <>
      {/* The bar is see-through: once the page scrolls under it, this keeps it readable */}
      <div className={`header-scrim${scrolled ? ' header-scrim--on' : ''}`} aria-hidden="true" />
      <header
        ref={headerRef}
        className={`header${scrolled ? ' header--scrolled' : ''}${mobileOpen ? ' header--open' : ''}${hud && hudLive ? ' header--hud' : ''}`}
      >
        <nav className="header__bar" aria-label="Main navigation">
          {hud && (
            <HeaderHud
              theme={theme === 'light' ? 'light' : 'dark'}
              dense={scrolled || mobileOpen}
              still={reduced}
              onLive={onHudLive}
            />
          )}
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
        hud={hud && hudLive}
        onClose={closeMenu}
      />
    </>
  );
};

export default Header;
