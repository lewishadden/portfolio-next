'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';
import { usePathname } from 'next/navigation';

import { launchWorldMode, useWorldMode, worldMode } from 'components/World/worldMode';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWorldPreference } from '@/hooks/useWorldPreference';

import './RoamButton.scss';

/** How far down the home page the button stays a full pill (px) */
const pillFor = 120;

const subscribeScroll = (callback: () => void) => {
  window.addEventListener('scroll', callback, { passive: true });
  return () => window.removeEventListener('scroll', callback);
};
const nearTop = () => window.scrollY < pillFor;
const serverNearTop = () => true;

/**
 * Free roam, front and centre: a floating button that hands the camera to
 * the visitor and, on desktop, becomes the way back while they fly. With
 * the world switched off it says so, and turns the world back on (free
 * roam is a click away again once it is up). A full pill only at the top
 * of the home page; everywhere else it would cover the page, so it is just
 * its icon, the label sliding out on hover or focus. Hidden where WebGL is
 * unavailable, during the guided tour, and in free flight on touch screens,
 * where the flight pad needs the corner.
 */
export function RoamButton() {
  const { enabled, supported, setEnabled } = useWorldPreference();
  const { mode } = useWorldMode();
  const touch = useMediaQuery('(pointer: coarse)');
  const pathname = usePathname();
  const top = useSyncExternalStore(subscribeScroll, nearTop, serverNearTop);
  const exploring = mode === 'explore';
  if (!supported || mode === 'tour' || (exploring && touch)) return null;

  const compact = !exploring && !(pathname === '/' && top);
  const toggle = () => {
    if (exploring) worldMode.exit();
    else if (!enabled) setEnabled(true);
    else launchWorldMode('explore', () => setEnabled(true));
  };
  const [icon, label, sub] = exploring
    ? ['ph:x-bold', 'Exit free roam', 'Back to the page']
    : enabled
      ? ['ph:rocket-launch-bold', 'Free roam', 'Fly the 3D world']
      : ['ph:cube-bold', 'Turn on 3D', 'See the world behind the page'];

  return (
    <button
      type="button"
      className={`roam-fab${exploring ? ' roam-fab--on' : ''}${compact ? ' roam-fab--compact' : ''}`}
      onClick={toggle}
    >
      <span className="roam-fab__icon" aria-hidden="true">
        <Icon icon={icon} width={22} height={22} />
      </span>
      <span className="roam-fab__label">
        <b>{label}</b>
        <small aria-hidden="true">{sub}</small>
      </span>
    </button>
  );
}

export default RoamButton;
