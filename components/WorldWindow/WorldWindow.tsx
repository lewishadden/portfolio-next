/**
 * A gap in the copy on narrow layouts where the camera brings the page's
 * station back into view as it scrolls past (`[data-world-window]`, measured
 * into worldStore.worldWindow by pageInputs.ts). Shown only when the world
 * will run (`html[data-world-expected]`, not switched off) and the layout is
 * stacked; see `.world-window` in app/page.scss.
 */
export function WorldWindow() {
  return <div className="world-window" data-world-window aria-hidden="true" />;
}

export default WorldWindow;
