import type { StationKey } from './routes';

/**
 * Mutable, non-React state shared between the DOM and the WebGL world.
 * DOM listeners write here; useFrame callbacks read every frame, so nothing
 * re-renders React on scroll or pointer move. Deliberately free of three.js
 * imports: DOM components (radar, page transitions) read it too.
 */
export const worldStore = {
  /** Page scroll progress, 0 at the top and 1 at the bottom */
  scroll: 0,
  /**
   * Which project the /projects page has scrolled to, as a fractional index
   * (2.5 is halfway from the third to the fourth); -1 off that page. The
   * camera rides the helix to it.
   */
  projectFocus: -1,
  /**
   * How far the /projects page still is from its first project: 1 at the
   * top, where the camera holds back on the whole station beside the page
   * head, 0 once the ride down the helix has begun (and off that page)
   */
  projectIntro: 0,
  /**
   * How far the /projects page has scrolled past its last project, in
   * viewport heights (0 until then, and off that page). The camera descends
   * with it, so the last screen leaves with its copy instead of sitting under
   * the page nav and footer
   */
  projectTail: 0,
  /** A project page: its screen sits beside the copy rather than centred */
  projectAside: false,
  /**
   * /experience: which role's card is at the reading line, as a fractional
   * index (-0.6 above the first card, up to count - 0.4 past the last), -1
   * off that page. The camera rides the beam to that role's pod and lights it.
   */
  roleFocus: -1,
  roleCount: 0,
  /** /contact: a message is on its way (the comms array streams it to the globe) */
  transmitting: false,
  /**
   * /contact: until when (performance.now(), ms) the camera holds on the
   * globe and rocket rather than following the page down to the form, so a
   * message's transmission and the launch after it are seen
   */
  showcaseUntil: 0,
  /** Viewport heights scrolled (scrollY / innerHeight) */
  screens: 0,
  /** Pointer position normalised to -1..1 (y up) */
  pointerX: 0,
  pointerY: 0,
  /** Camera speed in world units per second, written by CameraRig */
  velocity: 0,
  /** Clock time (seconds) of the last rocket launch, -1 when idle */
  launchAt: -1,
  /** Set by the contact form so the next frame can stamp launchAt */
  launchRequested: false,
  /** Camera position, heading (radians about Y, 0 = -Z) and unit forward vector, every frame */
  camera: { x: 0, y: 0, z: 60, heading: 0, fx: 0, fy: 0, fz: -1 },
  /**
   * The flight in progress, if any: destination station, progress 0..1 and
   * its path (x, y, z triples). `turn` is which way the camera swings as it
   * leaves: 0 straight ahead, +1 an about-turn to the left, -1 to the right.
   * `approached` turns true on the final approach (when the new page shows).
   * `duration` is the planned flight length in seconds (0 when none);
   * CameraRig's startFlight writes it
   */
  flight: {
    active: false,
    to: '',
    progress: 0,
    path: new Float32Array(0),
    turn: 0,
    approached: false,
    duration: 0,
  },
  /**
   * The station a hovered or focused link leads to ('' for none): the radar
   * plots the route there (`previewPath`, x, y, z triples, planned by
   * CameraRig), its beacon flares and the header half-locks onto the link
   */
  preview: '',
  previewPath: new Float32Array(0),
  /**
   * A jolt for the camera, 0..1, decaying on its own (CameraRig): the
   * rocket's launch, a bump against a hull in free roam
   */
  shake: 0,
  /**
   * Home, /about and /contact: which of the page's sections
   * ([data-world-section]) is at the reading line, as a fractional index
   * (-1 above the first, and off those pages), and how many there are. The
   * camera moves round the station with it rather than leaving it behind
   */
  sectionFocus: -1,
  sectionCount: 0,
  /**
   * /skills: the skill a tile on the page is hovered or focused for ('' for
   * none) and the category whose tiles are being read ('' for none). Its
   * badge flares; that category's constellation lights up
   */
  skillHover: '',
  skillCategory: '',
  /**
   * The page element pointed at or focused that stands for something in the
   * world ('' for none): `skill:<name>`, `role:<i>`, `contact:<name>`,
   * `project:<i>` (anything tagged [data-world-project]), `globe:home` or
   * `about:portrait`. `skillHover` is derived from it
   */
  targetHover: '',
  /**
   * The text blocks the readability guard protects ([data-reading] under
   * #main-content, visible in the viewport, nearest the reading line first,
   * at most 6): `[x0, y0, x1, y1]` per block as viewport fractions 0..1, y down
   */
  readingRects: new Float32Array(24),
  /** 1 where that rect's text is large (≥24px, or ≥18.66px bold): it needs 3:1 rather than 4.5:1 */
  readingLarge: new Uint8Array(6),
  /** How many of `readingRects` are in use, 0..6 */
  readingCount: 0,
  /**
   * NDC x (-1..1) of the right edge of the widest `#main-content .glass`
   * crossing the reading line, so the station can clear it; -1 when none
   */
  clearRight: -1,
  /** /skills: fractional index of the [data-world-category] at the reading line (-1 off /skills) */
  skillFocus: -1,
  /**
   * Phones: the [data-world-window] spacer nearest the reading line (CSS px
   * from the top of the viewport, and its height), where the camera frames
   * the station mid-page; `top` is -1 when there is none
   */
  worldWindow: { top: -1, height: 0 },
  /** CSS px of the helix screen in front on /projects (`on` false when none is) */
  screenRect: { left: 0, top: 0, right: 0, bottom: 0, on: false },
  /** The project gallery's slide on show (content indexes); -1 / -1 when no gallery is open */
  projectShot: { project: -1, image: -1 },
  /** The content image index each helix screen shows (-1 unknown) */
  screenShown: new Int8Array(16).fill(-1),
  /** CSS px of the hovered 3D object's box as projected on screen (`on` false when nothing is) */
  tipBox: { x0: 0, y0: 0, x1: 0, y1: 0, on: false },
  /** Home: the hero's role line as currently displayed (mid-decode included) */
  heroRole: '',
  /** /contact: how much of the message is written, its length over the limit, 0..1 */
  composing: 0,
  /** /contact: a contact form field has focus */
  commsFocus: false,
  /** Free roam: the autopilot's course, x, y, z triples (length 0 when none) */
  autopilotPath: new Float32Array(0),
  /** Free roam: how close the ship is to the world's edge, 0..1 */
  edge: 0,
  /** Stations mid power-on and their charge (absent: fully powered) */
  charge: {} as Partial<Record<StationKey, number>>,
  /**
   * The station the visitor is about to fly to ('' for none): a finger or
   * button down on a link to it, or its page's way on (the page nav)
   * scrolled into view. The world mounts and warms it before the click
   */
  intent: '' as StationKey | '',
  /**
   * The page's heading block on screen (`.page-head__copy`, else the hero
   * copy), -1..1 from the centre with y up; all 0 when there is none. Things
   * that would sit behind it (skill badges) fade out of its way
   */
  copy: { left: 0, right: 0, top: 0, bottom: 0 },
  /**
   * How loudly the header HUD hums, 0..1 (HeaderHud writes it while it is
   * on screen, louder as it swings; components/Sound plays it)
   */
  hudHum: 0,
  /** Station the explorer is close enough to dock with, '' when none */
  dock: '',
  /** Explore mode: the station the autopilot is flying to, '' when flying by hand */
  autopilot: '',
  /** Explore mode: the page being docked at while the docking sequence plays, '' otherwise */
  docking: '',
  /**
   * Explore mode: where each station's beacon is on screen, written every
   * frame for the HUD's waypoints. x / y run -1..1 from the centre (y up);
   * `onScreen` false means x / y only give the direction to turn
   */
  waypoints: {} as Record<string, Waypoint>,
  /** Renderer counters for the stats overlay (written only while it is open) */
  stats: {
    calls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
    geometries: 0,
    textures: 0,
    programs: 0,
    width: 0,
    height: 0,
    dpr: 1,
    station: '',
  },
};

