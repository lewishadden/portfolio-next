import { events as pointerEvents } from '@react-three/fiber';

import { worldMode } from './worldMode';
import { clearWorldHover } from './worldStore';

import type { EventManager, RootState, RootStore } from '@react-three/fiber';

/* ------------------------------------------------------------------
   Pointer events for the world. The canvas sits behind the page (and
   ignores the pointer), so R3F listens on the document instead and the
   page decides: the world only reacts where there is open space, never
   under text, cards, links or controls. Hovering something interactive
   in 3D flips html[data-world-hover], which the cursor ring reads.

   In free roam with the pointer locked, the reticle in the middle of the
   screen is the pointer: ExploreControls looks again every few frames
   as the ship flies (raycasting no further than `reach`), and E clicks
   whatever the reticle is on (clickTarget).
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

/** Free roam with the pointer locked: the reticle at the centre of the screen aims */
export const aimingReticle = () =>
  !!document.pointerLockElement && worldMode.get().mode === 'explore';

/** True when the pointer is over empty page (or the page is hidden for explore / tour) */
export function isOpenSpace(target: EventTarget | null) {
  // A locked pointer is steering: in free roam the reticle aims instead,
  // anywhere else its position is stale
  if (document.pointerLockElement) return aimingReticle();
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

/** A stand-in pointer event at (x, y), for looking or clicking with no real one to hand */
function syntheticEvent(type: string, x: number, y: number) {
  const noop = () => undefined;
  return {
    type,
    target: document.body,
    clientX: x,
    clientY: y,
    offsetX: x,
    offsetY: y,
    button: 0,
    buttons: 0,
    pointerType: 'mouse',
    preventDefault: noop,
    stopPropagation: noop,
  } as unknown as MouseEvent;
}

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
  if (!move) return;
  const reticle = aimingReticle();
  // The reticle needs no real event (free roam started from the keyboard)
  const last =
    state.internal.lastEvent.current ??
    (reticle ? syntheticEvent('pointermove', state.size.width / 2, state.size.height / 2) : null);
  if (!last || (away && !reticle)) return;
  if (!reticle && 'pointerType' in last && last.pointerType !== 'mouse') return;
  // Over page content with nothing hovered there is nothing to find or let
  // go of: R3F would raycast every hoverable object only to drop the hits
  if (
    !reticle &&
    !state.internal.hovered.size &&
    !isOpenSpace(document.elementFromPoint(last.clientX, last.clientY))
  ) {
    return;
  }
  replaying = true;
  const before = state.internal.lastEvent.current;
  try {
    move(last);
  } finally {
    replaying = false;
    // R3F keeps what it handles as its last event; a stand-in must not
    // outlive this look, or later ones (a page scroll) replay it as a
    // pointer resting at the centre of the screen
    state.internal.lastEvent.current = before;
  }
}

/** Records a press on what is hovered, at (x, y), as R3F does on pointerdown */
function pressHovered(internal: RootState['internal'], x: number, y: number) {
  internal.initialClick = [x, y];
  internal.initialHits = [...internal.hovered.values()].map((hit) => hit.eventObject);
}

/**
 * Clicks what the world has under the pointer (in free roam with the
 * pointer locked, under the reticle) as a click there would: R3F runs the
 * object's onClick with a real hit, so it pings where it lands. Only
 * click: a press as well would start the contact globe's drag, which
 * nothing would end. False when nothing is hovered
 */
export function clickTarget(state: RootState) {
  const click = state.events.handlers?.onClick;
  const { internal, size } = state;
  if (!click || !internal.hovered.size) return false;
  const last = internal.lastEvent.current;
  const centred = aimingReticle() || !last;
  const x = centred ? size.width / 2 : last.clientX;
  const y = centred ? size.height / 2 : last.clientY;
  pressHovered(internal, x, y);
  replaying = true;
  try {
    click(syntheticEvent('click', x, y));
  } finally {
    replaying = false;
    // The stand-in click isn't where the pointer is (see refreshPointer)
    internal.lastEvent.current = last;
  }
  return true;
}

/** Lets go of whatever is hovered (its tooltip and cursor ring go), as the pointer leaving does */
export function releaseHover(state: RootState) {
  state.events.handlers?.onPointerLeave?.(syntheticEvent('pointerleave', 0, 0));
  // Every hover has ended: the cursor ring's count can't be left raised by
  // a handler whose over and out didn't pair
  clearWorldHover();
}

/** A real mouse event refreshPointer can replay: not a touch or pen, nor a click made from the keyboard */
function fromMouse(event: PointerEventLike) {
  if ('pointerType' in event && event.pointerType !== 'mouse') return false;
  // A keyboard click has no position (a mouse click counts at least one press)
  return !(event.type === 'click' && event.detail === 0);
}

/**
 * The reticle has stopped aiming but free roam goes on (Esc freed the
 * mouse). With a real mouse event to hand, refreshPointer looks again from
 * where the mouse is. Without one (free roam started from the keyboard:
 * no event yet, or the key's click on the Free roam button) nothing would
 * look again, and what the reticle was on would stay hovered, its brackets
 * following it as the ship flies on, until the mouse moved
 */
export function reticleFreed(state: RootState) {
  const last = state.internal.lastEvent.current;
  if (!last || !fromMouse(last)) releaseHover(state);
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
      if (aimingReticle()) {
        blocked = false;
        state.pointer.set(0, 0);
      } else {
        blocked = !isOpenSpace(targetOf(event));
        state.pointer.set(
          (event.clientX / state.size.width) * 2 - 1,
          -(event.clientY / state.size.height) * 2 + 1
        );
      }
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
