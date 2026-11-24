import { useEffect } from 'react';

import { stationForPath } from './routes';
import { setPreview, worldStore } from './worldStore';

/* ------------------------------------------------------------------
   What the page tells the world, beyond scroll and pointer (World.tsx
   mounts these). DOM-only: nothing here imports three.js.
   ------------------------------------------------------------------ */

/** Share of the viewport's height, from the top, where the page counts as being read */
const readingLine = 0.45;

/** The internal link an event happened on, if any */
const linkOf = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLAnchorElement>('a[href^="/"]') : null;

/**
 * Hovering or focusing a link to another station previews the course there
 * (worldStore.preview): the radar plots the route, the station's beacon
 * flares and the header half-locks onto the link. A short delay keeps a
 * pointer sweeping across the nav from flickering it.
 */
export function useRoutePreview(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const set = (station: string) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPreview(station), station ? 140 : 80);
    };
    const onEnter = (e: Event) => {
      const link = linkOf(e.target);
      if (!link) return;
      const station = stationForPath(new URL(link.href).pathname);
      set(station === stationForPath(window.location.pathname) ? '' : station);
    };
    const onLeave = (e: Event) => {
      const link = linkOf(e.target);
      const next = linkOf((e as FocusEvent | PointerEvent).relatedTarget);
      if (link && link !== next) set('');
    };
    // Setting off clears it: the flight takes over
    const onClick = () => {
      window.clearTimeout(timer);
      setPreview('');
    };
    document.addEventListener('pointerover', onEnter, { passive: true });
    document.addEventListener('focusin', onEnter);
    document.addEventListener('pointerout', onLeave, { passive: true });
    document.addEventListener('focusout', onLeave);
    document.addEventListener('click', onClick, true);
    return () => {
      window.clearTimeout(timer);
      setPreview('');
      document.removeEventListener('pointerover', onEnter);
      document.removeEventListener('focusin', onEnter);
      document.removeEventListener('pointerout', onLeave);
      document.removeEventListener('focusout', onLeave);
      document.removeEventListener('click', onClick, true);
    };
  }, [active]);
}

/**
 * Fractional index of the element at the reading line among `elements`:
 * from -1 (well above them all) rising to 0 as the first reaches the line
 */
function focusAmong(elements: Element[], line: number) {
  if (!elements.length) return -1;
  for (let i = 0; i < elements.length; i++) {
    const { top, bottom } = elements[i].getBoundingClientRect();
    if (line < top) return i === 0 ? Math.max(-1, (line - top) / (window.innerHeight * 0.6)) : i;
    if (line < bottom) return i + (line - top) / Math.max(bottom - top, 1);
  }
  return elements.length - 0.001;
}

/** The page's heading block, -1..1 from the centre of the screen (y up), for things that keep out of its way */
function measureCopy() {
  const copy = worldStore.copy;
  const block = document.querySelector('#main-content .page-head, #main-content .hero__content');
  const rect = block?.getBoundingClientRect();
  if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
    copy.left = copy.right = copy.top = copy.bottom = 0;
    return;
  }
  // Only the text column: the page head spans the page, its copy doesn't
  const text = block!.querySelector('.page-title, .hero__name');
  const right = Math.max(
    text?.getBoundingClientRect().right ?? rect.right,
    ...[...block!.querySelectorAll('.page-sub, .hero__tag')].map(
      (el) => el.getBoundingClientRect().right
    )
  );
  copy.left = (rect.left / window.innerWidth) * 2 - 1;
  copy.right = (Math.min(right, rect.right) / window.innerWidth) * 2 - 1;
  copy.top = 1 - (rect.top / window.innerHeight) * 2;
  copy.bottom = 1 - (rect.bottom / window.innerHeight) * 2;
}

/** The readability guard keeps the world dim behind at most this many text blocks */
const maxReading = 6;
const readingBlocks: { rect: DOMRect; large: boolean; distance: number }[] = [];

/** WCAG's large text: at least 24px, or 18.66px (14pt) bold */
function isLargeText(el: Element) {
  const style = getComputedStyle(el);
  const size = parseFloat(style.fontSize);
  return size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
}

/**
 * The text blocks the readability guard protects ([data-reading]), visible
 * in the viewport, nearest the reading line first, as viewport fractions
 * (worldStore.readingRects / readingLarge / readingCount)
 */
function measureReading(main: HTMLElement, line: number) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  readingBlocks.length = 0;
  for (const el of main.querySelectorAll<HTMLElement>('[data-reading]')) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) continue;
    const distance =
      rect.top > line ? rect.top - line : rect.bottom < line ? line - rect.bottom : 0;
    // Marked large, and really large at this size (phones shrink headings)
    readingBlocks.push({
      rect,
      large: el.dataset.reading === 'large' && isLargeText(el),
      distance,
    });
  }
  readingBlocks.sort((a, b) => a.distance - b.distance);
  const count = Math.min(readingBlocks.length, maxReading);
  const rects = worldStore.readingRects;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  for (let i = 0; i < maxReading; i++) {
    const block = i < count ? readingBlocks[i] : null;
    rects[i * 4] = block ? clamp(block.rect.left / width) : 0;
    rects[i * 4 + 1] = block ? clamp(block.rect.top / height) : 0;
    rects[i * 4 + 2] = block ? clamp(block.rect.right / width) : 0;
    rects[i * 4 + 3] = block ? clamp(block.rect.bottom / height) : 0;
    worldStore.readingLarge[i] = block?.large ? 1 : 0;
  }
  worldStore.readingCount = count;
  readingBlocks.length = 0;
}

