'use client';

import { Component, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';
import { useLenis } from 'lenis/react';

import { stationForPath, stationNames, stationPositions } from 'components/World/routes';
import { worldCover } from 'components/World/worldCover';

import { useTheme } from '@/contexts/ThemeContext';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWorldPreference } from '@/hooks/useWorldPreference';

import { starLabels } from './starLabels';

import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { StationKey } from 'components/World/routes';
import type { NavItem } from '@/types';

import './NavMenu.scss';

// Shares three.js and R3F with the world's chunk
const loadStarMap = () => import('./StarMap');
const StarMap = dynamic(loadStarMap, { ssr: false });

/** If the star map can't start, the menu falls back to its list */
class MapFallback extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const home = stationPositions.home;
const fromHome = (key: StationKey) => {
  const [x, y, z] = stationPositions[key];
  return Math.round(Math.hypot(x - home[0], y - home[1], z - home[2]));
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Modified and middle clicks keep their browser behaviour (new tab, etc.) */
const plainClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * The navigation menu, opened from the header's menu button on every
 * screen: a star map. With 3D effects on, the six stations are glowing
 * worlds on a tilted orbit (StarMap) that arrives out of a warp, and the
 * menu's links sit over them: pointing at one (or tapping it, or focusing
 * it) picks it and a panel says where it is; clicking the picked one, or
 * the panel's button, flies there. Without WebGL or with 3D effects off
 * it's a list. It sits under the header, so the bar and its close button
 * stay on top.
 */
export function NavMenu({
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
  const touch = useMediaQuery('(pointer: coarse)');
  const { enabled, supported } = useWorldPreference();
  const [failed, setFailed] = useState(false);
  const map = enabled && supported && !failed;
  // The map mounts the first time the menu opens, then stays
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<StationKey | ''>('');
  const [shown, setShown] = useState(open);
  /** What was picked as a press began: a press on the picked station flies */
  const pressed = useRef<StationKey | '' | null>(null);

  if (open !== shown) {
    setShown(open);
    if (open) setSelected('');
  }
  if (map && open && !mounted) setMounted(true);

  // Fetch the map's code while the page is idle, so the first open isn't blank
  useEffect(() => {
    if (!map) return;
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 2000));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => void loadStarMap());
    return () => cancel(id);
  }, [map]);

  // The page under the menu holds still
  useEffect(() => {
    if (!open || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [open, lenis]);

  // Fully open, the menu hides the whole world, which can stop drawing
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => worldCover.set(true), 400);
    return () => {
      window.clearTimeout(id);
      worldCover.set(false);
    };
  }, [open]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  const docked = stationForPath(pathname);
  const stations = navItems.map((item, index) => ({
    ...item,
    index,
    key: stationForPath(item.href),
  }));
  const keys = stations.map((s) => s.key);
  const current = stations.find((s) => s.key === selected);

  const pick = (key: StationKey) => {
    if (map) setSelected(key);
  };

  const onStationClick = (e: MouseEvent<HTMLAnchorElement>, key: StationKey) => {
    const before = pressed.current;
    pressed.current = null;
    if (!plainClick(e)) return;
    // The list, or the station already picked: go
    if (!map || (before ?? selected) === key) {
      onClose();
      return;
    }
    e.preventDefault();
    setSelected(key);
  };

  // Arrow keys step round the stations
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!map) return;
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const from = Math.max(keys.indexOf(selected || docked), 0);
    starLabels.get(keys[(from + step + keys.length) % keys.length])?.focus();
  };

  return (
    <div
      id="nav-menu"
      ref={menuRef}
      className="nav-menu"
      data-open={open || undefined}
      data-map={map || undefined}
      aria-hidden={!open}
      inert={!open}
    >
      {map && mounted && (
        <MapFallback onError={() => setFailed(true)}>
          <StarMap
            open={open}
            keys={keys}
            selected={selected}
            docked={keys.includes(docked) ? docked : ''}
            theme={theme === 'light' ? 'light' : 'dark'}
            still={reduced}
          />
        </MapFallback>
      )}
      <div
        className="nav-menu__body"
        data-lenis-prevent
        // A click on open space puts the pick down
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected('');
        }}
      >
        <ul className="nav-menu__stations" onKeyDown={onKeyDown}>
          {stations.map(({ href, label, index, key }) => {
            const active = isActive(href);
            return (
              <li key={href} className="nav-menu__item" style={{ '--i': index } as CSSProperties}>
                <Link
                  ref={(el) => {
                    if (el) starLabels.set(key, el);
                    else starLabels.delete(key);
                  }}
                  href={href}
                  className={`nav-menu__station${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  data-picked={(map && selected === key) || undefined}
                  tabIndex={open ? 0 : -1}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') pick(key);
                  }}
                  onPointerDown={() => {
                    pressed.current = selected;
                  }}
                  onFocus={() => pick(key)}
                  onClick={(e) => onStationClick(e, key)}
                >
                  <span className="nav-menu__hit" aria-hidden="true" />
                  <span className="nav-menu__index" aria-hidden="true">
                    {pad(index + 1)}
                  </span>
                  <span className="nav-menu__name">
                    <span className="nav-menu__label">{label}</span>
                    <span className="nav-menu__craft" aria-hidden="true">
                      {stationNames[key].craft}
                    </span>
                  </span>
                  <Icon className="nav-menu__arrow" icon={icon} width={22} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>

        {map ? (
          <div className="nav-menu__panel" aria-live="polite">
            {current ? (
              <>
                <span className="nav-menu__panel-index" aria-hidden="true">
                  {pad(current.index + 1)}
                </span>
                <span className="nav-menu__panel-text">
                  <span className="nav-menu__panel-name">{current.label}</span>
                  <span className="nav-menu__panel-meta">
                    {stationNames[current.key].craft} ·{' '}
                    {current.key === 'home' ? 'Home port' : `${fromHome(current.key)} km from Home`}
                    {current.key === docked && ' · Docked here'}
                  </span>
                </span>
                <Link
                  href={current.href}
                  className="btn btn--primary nav-menu__fly"
                  onClick={onClose}
                >
                  <span>
                    {current.key === docked
                      ? `Back to ${current.label}`
                      : `Fly to ${current.label}`}
                  </span>
                  <Icon icon="ph:rocket-launch-bold" width={16} height={16} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <p className="nav-menu__panel-hint">
                {touch
                  ? 'Tap a station, then tap it again to fly there'
                  : 'Point at a station and click to fly there · ← → to pick'}
              </p>
            )}
          </div>
        ) : (
          <p className="nav-menu__foot">
            <span className="nav-menu__dot" aria-hidden="true" />
            Peterborough, UK · UK &amp; EU remote
          </p>
        )}
      </div>
    </div>
  );
}

export default NavMenu;
