'use client';

import { Icon } from '@iconify/react';

import { launchWorldMode, useWorldMode, worldMode } from 'components/World/worldMode';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWorldPreference } from '@/hooks/useWorldPreference';

import './RoamButton.scss';

/**
 * Free roam, front and centre: a floating button that hands the camera to
 * the visitor (switching the 3D world on first if needed) and, on desktop,
 * becomes the way back while they fly. Hidden where WebGL is unavailable,
 * during the guided tour, and in free flight on touch screens, where the
 * flight pad needs the corner.
 */
export function RoamButton() {
  const { supported, setEnabled } = useWorldPreference();
  const { mode } = useWorldMode();
  const touch = useMediaQuery('(pointer: coarse)');
  const exploring = mode === 'explore';
  if (!supported || mode === 'tour' || (exploring && touch)) return null;

  const toggle = () => {
    if (exploring) worldMode.exit();
    else launchWorldMode('explore', () => setEnabled(true));
  };

  return (
    <button
      type="button"
      className={exploring ? 'roam-fab roam-fab--on' : 'roam-fab'}
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