export interface Waypoint {
  x: number;
  y: number;
  onScreen: boolean;
  /** World units from the camera (the HUD calls them km) */
  distance: number;
}

type FlightEvent = 'start' | 'approach' | 'end';
type FlightListener = (event: FlightEvent, to: string) => void;

const flightListeners = new Set<FlightListener>();

/** Camera flights announce their start, their final approach (~60%) and arrival */
export function onFlight(listener: FlightListener) {
  flightListeners.add(listener);
  return () => {
    flightListeners.delete(listener);
  };
}

export function emitFlight(event: FlightEvent, to: string) {
  flightListeners.forEach((listener) => listener(event, to));
}

const previewListeners = new Set<() => void>();

/** Subscribe to the previewed station changing (a link hovered or focused, or let go) */
export function onPreview(listener: () => void) {
  previewListeners.add(listener);
  return () => {
    previewListeners.delete(listener);
  };
}

/** Previews the course to a station ('' to stop): see worldStore.preview */
export function setPreview(station: string) {
  if (worldStore.preview === station) return;
  worldStore.preview = station;
  previewListeners.forEach((listener) => listener());
}

const dockListeners = new Set<() => void>();

/** Explore mode: subscribe to the dockable station changing */
export function onDock(listener: () => void) {
  dockListeners.add(listener);
  return () => {
    dockListeners.delete(listener);
  };
}

