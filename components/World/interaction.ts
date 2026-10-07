import { events as pointerEvents } from '@react-three/fiber';

import { worldMode } from './worldMode';

import type { EventManager, RootStore } from '@react-three/fiber';

/* ------------------------------------------------------------------
   Pointer events for the world. The canvas sits behind the page (and
   ignores the pointer), so R3F listens on the document instead and the
   page decides: the world only reacts where there is open space, never
   under text, cards, links or controls. Hovering something interactive
   in 3D flips html[data-world-hover], which the cursor ring reads.
   ------------------------------------------------------------------ */

const content = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  '[role="button"]',
  '[role="dialog"]',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'li',
  'dl',
  'blockquote',
  'figure',
  'img',
  'form',
  '.glass',
  '.btn',
  'header',
  'footer',
  '.page-sweep',
].join(', ');

/** True when the pointer is over empty page (or the page is hidden for explore / tour) */
export function isOpenSpace(target: EventTarget | null) {
  // A locked pointer is steering, and its position is stale
  if (document.pointerLockElement) return false;
  if (!(target instanceof Element)) return true;
  if (worldMode.get().mode !== 'page') return !target.closest('a, button, input, .glass');
  return !target.closest(content);
}

let blocked = false;

export function worldEvents(store: RootStore): EventManager<HTMLElement> {
  const base = pointerEvents(store);
  return {
    ...base,
    // The canvas fills the viewport, so the pointer's client position is its
    // place on the canvas. Done here rather than with the Canvas's
    // `eventPrefix`, which swaps in a compute of its own: that skipped the
    // check for page content, so the world reacted under it all (clicks in
    // the project modal opened the screen behind it again)
    compute(event, state) {
      blocked = !isOpenSpace(event.target);
      state.pointer.set(
        (event.clientX / state.size.width) * 2 - 1,
        -(event.clientY / state.size.height) * 2 + 1
      );
      state.raycaster.setFromCamera(state.pointer, state.camera);
    },
    filter(items, state) {
      if (blocked) return [];
      return base.filter ? base.filter(items, state) : items;
    },
  };
}
