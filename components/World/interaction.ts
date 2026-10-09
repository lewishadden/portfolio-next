import { events as pointerEvents } from '@react-three/fiber';

import { worldMode } from './worldMode';

import type { EventManager, RootState, RootStore } from '@react-three/fiber';

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
/**
 * Set while a past pointer event is replayed (refreshPointer): its target
 * is where the pointer was then, so the page is asked what is under it now
 */
let replaying = false;
/** The mouse has left the window: nothing to replay until it is back */
let away = false;

type PointerEventLike = PointerEvent | MouseEvent | WheelEvent;

function targetOf(event: PointerEventLike) {
  return replaying ? document.elementFromPoint(event.clientX, event.clientY) : event.target;
}

const leave = (e: PointerEvent) => {
  if (!e.relatedTarget) away = true;
};
const enter = () => {
  away = false;
};

/**
 * Raycasts again from the last pointer event, as if the mouse had moved
 * where it is: the world moves under a still pointer (the page scrolls and
 * the camera follows), so what it is over changes, and the hover (its
 * cursor ring and tooltip) would otherwise hold on to what was there.
 * Mouse only: a touch has no hover to keep up.
 */
export function refreshPointer(state: RootState) {
  const move = state.events.handlers?.onPointerMove;
  const last = state.internal.lastEvent.current;
  if (!move || !last || away) return;
  if ('pointerType' in last && last.pointerType !== 'mouse') return;
  replaying = true;
  try {
    move(last);
  } finally {
    replaying = false;
  }
}

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
      blocked = !isOpenSpace(targetOf(event));
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
    connect(target) {
      base.connect?.(target);
      document.documentElement.addEventListener('pointerout', leave);
      document.documentElement.addEventListener('pointerover', enter);
    },
    disconnect() {
      base.disconnect?.();
      document.documentElement.removeEventListener('pointerout', leave);
      document.documentElement.removeEventListener('pointerover', enter);
    },
  };
}
