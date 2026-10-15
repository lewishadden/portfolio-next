/** Dialogs own world input even before their first control receives focus. */
const ownerSelector = '[data-world-input-owner], [role="dialog"], dialog[open]';
const inactiveSelector = '[hidden], [inert], [aria-hidden="true"]';
const interactiveSelector =
  'button, a[href], input, textarea, select, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="combobox"], [role="slider"], [role="tab"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';

export function isInteractiveTarget(target: EventTarget | null) {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    !!target.closest(interactiveSelector)
  );
}

export function hasWorldInputOwner() {
  if (typeof document === 'undefined') return false;
  return [...document.querySelectorAll(ownerSelector)].some(
    (owner) => !owner.closest(inactiveSelector)
  );
}

/** Shared by flight, docking and reticle inspection shortcuts. */
export function worldKeyOwned(event: KeyboardEvent) {
  return (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    hasWorldInputOwner() ||
    isInteractiveTarget(event.target) ||
    (typeof document !== 'undefined' && isInteractiveTarget(document.activeElement))
  );
}

/** React commits can open a dialog without a keyup or pointerup reaching flight. */
export function onWorldInputOwnerChange(listener: () => void) {
  if (typeof document === 'undefined') return () => {};
  let owned = hasWorldInputOwner();
  const observer = new MutationObserver(() => {
    const next = hasWorldInputOwner();
    if (next === owned) return;
    owned = next;
    listener();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-world-input-owner', 'role', 'open', 'hidden', 'inert', 'aria-hidden'],
  });
  return () => observer.disconnect();
}
