'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';
import { useLenis } from 'lenis/react';

import { stationForPath, stationNames } from 'components/World/routes';

import { useTheme } from '@/contexts/ThemeContext';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWorldPreference } from '@/hooks/useWorldPreference';

import { MenuWarp } from './MenuWarp';

import type { CSSProperties } from 'react';
import type { NavItem } from '@/types';

import './MobileMenu.scss';

/**
 * The navigation menu on narrow screens, opened from the header's menu
 * button: a warp jump. With 3D effects on, a starfield shader (MenuWarp)
 * streaks past as it opens and drifts behind the links, which swing up out
 * of the depth one by one, each with the craft its page is docked at.
 * It sits under the header, so the bar and its close button stay on top.
 */
export function MobileMenu({
  open,
  navItems,
  icon,
  onClose,
}: {
  open: boolean;
  navItems: NavItem[];
  icon: string;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const menuRef = useFocusTrap<HTMLDivElement>(open);
  const lenis = useLenis();
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const { enabled, supported } = useWorldPreference();

  // The page under the menu holds still
  useEffect(() => {
    if (!open || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [open, lenis]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      id="mobile-menu"
      ref={menuRef}
      className="mobile-menu"
      data-open={open || undefined}
      aria-hidden={!open}
      inert={!open}
    >
      <MenuWarp
        open={open}
        theme={theme === 'light' ? 'light' : 'dark'}
        enabled={enabled && supported}
        still={reduced}
      />
      <div className="mobile-menu__body" data-lenis-prevent>
        <ul className="mobile-menu__links">
          {navItems.map(({ href, label }, i) => {
            const active = isActive(href);
            const { craft } = stationNames[stationForPath(href)];
            return (
              <li key={href} className="mobile-menu__item" style={{ '--i': i } as CSSProperties}>
                <Link
                  href={href}
                  className={`mobile-menu__link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  tabIndex={open ? 0 : -1}
                  onClick={onClose}
                >
                  <span className="mobile-menu__index" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="mobile-menu__name">
                    <span className="mobile-menu__label">{label}</span>
                    <span className="mobile-menu__craft" aria-hidden="true">
                      {craft}
                    </span>
                  </span>
                  <Icon icon={icon} width={22} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mobile-menu__foot">
          <span className="mobile-menu__dot" aria-hidden="true" />
          Peterborough, UK · UK &amp; EU remote
        </p>
      </div>
    </div>
  );
}

export default MobileMenu;
