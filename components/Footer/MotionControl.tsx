'use client';

import { useId } from 'react';

import { useMotionPref } from '@/hooks/useMotion';
import { setMotionPref } from '@/utils/motion';

import type { MotionPref } from '@/utils/motion';

const choices: { pref: MotionPref; label: string }[] = [
  { pref: 'system', label: 'System' },
  { pref: 'full', label: 'Full' },
  { pref: 'calm', label: 'Calm' },
  { pref: 'still', label: 'Still' },
];

/**
 * How much the site moves (utils/motion.ts), in the footer's console: a
 * radio group, so it is one tab stop and the arrow keys pick. `System`
 * follows the device's reduced-motion setting. Rendered on the server with
 * `System` chosen; hydration shows the saved choice
 */
export function MotionControl() {
  const pref = useMotionPref();
  const id = useId();

  return (
    <fieldset className="footer__motion" aria-describedby={`${id}-note`}>
      <legend className="footer__col-title">Motion</legend>
      <div className="footer__motion-options">
        {choices.map(({ pref: value, label }) => (
          <label key={value} className="footer__motion-option">
            <input
              type="radio"
              name={`${id}-motion`}
              value={value}
              checked={pref === value}
              onChange={() => setMotionPref(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <p id={`${id}-note`} className="footer__motion-note">
        Calm keeps the 3D world alive but cuts between pages; still holds everything still. System
        follows your device.
      </p>
    </fieldset>
  );
}

export default MotionControl;
