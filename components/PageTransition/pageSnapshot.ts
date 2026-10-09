import { stationForPath } from '@/components/World/routes';
import { worldMode } from '@/components/World/worldMode';
import { onFlight, worldStore } from '@/components/World/worldStore';
import { motionLevel } from '@/utils/motion';

import type { StationKey } from '@/components/World/routes';

/* ------------------------------------------------------------------
   The page you leave goes with momentum. When something is about to fly
   the camera to another station (a link, Back / Forward, the command
   palette, a click in 3D), a still copy of the page on screen is taken
   and held out of sight. When the route changes it shows where the old
   page was, over the new one (hidden until the camera's approach), and
   leaves the way the camera does: rushing past on a flight ahead,
   swinging off to the side on an about-turn. DOM only, no three.js: it
   ships with the page bundle.
   ------------------------------------------------------------------ */

/** How long a snapshot waits for its navigation before it is dropped (ms) */
const keepFor = 3000;
/** How long the snapshot waits for the camera to set off before leaving anyway (ms) */
const waitForFlight = 250;

/** Attributes page code looks things up by: a copy must never be found instead */
const lookupAttribute = /^(id|name|form|autofocus|data-world.*)$/;

/** Flying ahead: the copy rushes past the camera, drifting down as it climbs away */
const rush: Keyframe[] = [
  { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', filter: 'blur(0px)' },
  { opacity: 0.85, offset: 0.4 },
  { opacity: 0, transform: 'translate3d(0, 3vh, 0) scale(1.15)', filter: 'blur(12px)' },
];
const rushTiming: KeyframeAnimationOptions = {
  duration: 700,
  easing: 'cubic-bezier(0.5, 0, 0.75, 0.35)',
  fill: 'forwards',
};

/**
 * An about-turn: the copy slides off the opposite way to the camera's swing
 * (it swings left, the copy goes right), turning away in perspective
 */
const swing = (side: number): Keyframe[] => [
  {
    opacity: 1,
    transform: 'perspective(1400px) translate3d(0, 0, 0) rotateY(0deg)',
    filter: 'blur(0px)',
  },
  { opacity: 0.8, offset: 0.45 },
  {
    opacity: 0,
    transform: `perspective(1400px) translate3d(${side * 45}vw, 0, 0) rotateY(${side * -20}deg)`,
    filter: 'blur(10px)',
  },
];
const swingTiming: KeyframeAnimationOptions = {
  duration: 900,
  easing: 'cubic-bezier(0.45, 0, 0.7, 0.4)',
  fill: 'forwards',
};

interface Snapshot {
  root: HTMLElement;
  timer: number;
}

/** Taken, waiting for its route change */
let pending: Snapshot | null = null;
/** The station of the page on screen (kept by releaseSnapshot) */
let shown: StationKey | null = null;
/** The station whose page's copy is held back for the camera (PageTransition), if any */
let waiting: StationKey | null = null;

/**
 * PageTransition holds the new page's copy until the camera flying to
 * `station` is on approach (null: it shows, or never waited)
 */
export function holdCopy(station: StationKey | null) {
  waiting = station;
}

/**
 * The station a flight must be going to for the copy to be waiting on it:
 * World lifts the veil for such a flight (a cruise), as there is no copy
 * on screen to keep legible
 */
export const copyHeldFor = () => waiting;

/** The 3D world is on screen, in any mode */
export const worldOnScreen = () =>
  document.documentElement.dataset.world === 'on' && !!document.querySelector('.world--ready');

/**
 * The 3D world is on screen and following the page, which is showing: not
 * hidden for the tour or free roam, nor while the camera comes back from
 * them (html[data-world-mode='returning'])
 */
export const worldIsLive = () =>
  worldOnScreen() &&
  worldMode.get().mode === 'page' &&
  document.documentElement.dataset.worldMode === 'page';

function drop() {
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pending.root.remove();
  pending = null;
}

/** Sets a canvas to a still of a canvas or video, if it can be read */
function drawStill(canvas: HTMLCanvasElement, source: CanvasImageSource | undefined) {
  try {
    if (source) canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  } catch {
    // A lost or unready source: the copy stays blank
  }
}

/** Nothing in the copy reloads, plays or can be found in place of the page's own */
function stillCopy(source: Element, copy: Element) {
  for (const el of copy.querySelectorAll('*')) {
    for (const { name } of [...el.attributes]) {
      if (lookupAttribute.test(name)) el.removeAttribute(name);
    }
  }
  const canvases = source.querySelectorAll('canvas');
  copy.querySelectorAll('canvas').forEach((canvas, i) => drawStill(canvas, canvases[i]));
  const videos = source.querySelectorAll('video');
  copy.querySelectorAll('video').forEach((video, i) => {
    const still = document.createElement('canvas');
    still.className = video.className;
    still.style.cssText = video.style.cssText;
    still.width = videos[i]?.videoWidth || 1;
    still.height = videos[i]?.videoHeight || 1;
    drawStill(still, videos[i]);
    video.replaceWith(still);
  });
  copy.querySelectorAll('iframe, object, embed, audio, script').forEach((el) => {
    const blank = document.createElement('div');
    blank.className = el.getAttribute('class') ?? '';
    el.replaceWith(blank);
  });
}

const animatedProperties = (effect: KeyframeEffect) =>
  effect
    .getKeyframes()
    .flatMap((keyframe) => Object.keys(keyframe))
    .filter((key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key));

/**
 * The copy holds the frame on screen: values mid-animation (Framer's, CSS
 * transitions) are written onto it, and its CSS animations, which would
 * start over, are paused where the original's had got to. `source` and
 * `copy` list the two trees' elements in the same order.
 */
function freeze(part: Element, copyPart: Element, source: Element[], copy: Element[]) {
  if (typeof part.getAnimations !== 'function') return;
  const sourceIndex = new Map(source.map((el, i) => [el, i]));
  const copyIndex = new Map(copy.map((el, i) => [el, i]));
  const times = new Map<string, number>();
  const key = (i: number, effect: KeyframeEffect, name: string) =>
    `${i}|${effect.pseudoElement ?? ''}|${name}`;

  for (const animation of part.getAnimations({ subtree: true })) {
    const effect = animation.effect;
    if (!(effect instanceof KeyframeEffect) || !effect.target) continue;
    const i = sourceIndex.get(effect.target);
    if (i === undefined) continue;
    if (animation instanceof CSSAnimation) {
      times.set(key(i, effect, animation.animationName), Number(animation.currentTime ?? 0));
    } else if (!effect.pseudoElement) {
      const from = getComputedStyle(effect.target);
      const to = (copy[i] as Element & ElementCSSInlineStyle).style;
      for (const property of animatedProperties(effect)) {
        const name = property.startsWith('--')
          ? property
          : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        to.setProperty(name, from.getPropertyValue(name));
      }
    }
  }

  for (const animation of copyPart.getAnimations({ subtree: true })) {
    const effect = animation.effect;
    if (!(animation instanceof CSSAnimation) || !(effect instanceof KeyframeEffect)) continue;
    const i = effect.target ? copyIndex.get(effect.target) : undefined;
    const time = i === undefined ? undefined : times.get(key(i, effect, animation.animationName));
    // Finished (and not filling) on the page: nothing to show
    if (time === undefined) {
      animation.cancel();
    } else {
      animation.currentTime = time;
      animation.pause();
    }
  }
}

/**
 * Takes a still copy of the page on screen, held out of sight until the
 * route changes (`releaseSnapshot`); dropped if no navigation follows. Only
 * when the camera is going to fly: the world is live, motion is welcome and
 * `href` (when given) is another station. Never while the tour or free roam
 * hides the page: the copy has no id, so the rule hiding #main-content
 * wouldn't hide it, and the hidden page would flash up as it left. Link
 * clicks and Back / Forward are caught by `watchNavigation`; call this just
 * before navigating in code.
 */
export function snapshotPage(href?: string) {
  if (!worldIsLive() || motionLevel() !== 'full') return;
  if (href) {
    const url = new URL(href, window.location.href);
    const here = shown ?? stationForPath(window.location.pathname);
    if (url.origin !== window.location.origin || stationForPath(url.pathname) === here) return;
  }
  const parts = [document.getElementById('main-content'), document.querySelector('.footer')]
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight);
  if (!parts.length) return;
  drop();

  const root = document.createElement('div');
  root.className = 'page-ghost';
  root.setAttribute('aria-hidden', 'true');
  root.inert = true;
  const copies = parts.map(({ el, rect }) => {
    // A <div>, not a second <main>, styled as the original by its class
    const copy = document.createElement('div');
    copy.className = `${el.className} page-ghost__part`.trim();
    copy.style.cssText = `position:absolute;margin:0;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px`;
    copy.append(...[...el.childNodes].map((node) => node.cloneNode(true)));
    const source = [...el.querySelectorAll('*')];
    const copied = [...copy.querySelectorAll('*')];
    stillCopy(el, copy);
    root.append(copy);
    return { el, copy, source, copied };
  });
  document.body.append(root);
  try {
    for (const { el, copy, source, copied } of copies) freeze(el, copy, source, copied);
  } catch {
    // Animations play from the start in the copy: a little livelier, still fine
  }

  const snapshot: Snapshot = {
    root,
    timer: window.setTimeout(() => {
      if (pending === snapshot) drop();
    }, keepFor),
  };
  pending = snapshot;
}