export function setDock(station: string) {
  if (worldStore.dock === station) return;
  worldStore.dock = station;
  if (station) emitCue('proximity');
  dockListeners.forEach((listener) => listener());
}

const dockingListeners = new Set<() => void>();

/** Explore mode: subscribe to a docking sequence starting or ending */
export function onDocking(listener: () => void) {
  dockingListeners.add(listener);
  return () => {
    dockingListeners.delete(listener);
  };
}

/** Starts the docking sequence for a page ('' when it is over) */
export function setDocking(path: string) {
  if (worldStore.docking === path) return;
  worldStore.docking = path;
  if (path) emitCue('dock');
  dockingListeners.forEach((listener) => listener());
}

const autopilotListeners = new Set<() => void>();

/** Explore mode: subscribe to the autopilot's destination changing */
export function onAutopilot(listener: () => void) {
  autopilotListeners.add(listener);
  return () => {
    autopilotListeners.delete(listener);
  };
}

/** Sets course for a station ('' hands the controls back) */
export function setAutopilot(station: string) {
  if (worldStore.autopilot === station) return;
  worldStore.autopilot = station;
  emitCue(station ? 'select' : 'blip');
  autopilotListeners.forEach((listener) => listener());
}

/** Called by the contact form after a successful send: fires the rocket on /contact */
export function requestLaunch() {
  worldStore.launchRequested = true;
  worldStore.showcaseUntil = performance.now() + 6500;
  emitCue('launch');
}

/** Called by the contact form while a message is sending */
export function setTransmitting(on: boolean) {
  if (worldStore.transmitting === on) return;
  worldStore.transmitting = on;
  // Hold on the globe a little after a failed send too, so it doesn't jerk away
  worldStore.showcaseUntil = Math.max(worldStore.showcaseUntil, performance.now() + 1800);
  if (on) emitCue('transmit');
}

/* ----------------- Page chrome covering the world ----------------- */

/**
 * Page chrome that covers the whole world: the mobile menu (`menuOpen`,
 * Header) and a full-screen project modal on a phone (`modalCover`). While
 * either is up the world stops drawing
 */
export const chrome = { menuOpen: false, modalCover: false };

const chromeListeners = new Set<() => void>();

/** Reports page chrome opening or closing over the world (only what changed needs passing) */
export function setChrome(next: Partial<{ menuOpen: boolean; modalCover: boolean }>) {
  const changed = (Object.keys(next) as (keyof typeof chrome)[]).some(
    (key) => next[key] !== undefined && next[key] !== chrome[key]
  );
  if (!changed) return;
  Object.assign(chrome, next);
  chromeListeners.forEach((listener) => listener());
}

/** Subscribe to the menu or a covering modal opening or closing */
export function onChrome(listener: () => void) {
  chromeListeners.add(listener);
  return () => {
    chromeListeners.delete(listener);
  };
}

/* ----------------- Showcases: a station shows off ----------------- */

/** Why a station is asked to show off: a tour stop landing, or the visitor hailing it */
export type ShowcaseReason = 'tour' | 'hail';

type ShowcaseListener = (station: StationKey, reason: ShowcaseReason) => void;

const showcaseListeners = new Set<ShowcaseListener>();

/** Asks a station to perform its trick (each station listens for its own key) */
export function showcase(station: StationKey, reason: ShowcaseReason) {
  showcaseListeners.forEach((listener) => listener(station, reason));
}

/** Subscribe to showcases (a station checks the key is its own, and the reason) */
export function onShowcase(listener: ShowcaseListener) {
  showcaseListeners.add(listener);
  return () => {
    showcaseListeners.delete(listener);
  };
}

/* ----------------- Intent: the station the visitor is about to fly to ----------------- */

const intentListeners = new Set<() => void>();

/** Sets worldStore.intent ('' to clear): the world warms that station ahead of the click */
export function setIntent(station: StationKey | '') {
  if (worldStore.intent === station) return;
  worldStore.intent = station;
  intentListeners.forEach((listener) => listener());
}

