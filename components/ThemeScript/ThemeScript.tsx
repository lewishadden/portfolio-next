import { bootMemory, bootMemoryKey } from 'components/World/bootMemory';

/** Without the app, when the page shows anyway (ms after it starts) */
const pageFailsafe = 4_000;
/** The same behind the loading screen, which covers the page in the meantime */
const coverFailsafe = 22_000;
/** When the loading screen gives up without the app (React's own gives up at 20s) */
const coverGiveUp = 25_000;

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
@media (prefers-reduced-motion: no-preference) {
  html[data-failsafe] ${waiting(asServed)} {
    transition: opacity 0.6s ease, transform 0.6s ease, filter 0.6s ease !important;
  }
}`;

/**
 * Runs in <head> before first paint: the theme, a saved "3D off" and the
 * loading screen, so none of them flash in after the page. Also the
 * failsafes for a page whose app never starts (a script that 404s after a
 * deploy, a blocker, an old browser), so nothing stays hidden or covered.
 */
export function ThemeScript() {
  const themeScript = `
    (function() {
      var root = document.documentElement;
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
        // The 3D world will load: raise the loading screen (components/BootScreen)
        // until it is ready. Not for crawlers, Save-Data or browsers without WebGL,
        // nor when it loaded within the last ${bootMemory / 60000} minutes (it's all cached)
        var saveData = navigator.connection && navigator.connection.saveData;
        var loadedAt = Number(localStorage.getItem('${bootMemoryKey}')) || 0;
        var recent = Date.now() - loadedAt < ${bootMemory};
        if (!worldOff && !saveData && !recent && typeof WebGLRenderingContext !== 'undefined' &&
            !/bot|crawl|spider|slurp/i.test(navigator.userAgent)) {
          root.setAttribute('data-boot', 'loading');
        }
      } catch (e) {}

      // Failsafes, until the app starts (ClientProviders sets html[data-hydrated]):
      // what waits for an entrance shows after a few seconds (html[data-failsafe]),
      // and the loading screen gives up, or lifts when its skip button is pressed
      var began = Date.now();
      var running = function() { return root.hasAttribute('data-hydrated'); };
      var reveal = function() {
        if (!running()) root.setAttribute('data-failsafe', '');
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
      }, ${coverGiveUp});
      document.addEventListener('click', function(e) {
        var target = e.target;
        if (target && target.closest && target.closest('.boot__skip')) lift();
      });

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
