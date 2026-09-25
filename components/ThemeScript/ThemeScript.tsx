export function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        var theme = localStorage.getItem('theme') || 
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        // Runs in <head>: <body> does not exist yet, so the theme lives on <html>
        document.documentElement.setAttribute('data-theme', theme);
        // Visitor switched the 3D world off: show the 2D renders from first paint
        if (localStorage.getItem('world') === 'off') {
          document.documentElement.setAttribute('data-world', 'off');
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
