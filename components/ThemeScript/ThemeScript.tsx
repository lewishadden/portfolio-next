import { bootMemory, bootMemoryKey } from 'components/World/bootMemory';

export function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        var theme = localStorage.getItem('theme') || 
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        // Runs in <head>: <body> does not exist yet, so the theme lives on <html>
        document.documentElement.setAttribute('data-theme', theme);
        // Visitor switched the 3D world off: show the 2D renders from first paint
        var worldOff = localStorage.getItem('world') === 'off';
        if (worldOff) {
          document.documentElement.setAttribute('data-world', 'off');
        }
        // The 3D world will load: raise the loading screen (components/BootScreen)
        // until it is ready. Not for crawlers, Save-Data or browsers without WebGL,
        // nor when it loaded within the last ${bootMemory / 60000} minutes (it's all cached)
        var saveData = navigator.connection && navigator.connection.saveData;
        var loadedAt = Number(localStorage.getItem('${bootMemoryKey}')) || 0;
        var recent = Date.now() - loadedAt < ${bootMemory};
        if (!worldOff && !saveData && !recent && typeof WebGLRenderingContext !== 'undefined' &&
            !/bot|crawl|spider|slurp/i.test(navigator.userAgent)) {
          document.documentElement.setAttribute('data-boot', 'loading');
        }
      } catch (e) {}
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          document.body.classList.add('theme-ready');
        });
      });
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: themeScript }} suppressHydrationWarning />;
}
