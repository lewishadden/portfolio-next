'use client';

import { Icon } from '@iconify/react';

import { useSound } from './sound';

import 'components/WorldToggle/WorldToggle.scss';

/**
 * Sound on or off (off by default). The click that turns it on is what
 * lets the browser start audio; the choice is remembered (see sound.ts).
 */
export const SoundToggle = () => {
  const { on, setSound } = useSound();
  return (
    <button
      type="button"
      className={`world-toggle${on ? '' : ' world-toggle--off'}`}
      onClick={() => setSound(!on)}
      aria-pressed={on}
      aria-label="Sound"
      title={on ? 'Turn sound off' : 'Turn sound on'}
    >
      <Icon
        icon={on ? 'ph:speaker-high-bold' : 'ph:speaker-simple-x-bold'}
        className="world-toggle__icon"
        aria-hidden="true"
      />
    </button>
  );
};

export default SoundToggle;