/**
 * Glass this close to the reading line (share of the viewport's height)
 * counts as at it: the gaps between a list's cards (3rem at most) are well
 * inside it. Measured at the line alone, every gap dropped the panel, and
 * the station jumped back and out again between each pair of cards. Further
 * off, a panel's pull fades out over `clearFade`, so the station eases in
 * and out at the head and foot of a list instead of stepping
 */
const clearGap = 0.05;
const clearFade = 0.2;

const smoothstep = (x: number, edge0: number, edge1: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * NDC x the station keeps right of (worldStore.clearRight): the right-most
 * edge of the glass panels at the reading line, each drawn in towards -1
 * (none) as it moves away from the line, so the value follows the scroll
 * rather than jumping. -1 for none
 */
function measureClearRight(main: HTMLElement, line: number) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  let right = -1;
  for (const el of main.querySelectorAll('.glass')) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const away =
      (rect.top > line ? rect.top - line : rect.bottom <= line ? line - rect.bottom : 0) / height;
    const pull = 1 - smoothstep(away, clearGap, clearGap + clearFade);
    if (pull > 0) right = Math.max(right, -1 + (rect.right / width) * 2 * pull);
  }
  worldStore.clearRight = right;
}

/** The phone "window" spacer ([data-world-window]) nearest the reading line, in CSS px */
function measureWorldWindow(main: HTMLElement, line: number) {
  const view = worldStore.worldWindow;
  let best = Infinity;
  view.top = -1;
  view.height = 0;
  for (const el of main.querySelectorAll('[data-world-window]')) {
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) continue;
    const distance =
      rect.top > line ? rect.top - line : rect.bottom < line ? line - rect.bottom : 0;
    if (distance >= best) continue;
    best = distance;
    view.top = rect.top;
    view.height = rect.height;
  }
}

/** /projects: the cell the ride's screen in front is framed in (worldStore.screenSlot), in CSS px */
function measureScreenSlot(main: HTMLElement) {
  const slot = worldStore.screenSlot;
  const rect = main.querySelector('.projects__stage .proj-hud__screen')?.getBoundingClientRect();
  slot.on = !!rect && rect.width > 0 && rect.height > 0;
  if (!rect || !slot.on) return;
  slot.left = rect.left;
  slot.top = rect.top;
  slot.right = rect.right;
  slot.bottom = rect.bottom;
}

/** Puts back everything usePageReading measures (route changes, unmount) */
function clearReading() {
  worldStore.sectionFocus = -1;
  worldStore.sectionCount = 0;
  worldStore.skillCategory = '';
  worldStore.skillFocus = -1;
  worldStore.copy.left = worldStore.copy.right = 0;
  worldStore.copy.top = worldStore.copy.bottom = 0;
  worldStore.readingRects.fill(0);
  worldStore.readingLarge.fill(0);
  worldStore.readingCount = 0;
  worldStore.clearRight = -1;
  worldStore.worldWindow.top = -1;
  worldStore.worldWindow.height = 0;
  worldStore.screenSlot.on = false;
}

/**
 * Where the page is being read: which of its sections ([data-world-section])
 * is at the reading line (worldStore.sectionFocus, the camera moves round
 * the station with it), which skills category ([data-world-category]) on
 * /skills, where the heading block sits on screen, the text blocks the
 * readability guard protects ([data-reading]), the glass panels at the
 * reading line, the phone "window" nearest it ([data-world-window]) and
 * the projects ride's screen cell. Measured on scroll, resize and route
 * changes, at most once a frame.
 */
export function usePageReading(active: boolean, routeKey: string) {
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const main = document.getElementById('main-content');
      if (!main) return;
      const line = window.innerHeight * readingLine;
      const sections = [...main.querySelectorAll('[data-world-section]')];
      worldStore.sectionFocus = focusAmong(sections, line);
      worldStore.sectionCount = sections.length;
      const categories = [...main.querySelectorAll<HTMLElement>('[data-world-category]')];
      const reading = categories.find((el) => {
        const { top, bottom } = el.getBoundingClientRect();
        return top <= line && line < bottom;
      });
      worldStore.skillCategory = reading?.dataset.worldCategory ?? '';
      worldStore.skillFocus = focusAmong(categories, line);
      measureCopy();
      measureReading(main, line);
      measureClearRight(main, line);
      measureWorldWindow(main, line);
      measureScreenSlot(main);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // After the new page has laid out (and again once its entrance has played)
    schedule();
    const settle = window.setTimeout(schedule, 1200);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      clearReading();
    };
  }, [active, routeKey]);
}

