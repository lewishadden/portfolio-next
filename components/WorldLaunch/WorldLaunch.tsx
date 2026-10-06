'use client';

import { Icon } from '@iconify/react';

import { launchWorldMode } from 'components/World/worldMode';

import { useWorldPreference } from '@/hooks/useWorldPreference';

import './WorldLaunch.scss';

/**
 * Home hero shortcuts into the 3D world: the guided tour, or free flight.
 * Hidden where WebGL is unavailable; switches the world on first if needed.
 */
export function WorldLaunch() {
  const { supported, setEnabled } = useWorldPreference();
  if (!supported) return null;
  const enable = () => setEnabled(true);
  return (
    <div className="world-launch" role="group" aria-label="3D world">
      <button
        type="button"
        className="world-launch__btn"
        onClick={() => launchWorldMode('tour', enable)}
      >
        <Icon icon="ph:path-bold" width={16} height={16} aria-hidden="true" />
        Take the tour
      </button>
      <span className="world-launch__sep" aria-hidden="true" />
      <button
        type="button"
        className="world-launch__btn"
        onClick={() => launchWorldMode('explore', enable)}
      >
        <Icon icon="ph:rocket-launch-bold" width={16} height={16} aria-hidden="true" />
        Explore freely
      </button>
    </div>
  );
}

export default WorldLaunch;
