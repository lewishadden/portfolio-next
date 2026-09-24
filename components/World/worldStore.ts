/**
 * Mutable, non-React state shared between the DOM and the WebGL world.
 * DOM listeners write here; useFrame callbacks read every frame, so nothing
 * re-renders React on scroll or pointer move.
 */
export const worldStore = {
  /** Page scroll progress, 0 at the top and 1 at the bottom */
  scroll: 0,
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
};

/** Called by the contact form after a successful send — fires the rocket on /contact */
export function requestLaunch() {
  worldStore.launchRequested = true;
}
