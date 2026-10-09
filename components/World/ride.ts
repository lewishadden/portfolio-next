/**
 * The projects ride's plain maths and the page's links to the helix (no
 * three.js): DOM code such as the projects page's HUD, detents and gallery
 * can use it without the 3D bundle.
 */

import { worldStore } from './worldStore';

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

/**
 * Dispatched on window when the project gallery changes slide
 * (worldStore.projectShot): the world, which may be rendering on demand,
 * draws a frame so the screen can follow
 */
export const projectShotEvent = 'world:project-shot';

/** Records the project gallery's slide on show (content indexes; -1, -1 for none) and tells the world */
export function showProjectShot(project: number, image: number) {
  const shot = worldStore.projectShot;
  if (shot.project === project && shot.image === image) return;
  shot.project = project;
  shot.image = image;
  window.dispatchEvent(new Event(projectShotEvent));
}

/**
 * The slide a project's gallery opens on: the shot its helix screen is
 * showing (worldStore.screenShown), so the screen and the gallery show the
 * same thing; the first when that isn't known or isn't one of its shots
 */
export function screenSlide(project: number, count: number) {
  const shown =
    project >= 0 && project < worldStore.screenShown.length ? worldStore.screenShown[project] : -1;
  return shown >= 0 && shown < count ? shown : 0;
}
