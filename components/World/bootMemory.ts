/**
 * When the world last finished loading (localStorage, ms). Within
 * `bootMemory` of it everything is in the browser's cache, so ThemeScript
 * skips the loading screen (boot.ts) and the page starts at once. Kept
 * apart from boot.ts, which uses React hooks: the server-rendered
 * ThemeScript reads these.
 */
export const bootMemoryKey = 'world-loaded-at';
export const bootMemory = 30 * 60 * 1000;

/** Notes that the world has loaded, so the next visit soon after skips the screen */
export function rememberLoaded() {
  try {
    localStorage.setItem(bootMemoryKey, String(Date.now()));
  } catch {
    // Storage blocked: the screen shows every time
  }
}
