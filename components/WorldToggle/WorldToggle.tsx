'use client';

import { Icon } from '@iconify/react';

import { useWorldPreference } from '@/hooks/useWorldPreference';

import './WorldToggle.scss';

/**
 * Lets visitors switch the WebGL world off (battery, motion sensitivity,
 * older GPUs) independently of their OS reduced-motion setting. Persisted;
 * pages fall back to the 2D renders of each station.
 */
export const WorldToggle = () => {
  const { enabled, supported, setEnabled } = useWorldPreference();
  const on = enabled && supported;
  const title = !supported
    ? '3D effects are unavailable on this device'
    : on
      ? 'Turn 3D effects off'
      : 'Turn 3D effects on';

  return (
    <button
      type="button"
      className={`world-toggle${on ? '' : ' world-toggle--off'}`}
      onClick={() => setEnabled(!enabled)}
      aria-pressed={on}
      aria-label="3D effects"
      title={title}
      disabled={!supported}
    >
      <Icon
        icon={on ? 'ph:cube-bold' : 'ph:cube-transparent-bold'}
        className="world-toggle__icon"
        aria-hidden="true"
      />
      <span className="world-toggle__slash" aria-hidden="true" />
    </button>
  );
};

export default WorldToggle;
