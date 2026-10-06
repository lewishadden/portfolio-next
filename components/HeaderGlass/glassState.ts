/* What the glass slab's scene (GlassSlab, three.js) reads from the header's
   HTML each frame, written by HeaderGlass. DOM-safe: no three.js */

/** A box in the bar, from its top left corner (CSS px): x, y, width, height */
export type Box = [number, number, number, number];

export interface GlassState {
  /** The bar's size (CSS px) */
  width: number;
  height: number;
  /** The links, then the buttons; null where hidden (links on narrow screens) */
  boxes: (Box | null)[];
  /** How many of `boxes` are links (the plasma only goes to links) */
  links: number;
  /** The current page's link, and what's pointed at or focused; -1 for none */
  active: number;
  hover: number;
  /** The pointer over the bar (CSS px from its left), for the lights */
  pointer: { x: number; over: boolean };
  /** Bumped when the bar's size changes, so the slab is rebuilt */
  version: number;
  /** The header is out of sight (tour, free roam, the loading screen): draw nothing */
  away: boolean;
  /** Set by the scene: asks for a frame (it draws on demand) */
  invalidate: () => void;
}

export const createGlassState = (): GlassState => ({
  width: 0,
  height: 0,
  boxes: [],
  links: 0,
  active: -1,
  hover: -1,
  pointer: { x: 0, over: false },
  version: 0,
  away: false,
  invalidate: () => {},
});

/** The scene hands over how to ask it for a frame */
export function setInvalidate(state: GlassState, invalidate: () => void) {
  state.invalidate = invalidate;
}

/** Room round the bar for the slab's glow and sparks (CSS px; keep in step with HeaderGlass.scss) */
export const glassMargin = 28;
