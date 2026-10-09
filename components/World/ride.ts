/**
 * The projects ride's plain maths (no three.js): DOM code such as the
 * projects page's HUD and detents can use it without the 3D bundle.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The projects page runs through its projects as a fractional index; this
 * settles it on each one: the middle 60% of the way from one screen to the
 * next carries the move, the rest holds still on the nearer screen
 */
export function settleFocus(focus: number) {
  const whole = Math.floor(focus);
  const x = clamp01((focus - whole - 0.2) / 0.6);
  return whole + x * x * x * (x * (x * 6 - 15) + 10);
}
