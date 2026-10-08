'use client';

import { useEffect, useRef, useCallback } from 'react';

const focusableSelectors = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'summary:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const activeTraps: HTMLElement[] = [];
const inactiveSelector = '[inert], [hidden], [aria-hidden="true"]';

/** Only the most recently opened interface may handle modal keyboard input. */
export function isTopFocusTrap(container: Element | null) {
  const top = activeTraps.findLast(
    (element) => element.isConnected && !element.closest(inactiveSelector)
  );
  return !!container && top === container;
}

/**
 * Traps keyboard focus within a container element when active.
 * Returns a ref to attach to the container element.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter(
      (el) =>
        !el.closest(inactiveSelector) && !el.hasAttribute('disabled') && el.offsetParent !== null
    );
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;
    activeTraps.push(container);

    // Store the previously focused element to restore later
    previousFocusRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented || !isTopFocusTrap(container)) return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      const focusIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const isOutsideFocusables = focusIndex === -1;

      if (e.shiftKey) {
        if (isOutsideFocusables || document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (isOutsideFocusables || document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // React may already have detached this container before passive cleanup.
      const wasTop = activeTraps.at(-1) === container;
      const index = activeTraps.lastIndexOf(container);
      if (index >= 0) activeTraps.splice(index, 1);
      // Hand focus back to whatever opened the trap, without scrolling to it —
      // removing an underlying dialog must not take focus from the top one.
      const previous = previousFocusRef.current;
      const next = activeTraps.findLast(
        (element) => element.isConnected && !element.closest(inactiveSelector)
      );
      if (
        wasTop &&
        previous?.isConnected &&
        !previous.closest(inactiveSelector) &&
        (!next || next.contains(previous))
      )
        previous.focus({ preventScroll: true });
    };
  }, [active, getFocusableElements]);

  return containerRef;
}
