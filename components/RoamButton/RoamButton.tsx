'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';
import { usePathname } from 'next/navigation';

import { useInspection } from 'components/World/inspection';
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
 * the visitor (switching the 3D world on first if needed) and, on desktop,
 * becomes the way back while they fly. A full pill only at the top of the
 * home page; everywhere else it would cover the page, so it is just its
 * icon, the label sliding out on hover or focus. Hidden where WebGL is
 * unavailable, during the guided tour, and in free flight on touch screens,
 * where the flight pad needs the corner.
 */
export function RoamButton() {
  const inspecting = useInspection() !== null;
  const { supported, setEnabled } = useWorldPreference();
  const { mode } = useWorldMode();
  const touch = useMediaQuery('(pointer: coarse)');
  const pathname = usePathname();
  const top = useSyncExternalStore(subscribeScroll, nearTop, serverNearTop);
  const exploring = mode === 'explore';
  if (!supported || inspecting || mode === 'tour' || (exploring && touch)) return null;

  const compact = !exploring && !(pathname === '/' && top);
  const toggle = () => {
    if (exploring) worldMode.exit();
    else launchWorldMode('explore', () => setEnabled(true));
  };

  return (
    <button
      type="button"
      className={`roam-fab${exploring ? ' roam-fab--on' : ''}${compact ? ' roam-fab--compact' : ''}`}
      onClick={toggle}
    >
      <span className="roam-fab__icon" aria-hidden="true">
        <Icon icon={exploring ? 'ph:x-bold' : 'ph:rocket-launch-bold'} width={22} height={22} />
      </span>
      <span className="roam-fab__label">
        <b>{exploring ? 'Exit free roam' : 'Free roam'}</b>
        <small aria-hidden="true">{exploring ? 'Back to the page' : 'Fly the 3D world'}</small>
      </span>
    </button>
  );
}

export default RoamButton;