/** Plays the copy's exit, then removes it (one still on its way out finishes in its own time) */
function leave(root: HTMLElement, turn: number) {
  const side = Math.sign(turn);
  const done = () => root.remove();
  root
    .animate(side ? swing(side) : rush, side ? swingTiming : rushTiming)
    .finished.then(done, done);
}

/**
 * The route changed (PageTransition, before paint): with a flight on its way
 * the snapshot shows in the old page's place and leaves with the camera, as
 * soon as its plan says which way it turns; without one it is dropped
 */
export function releaseSnapshot(station: StationKey, flight: boolean) {
  shown = station;
  const snapshot = pending;
  pending = null;
  if (!snapshot) return;
  window.clearTimeout(snapshot.timer);
  const { root } = snapshot;
  if (!flight) {
    root.remove();
    return;
  }
  root.dataset.shown = '';

  let gone = false;
  // Which way the camera turns, once it has set off (no flight after all: ahead)
  const go = (flying: boolean) => {
    if (gone) return;
    gone = true;
    stop();
    window.clearTimeout(timer);
    leave(root, flying ? worldStore.flight.turn : 0);
  };
  // The camera plans its flight on its next frame: read the turn once that frame has run
  const stop = onFlight((event, to) => {
    if (event === 'start' && to === station) queueMicrotask(() => go(true));
  });
  const timer = window.setTimeout(() => go(false), waitForFlight);
  if (worldStore.flight.active && worldStore.flight.to === station) go(true);
}

/**
 * Snapshots the page for the ways off it that don't go through code: a
 * plain click on a link to another page, and Back / Forward. Returns the
 * cleanup.
 */
export function watchNavigation() {
  const onClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) return;
    if (link.target && link.target !== '_self') return;
    if (link.origin !== window.location.origin || link.pathname === window.location.pathname) {
      return;
    }
    snapshotPage(link.href);
  };
  // The address has already changed; the page on screen has not
  const onPopState = () => {
    if (stationForPath(window.location.pathname) !== shown) snapshotPage();
  };
  // Capture, on the window: before the link's own handler starts the navigation
  window.addEventListener('click', onClick, true);
  window.addEventListener('popstate', onPopState);
  return () => {
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('popstate', onPopState);
  };
}
