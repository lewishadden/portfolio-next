'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';
import { useLenis } from 'lenis/react';

import { stationForPath, stationNames, stationPositions } from 'components/World/routes';

import { useTheme } from '@/contexts/ThemeContext';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { MenuHolo } from './MenuHolo';

import type { CSSProperties } from 'react';
import type { NavItem } from '@/types';

import './MobileMenu.scss';

/**
 * The navigation menu on narrow screens, opened from the header's menu
 * button. It sits under the header, so the bar and its close button stay
 * on top. Each link shows the craft its page is docked at and how far away
 * it is. While the header is a HUD (3D effects on), so is the menu: a
 * hologram panel (MenuHolo) that powers on as it opens, its links
 * flickering on one by one, and switches off as it closes. Otherwise the
 * links swing up out of the depth over a gradient.
 */
export function MobileMenu({
  open,
  navItems,
  icon,
  hud,
  onClose,
}: {
  open: boolean;
  navItems: NavItem[];
  icon: string;
  /** The header is a cockpit HUD (3D effects on, WebGL working) */
  hud: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const menuRef = useFocusTrap<HTMLDivElement>(open);
  const lenis = useLenis();
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const here = stationPositions[stationForPath(pathname)];

  // The page under the menu holds still
  useEffect(() => {
    if (!open || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [open, lenis]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  /** How far a page's station is from the one docked at now (km, as the station readout counts) */
  const rangeTo = (href: string) => {
    const [x, y, z] = stationPositions[stationForPath(href)];
    return Math.round(Math.hypot(x - here[0], y - here[1], z - here[2]));
  };

  return (
    <div
      id="mobile-menu"
      ref={menuRef}
      className={`mobile-menu${hud ? ' mobile-menu--hud' : ''}`}
      data-open={open || undefined}
      aria-hidden={!open}
      inert={!open}
    >
      {hud && (
        <MenuHolo
          open={open}
          theme={theme === 'light' ? 'light' : 'dark'}
          still={reduced}
          active={navItems.findIndex(({ href }) => isActive(href))}
          menuRef={menuRef}
        />
      )}
      <div className="mobile-menu__body" data-lenis-prevent>
        <div className="mobile-menu__panel">
          <p className="mobile-menu__title" aria-hidden="true">
            Set course
          </p>
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
                    <span className="mobile-menu__range" aria-hidden="true">
                      {active ? 'Docked' : `${rangeTo(href)} km`}
                    </span>
                    <Icon icon={icon} width={22} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mobile-menu__foot">
          <span className="mobile-menu__dot" aria-hidden="true" />
          Peterborough, UK · UK &amp; EU remote
        </p>
      </div>
    </div>
  );
}

export default MobileMenu;