/** Subscribe to worldStore.intent changing */
export function onIntent(listener: () => void) {
  intentListeners.add(listener);
  return () => {
    intentListeners.delete(listener);
  };
}

/* ----------------- Sound cues (components/Sound plays them when sound is on) ----------------- */

export type Cue =
  | 'blip'
  | 'select'
  | 'proximity'
  | 'dock'
  | 'found'
  | 'complete'
  | 'launch'
  | 'transmit'
  | 'hud-hover'
  | 'hud-click'
  | 'hud-lock'
  | 'hud-boot'
  /** Something in 3D was clicked: the ping ring where it landed */
  | 'ping'
  /** A character or craft does its trick (barrel roll, helmet spin, satellite roll…) */
  | 'trick'
  /** Free roam: the ship bumped a hull */
  | 'bump'
  /** A station powers up as the camera arrives */
  | 'power'
  /** The command palette opened */
  | 'palette'
  /** The theme switched */
  | 'theme'
  /** A detent: the projects ride settles on a screen */
  | 'tick'
  /** The experience timeline reaches another role's pod (strength: the role's index) */
  | 'pod'
  /** Free roam: the signal detector pings the nearest unfound signal */
  | 'sonar'
  /** Free roam: a sonar scan sweeps out from the ship */
  | 'scan'
  /** Arrived at a station without a flight (reduced motion, the world off) */
  | 'arrive'
  /** Free roam: the ship nears the world's edge */
  | 'edge'
  /** The station was hailed and answers */
  | 'hail';

/**
 * Where a cue happens in the world (for spatial sound) and how strong it is
 * (0..1 for most cues; `pod` passes the role's index)
 */
export interface CueDetail {
  at?: readonly [number, number, number];
  strength?: number;
}

type CueListener = (cue: Cue, detail?: CueDetail) => void;

const cueListeners = new Set<CueListener>();

export function onCue(listener: CueListener) {
  cueListeners.add(listener);
  return () => {
    cueListeners.delete(listener);
  };
}

/** Something happened that has a sound; silent unless the visitor turned sound on */
export function emitCue(cue: Cue, detail?: CueDetail) {
  cueListeners.forEach((listener) => listener(cue, detail));
}

/* ----------------- Hovering things in 3D: cursor ring + tooltip ----------------- */

let hovers = 0;

/** Call with true on pointer over, false on out: drives the cursor ring */
export function setWorldHover(on: boolean, kind: 'point' | 'grab' = 'point') {
  hovers = Math.max(0, hovers + (on ? 1 : -1));
  const root = document.documentElement;
  if (hovers > 0) root.dataset.worldHover = kind;
  else delete root.dataset.worldHover;
}

export interface WorldTip {
  label: string;
  sub?: string;
}

let tip: WorldTip | null = null;
const tipListeners = new Set<() => void>();

export const worldTip = {
  get: () => tip,
  set(next: WorldTip | null) {
    tip = next;
    tipListeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    tipListeners.add(listener);
    return () => {
      tipListeners.delete(listener);
    };
  },
};

/** Dispatched when something in 3D that belongs to the page is clicked (see useWorldFocus) */
export const worldFocusEvent = 'world:focus';

/** Brings the page element tagged data-world-target={id} into view and pulses it */
export function focusOnPage(id: string) {
  window.dispatchEvent(new CustomEvent(worldFocusEvent, { detail: id }));
}

/** Dispatched when free roam knocks into a hull (detail: strength, 0..1); the HUD flashes */
export const worldBumpEvent = 'world:bump';

/** Dispatched to navigate from inside the canvas (World handles it with the router) */
export const worldNavigateEvent = 'world:navigate';

export function navigateTo(href: string) {
  window.dispatchEvent(new CustomEvent(worldNavigateEvent, { detail: href }));
}

/** Inputs written by the keyboard, pointer and the touch pad (ExploreControls reads them) */
export const exploreInput = {
  forward: 0,
  strafe: 0,
  lift: 0,
  turn: 0,
  boost: false,
  /** Accumulated look deltas in radians from mouse movement, consumed each frame */
  lookX: 0,
  lookY: 0,
  /**
   * Where the mouse rests, -1..1 from the centre of the screen (y down), or
   * how far the touch look stick is held over; it steers
   */
  steerX: 0,
  steerY: 0,
  /**
   * How far the touch look stick is held over, -1..1 (y down). It turns the
   * view too, more gently than the mouse
   */
  stickX: 0,
  stickY: 0,
};
