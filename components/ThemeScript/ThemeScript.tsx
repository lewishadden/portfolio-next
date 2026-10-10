import { bootMemory, bootMemoryKey } from 'components/World/bootMemory';
import { motionStorageKey } from '@/utils/motion';

/** Without the app, when the page shows anyway (ms after it starts) */
const pageFailsafe = 4_000;
/** The same behind the loading screen, which covers the page in the meantime */
const coverFailsafe = 22_000;
/**
 * When the failsafes give up on the app: the loading screen lifts and the
 * world is marked off (BootScreen's own give-up, once the app runs, is 20s)
 */
const appGiveUp = 25_000;

/**
 * Entrance animations render their starting state into the server HTML
 * (Framer's `initial`: opacity 0, offset, blurred) and play once the app
 * has hydrated. These are the ones still waiting: `opacity:0` as React
 * wrote it, or `opacity: 0…` as Framer writes it mid-entrance.
 */
const waiting = (forms: string) => `:is(#main-content, .footer) :is(${forms})`;
const asServed = `[style*='opacity:0;'], [style$='opacity:0']`;
const shown = 'opacity: 1 !important; transform: none !important; filter: none !important;';

// Without JavaScript: shown from the start
const noScriptCss = `<style>${waiting(asServed)} { ${shown} }</style>`;
// The app never started (ThemeScript's failsafe below): shown, and kept shown
// if it starts late, until the first page change
const failsafeCss = `html[data-failsafe] ${waiting(`${asServed}, [style*='opacity: 0']`)} { ${shown} }
html[data-failsafe][data-motion='full'] ${waiting(asServed)} {
  transition: opacity 0.6s ease, transform 0.6s ease, filter 0.6s ease !important;
}`;

/**
 * Runs in <head> before first paint: the theme, the motion level, a saved
 * "3D off" and the loading screen, so none of them flash in after the
 * page. Also the failsafes for a page whose app never starts (a script that
 * 404s after a deploy, a blocker, an old browser), so nothing stays hidden
 * or covered.
 */
