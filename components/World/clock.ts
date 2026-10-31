import { motionLevel } from '@/utils/motion';

import type { Clock } from 'three';

/*
   The world's time, for frame callbacks in the world canvas. R3F's clock
   isn't steady:
   - at the still level the canvas draws on demand, and the clock counts
     the whole wall time between the frames it draws;
   - R3F restarts it at 0 whenever the canvas's frameloop changes.
     CoverPause (WorldCanvas) carries it on across those: a cover, and the
     still level's switches between drawing on demand and every frame
     (entering or leaving free roam, a change of motion level).
   Idle motion runs on `ambientTime()`; timing that answers an event (a
   click's trick, a power-on, a ping, a flight) stays on the clock, with
   its stamps passed through `pastStamp()` should the clock ever go back.
*/

/**
 * A clock time stamped for an event (a click, a power-on, a hail), kept
 * while it lies in the past. One stamped before R3F restarted its clock
 * lies ahead of it: kept, it would read as an event still under way, then
 * play again once the clock caught up. It is forgotten (-Infinity) instead.
 * That only works if the stamp is checked before the clock catches up, so
 * check it every frame, ahead of any early return (a station's range test)
 */
export const pastStamp = (stamp: number, t: number) => (stamp > t ? -Infinity : stamp);

/** The most ambient time moves on in one step (s): a slow frame doesn't lurch */
const maxStep = 0.1;
const ambient = { t: 0, seen: 0 };

/**
 * Ambient time (s): what the world's idle motion runs on (turning rings
 * and craft, bobbing characters, blinking nav lights, drifting shaders,
 * and the sky's twinkling, dust, rocks and shuttles) in place of the
 * clock. It moves on with the clock, at most 0.1s a step, and holds at the
 * still level, where nothing moves on its own: free roam included, where
 * the canvas draws every frame, and wherever it draws on demand, so a
 * frame drawn there to answer a hover or a scroll changes only what it was
 * drawn for, never the whole idle gap's motion at once. It carries on
 * rather than starting again when R3F restarts its clock. Every caller in
 * one frame gets the same time; call it from frame callbacks in the world
 * canvas only (one clock)
 */
export function ambientTime({ clock }: { clock: Clock }) {
  const now = clock.elapsedTime;
  if (now !== ambient.seen) {
    const step = now - ambient.seen;
    ambient.seen = now;
    if (step > 0 && motionLevel() !== 'still') ambient.t += Math.min(step, maxStep);
  }
  return ambient.t;
}
