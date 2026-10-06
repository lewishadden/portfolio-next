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
  /** The flight in progress, if any: destination station, progress 0..1 and its path (x, y, z triples) */
  flight: { active: false, to: '', progress: 0, path: new Float32Array(0) },
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

/* ----------------- Sound cues (components/Sound plays them when sound is on) ----------------- */

export type Cue =
  | 'blip'
  | 'select'
  | 'proximity'
  | 'dock'
  | 'found'
  | 'complete'
  | 'launch'
  | 'transmit';

const cueListeners = new Set<(cue: Cue) => void>();

export function onCue(listener: (cue: Cue) => void) {
  cueListeners.add(listener);
  return () => {
    cueListeners.delete(listener);
  };
}

/** Something happened that has a sound; silent unless the visitor turned sound on */
export function emitCue(cue: Cue) {
  cueListeners.forEach((listener) => listener(cue));
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
  /** Accumulated look deltas in radians from touch drags, consumed each frame */
  lookX: 0,
  lookY: 0,
  /** Where the mouse rests, -1..1 from the centre of the screen (y down); it steers */
  steerX: 0,
  steerY: 0,
};