export function ThemeScript() {
  const themeScript = `
    (function() {
      var root = document.documentElement;
      // Motion level (utils/motion.ts): the visitor's choice, else the OS
      // setting. Before the rest, so blocked storage can't skip it
      var motion = '';
      try {
        motion = localStorage.getItem('${motionStorageKey}') || '';
      } catch (e) {}
      if (motion !== 'full' && motion !== 'calm' && motion !== 'still') {
        motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'still' : 'full';
      }
      root.setAttribute('data-motion', motion);
      try {
        var theme = localStorage.getItem('theme') ||
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        // Runs in <head>: <body> does not exist yet, so the theme lives on <html>
        root.setAttribute('data-theme', theme);
        // Visitor switched the 3D world off: show the 2D renders from first paint
        var worldOff = localStorage.getItem('world') === 'off';
        if (worldOff) {
          root.setAttribute('data-world', 'off');
        }
        // The 3D world will run (not switched off, WebGL, no Save-Data): pages
        // keep room for it from first paint (html[data-world-expected])
        var saveData = navigator.connection && navigator.connection.saveData;
        var expected = !worldOff && !saveData && typeof WebGLRenderingContext !== 'undefined';
        if (expected) {
          root.setAttribute('data-world-expected', '');
        }
        // It loads now: raise the loading screen (components/BootScreen) until
        // it is ready. Not for crawlers, nor when it loaded within the last
        // ${bootMemory / 60000} minutes (it's all cached)
        var loadedAt = Number(localStorage.getItem('${bootMemoryKey}')) || 0;
        var recent = Date.now() - loadedAt < ${bootMemory};
        if (expected && !recent && !/bot|crawl|spider|slurp/i.test(navigator.userAgent)) {
          root.setAttribute('data-boot', 'loading');
        }
      } catch (e) {}

      // Failsafes, until the app starts (ClientProviders sets html[data-hydrated]):
      // what waits for an entrance shows after a few seconds (html[data-failsafe]),
      // and the loading screen gives up, or lifts when its skip button is pressed.
      // None of that means the app has failed (it may only be slow), so the world
      // is left alone: marking it off closes the world windows and brings in the
      // 2D station renders and still sky, which a late start would then undo.
      // Only a clear failure marks it off: one of the app's scripts failing to
      // load with nothing left to load it again (a chunk that 404s after a
      // deploy, a blocker) or to parse (an old browser that loads the scripts
      // but can't run them), or still no app when the failsafes give up.
      // World sets the real value should the app start after all
      var began = Date.now();
      var running = function() { return root.hasAttribute('data-hydrated'); };
      var reveal = function() {
        if (!running()) root.setAttribute('data-failsafe', '');
      };
      var markOff = function() {
        if (!running() && !root.hasAttribute('data-world')) root.setAttribute('data-world', 'off');
      };
      var lift = function() {
        if (running()) return;
        root.removeAttribute('data-boot');
        reveal();
      };
      var wait = function() {
        if (running()) return;
        if (root.hasAttribute('data-boot') && Date.now() - began < ${coverFailsafe}) {
          return setTimeout(wait, 1000);
        }
        reveal();
      };
      setTimeout(wait, ${pageFailsafe});
      setTimeout(function() {
        if (root.hasAttribute('data-boot')) lift();
        markOff();
      }, ${appGiveUp});
      document.addEventListener('click', function(e) {
        var target = e.target;
        if (target && target.closest && target.closest('.boot__skip')) lift();
      });
      var ours = function(url) { return (url || '').indexOf('/_next/static/') !== -1; };
      var failed = {};
      window.addEventListener('error', function(e) {
        var target = e.target;
        // One that loads but can't be parsed reports a SyntaxError on window
        if (target === window) {
          if (e.error instanceof SyntaxError && ours(e.filename)) markOff();
          return;
        }
        // A script that fails to load fires 'error' on itself, which doesn't
        // bubble: caught on the way down, ahead of the app's own listener.
        // Turbopack's loader retries a chunk the app asked for once (a dropped
        // connection usually comes good), removing the failed <script> in the
        // same dispatch, so only a script still in the page a moment later
        // (one nothing retries: the runtime's own, or one that failed before
        // the app asked for it) or a second failure of the same chunk is final
        if (!target || target.tagName !== 'SCRIPT' || !ours(target.src)) return;
        var chunk = target.src.split(/[?#]/)[0];
        var again = failed[chunk];
        failed[chunk] = true;
        setTimeout(function() {
          if (again || target.isConnected) markOff();
        }, 0);
      }, true);
      var listening = performance.now();
      // Next puts its first chunks' <script> tags ahead of this one, so one can
      // fail before the listener above exists, and error events aren't replayed.
      // Resource timings are (buffered), so a chunk that had failed to load by
      // then is found there, in browsers that report the response's status (0
      // when none arrived: a blocker, a dropped connection; Safari reports
      // none). The loader never retries those: they failed before it was
      // listening. Later failures are the listener's, which knows about
      // retries. Any other failure missed before this script ran (in Safari,
      // or a chunk that can't be parsed) waits for the give-up
      try {
        new PerformanceObserver(function(list, observer) {
          if (running()) return observer.disconnect();
          list.getEntries().forEach(function(entry) {
            var status = entry.responseStatus;
            if (entry.initiatorType === 'script' && ours(entry.name) && entry.responseEnd <= listening
              && typeof status === 'number' && (status === 0 || status >= 400)) {
              markOff();
            }
          });
        }).observe({ type: 'resource', buffered: true });
      } catch (e) {}

      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          document.body.classList.add('theme-ready');
        });
      });
    })();
  `;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} suppressHydrationWarning />
      <style dangerouslySetInnerHTML={{ __html: failsafeCss }} />
      <noscript dangerouslySetInnerHTML={{ __html: noScriptCss }} />
    </>
  );
}
