import type { StationKey } from 'components/World/routes';

/**
 * The star map's station links: NavMenu registers them, StarMap places each
 * one over its world every frame. DOM-safe: no three.js
 */
export const starLabels = new Map<StationKey, HTMLElement>();

/**
 * Places a station's link over its world: the world's centre and radius on
 * screen (px), and how near the front of the orbit it is (0 back, 1 front)
 */
export function placeLabel(el: HTMLElement, x: number, y: number, radius: number, near: number) {
  el.style.setProperty('--x', `${x.toFixed(1)}px`);
  el.style.setProperty('--y', `${y.toFixed(1)}px`);
  el.style.setProperty('--d', `${Math.max(radius * 2.4, 48).toFixed(1)}px`);
  el.style.setProperty('--near', near.toFixed(3));
  el.style.zIndex = String(1 + Math.round(near * 10));
  if (!el.hasAttribute('data-placed')) el.setAttribute('data-placed', '');
}
