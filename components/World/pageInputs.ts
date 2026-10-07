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

/**
 * Where the page is being read: which of its sections ([data-world-section])
 * is at the reading line (worldStore.sectionFocus, the camera moves round
 * the station with it), which skills category ([data-world-category]) on
 * /skills, and where the heading block sits on screen. Measured on scroll,
 * resize and route changes, at most once a frame.
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
      measureCopy();
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
      worldStore.sectionFocus = -1;
      worldStore.sectionCount = 0;
      worldStore.skillCategory = '';
      worldStore.copy.left = worldStore.copy.right = 0;
    };
  }, [active, routeKey]);
}

/**
 * A skill tile hovered or focused on /skills ([data-world-target="skill:…"])
 * flares its badge in the constellation (worldStore.skillHover)
 */
export function useSkillHover(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const skillOf = (target: EventTarget | null) => {
      const tile =
        target instanceof Element
          ? target.closest<HTMLElement>('[data-world-target^="skill:"]')
          : null;
      return tile?.dataset.worldTarget?.slice('skill:'.length) ?? '';
    };
    const onEnter = (e: Event) => {
      const skill = skillOf(e.target);
      if (skill) worldStore.skillHover = skill;
    };
    const onLeave = (e: Event) => {
      const skill = skillOf(e.target);
      const next = skillOf((e as FocusEvent | PointerEvent).relatedTarget);
      if (skill && skill !== next && worldStore.skillHover === skill) worldStore.skillHover = '';
    };
    document.addEventListener('pointerover', onEnter, { passive: true });
    document.addEventListener('focusin', onEnter);
    document.addEventListener('pointerout', onLeave, { passive: true });
    document.addEventListener('focusout', onLeave);
    return () => {
      worldStore.skillHover = '';
      document.removeEventListener('pointerover', onEnter);
      document.removeEventListener('focusin', onEnter);
      document.removeEventListener('pointerout', onLeave);
      document.removeEventListener('focusout', onLeave);
    };
  }, [active]);
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