/** Sets worldStore.targetHover, and the skill hover derived from it */
function setTargetHover(target: string) {
  worldStore.targetHover = target;
  worldStore.skillHover = target.startsWith('skill:') ? target.slice('skill:'.length) : '';
}

/**
 * The page element an event happened in that stands for something in the
 * world: `[data-world-target]` as it is, `[data-world-project="i"]` as
 * `project:i`. Only page content (#main-content): never the outgoing page's
 * still copy, nor the header or menus
 */
function targetOf(node: EventTarget | null) {
  if (!(node instanceof Element)) return '';
  const el = node.closest<HTMLElement>('[data-world-target], [data-world-project]');
  if (!el || !document.getElementById('main-content')?.contains(el)) return '';
  const { worldTarget, worldProject } = el.dataset;
  if (worldTarget) return worldTarget;
  return worldProject ? `project:${worldProject}` : '';
}

/**
 * Pointing at or focusing page content that stands for something in the
 * world (worldStore.targetHover): a skill tile flares its badge in the
 * constellation (worldStore.skillHover), a role's card lights its pod, a
 * project's link its screen
 */
export function useTargetHover(active: boolean, routeKey: string) {
  useEffect(() => {
    if (!active) return;
    const onEnter = (e: Event) => {
      const target = targetOf(e.target);
      if (target) setTargetHover(target);
    };
    const onLeave = (e: Event) => {
      const target = targetOf(e.target);
      const next = targetOf((e as FocusEvent | PointerEvent).relatedTarget);
      if (target && target !== next && worldStore.targetHover === target) setTargetHover('');
    };
    document.addEventListener('pointerover', onEnter, { passive: true });
    document.addEventListener('focusin', onEnter);
    document.addEventListener('pointerout', onLeave, { passive: true });
    document.addEventListener('focusout', onLeave);
    return () => {
      // A new page: what was pointed at has gone without a pointerout
      setTargetHover('');
      document.removeEventListener('pointerover', onEnter);
      document.removeEventListener('focusin', onEnter);
      document.removeEventListener('pointerout', onLeave);
      document.removeEventListener('focusout', onLeave);
    };
  }, [active, routeKey]);
}

type OrientationRequest = { requestPermission?: () => Promise<'granted' | 'denied'> };

/** Remembered once a visitor has answered iOS's motion prompt, so it is never asked twice */
const tiltKey = 'world-tilt';

/**
 * Phones: tilting the phone looks around, the way the mouse does on a
 * desktop (worldStore.pointerX / Y, relative to how it was held when it
 * started), so the parallax, the characters' gaze and the globe's sway work
 * on touch too. iOS asks permission, so there it starts on the first tap on
 * the world itself (open space, not page content) or the free-roam button;
 * elsewhere it starts straight away.
 */
export function useTilt(active: boolean, reducedMotion: boolean) {
  useEffect(() => {
    if (!active || reducedMotion || typeof DeviceOrientationEvent === 'undefined') return;
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    let rest: { beta: number; gamma: number } | null = null;
    let listening = false;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      // Landscape swaps which way is which
      const sideways = Math.abs((screen.orientation?.angle ?? 0) % 180) === 90;
      const beta = sideways ? e.gamma : e.beta;
      const gamma = sideways ? -e.beta : e.gamma;
      rest ??= { beta, gamma };
      // Drift the resting pose slowly, so however it's held becomes neutral
      rest.beta += (beta - rest.beta) * 0.004;
      rest.gamma += (gamma - rest.gamma) * 0.004;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      worldStore.pointerX = clamp((gamma - rest.gamma) / 22);
      worldStore.pointerY = clamp(-(beta - rest.beta) / 22);
    };
    const listen = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('deviceorientation', onTilt);
    };
    const request = (DeviceOrientationEvent as unknown as OrientationRequest).requestPermission;
    let answered: string | null = null;
    try {
      answered = localStorage.getItem(tiltKey);
    } catch {}
    // Granted before, a tap still has to ask again (the answer is instant); denied, never ask
    if (!request) listen();
    else if (answered === 'denied') return;
    const onTap = (e: Event) => {
      if (listening || !request) return;
      const target = e.target instanceof Element ? e.target : null;
      const onWorld = !target?.closest('#main-content, header, footer, [role="dialog"]');
      const onRoam = !!target?.closest('.roam-fab');
      if (!onWorld && !onRoam) return;
      request()
        .then((answer) => {
          try {
            localStorage.setItem(tiltKey, answer);
          } catch {}
          if (answer === 'granted') listen();
        })
        .catch(() => undefined);
    };
    if (request) document.addEventListener('click', onTap);
    return () => {
      document.removeEventListener('click', onTap);
      window.removeEventListener('deviceorientation', onTilt);
      worldStore.pointerX = 0;
      worldStore.pointerY = 0;
    };
  }, [active, reducedMotion]);
}
