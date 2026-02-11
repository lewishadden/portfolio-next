export function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        var theme = localStorage.getItem('theme') || 
          (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.body.setAttribute('data-theme', theme);
        document.body.setAttribute('data-bs-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
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
