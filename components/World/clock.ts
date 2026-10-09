/*
   The world's time, for frame callbacks in the world canvas. R3F's clock
   restarts at 0 whenever the canvas's frameloop changes. CoverPause
   (WorldCanvas) carries it across a cover, but nothing carries it across
   the still level's switches between drawing on demand and every frame:
   entering or leaving free roam, or a change of motion level.
*/

/**
 * A clock time stamped for an event (a click, a power-on, a hail), kept
 * while it lies in the past. One stamped before R3F restarted its clock
 * lies ahead of it: kept, it would read as an event still under way, then
 * play again once the clock caught up. It is forgotten (-Infinity) instead
 */
export const pastStamp = (stamp: number, t: number) => (stamp > t ? -Infinity : stamp);
