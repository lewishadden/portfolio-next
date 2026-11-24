'use client';

/**
 * Last resort, when the root layout itself fails (the app's providers threw
 * while rendering). It replaces the whole document, so it carries its own
 * <html>, <body> and styles: none of the site's CSS, fonts or theme run here.
 */
const css = `
  :root {
    color-scheme: dark light;
    --bg: #05060d;
    --text: #eef0ff;
    --muted: #a6abcc;
    --accent: #a78bfa;
    --on-accent: #05060d;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #eef0f8;
      --text: #0b0d1f;
      --muted: #43476b;
      --accent: #6d28d9;
      --on-accent: #ffffff;
    }
  }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    box-sizing: border-box;
    background: var(--bg);
    color: var(--text);
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    line-height: 1.6;
    text-align: center;
  }
  .global-error { max-width: 32rem; }
  .global-error__title { margin: 0 0 0.75rem; font-size: clamp(1.75rem, 5vw, 2.5rem); line-height: 1.1; }
  .global-error__text { margin: 0 0 1.75rem; color: var(--muted); }
  .global-error__button {
    font: inherit;
    font-weight: 600;
    padding: 0.75rem 1.75rem;
    border: 0;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
  }
  .global-error__button:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
`;

export default function GlobalError() {
  return (
    <html lang="en-GB">
      <head>
        <title>Something went wrong | Lewis Hadden</title>
        <meta name="robots" content="noindex" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <main className="global-error">
          <h1 className="global-error__title">Something went wrong</h1>
          <p className="global-error__text">
            The page hit a problem it couldn&rsquo;t recover from. Reloading usually sorts it out.
          </p>
          <button
            className="global-error__button"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
