'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { motionLevel } from '@/utils/motion';

import { worldStore, worldTip } from './worldStore';

const noTip = () => null;

/** Space between the object's box and its brackets, and between the brackets and the tag (px) */
const pad = 6;
const gap = 10;
/** Smallest box the brackets draw, so a far-off object still reads as marked (px) */
const minSide = 28;
/** Keeps the tag this far inside the viewport (px) */
const margin = 8;
/** How stiff the brackets' spring is (1/s): they catch up in about a quarter of a second */
const stiffness = 26;
/** Brackets and tag snap rather than spring after a pause this long (ms) */
const stale = 120;

/** Free roam's reticle aims: how far below the middle of the screen its tag sits (px) */
const underReticle = 58;

/** Free roam with the pointer locked (interaction.ts aims from the reticle then) */
const aimingReticle = () =>
  !!document.pointerLockElement && document.documentElement.dataset.worldMode === 'explore';

/** Corners in order: top left, top right, bottom left, bottom right */
const corners = ['tl', 'tr', 'bl', 'br'] as const;

interface Spring {
  /** Box edges as drawn (x0, y0, x1, y1) and their velocities */
  at: number[];
  speed: number[];
  /** Last frame the box was placed (performance.now()), 0 for never */
  placedAt: number;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** The page's heading block in CSS px (worldStore.copy), while the page is on show; null for none */
function copyRect(width: number, height: number): Rect | null {
  const { left, right, top, bottom } = worldStore.copy;
  if (document.documentElement.dataset.worldMode !== 'page') return null;
  if (left === 0 && right === 0 && top === 0 && bottom === 0) return null;
  return {
    left: ((left + 1) / 2) * width,
    right: ((right + 1) / 2) * width,
    top: ((1 - top) / 2) * height,
    bottom: ((1 - bottom) / 2) * height,
  };
}

/**
 * Where the tag goes: beside the bracketed box (right, else left, else
 * below or above), inside the viewport and clear of the page's heading
 * block, else as near the right of the box as the viewport allows
 */
function placeTag(box: Rect, w: number, h: number, width: number, height: number) {
  const copy = copyRect(width, height);
  const top = Math.min(Math.max(box.top, margin), height - h - margin);
  const left = Math.min(Math.max(box.left, margin), width - w - margin);
  const options: [number, number][] = [
    [box.right + gap, top],
    [box.left - gap - w, top],
    [left, box.bottom + gap],
    [left, box.top - gap - h],
  ];
  for (const [x, y] of options) {
    const rect = { left: x, top: y, right: x + w, bottom: y + h };
    const inside =
      rect.left >= margin &&
      rect.top >= margin &&
      rect.right <= width - margin &&
      rect.bottom <= height - margin;
    if (inside && !(copy && overlaps(rect, copy))) return [x, y];
  }
  return [Math.min(Math.max(options[0][0], margin), width - w - margin), top];
}

/** Eases the drawn box towards the target box (critically damped), or snaps it */
function follow(spring: Spring, target: number[], dt: number, snap: boolean) {
  for (let i = 0; i < 4; i++) {
    if (snap) {
      spring.at[i] = target[i];
      spring.speed[i] = 0;
      continue;
    }
    const offset = spring.at[i] - target[i];
    const accel = -stiffness * stiffness * offset - 2 * stiffness * spring.speed[i];
    spring.speed[i] += accel * dt;
    spring.at[i] += spring.speed[i] * dt;
  }
}

/**
 * The label for whatever interactive thing in 3D is pointed at: four
 * brackets close round the object itself (its box, projected each frame
 * by TipProbe into worldStore.tipBox) and a tag beside it says what it is
 * and what a click does. The brackets spring onto it at full motion and
 * sit in place otherwise. With no box to go on, the tag trails the pointer
 */
export function WorldTooltip() {
  const tip = useSyncExternalStore(worldTip.subscribe, worldTip.get, noTip);
  const rootRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const spring = useRef<Spring>({ at: [0, 0, 0, 0], speed: [0, 0, 0, 0], placedAt: 0 });

  useEffect(() => {
    const root = rootRef.current;
    const tag = tagRef.current;
    if (!tip || !root || !tag) return;
    const brackets = corners.map((key) =>
      root.querySelector<HTMLElement>(`.world-tip__corner--${key}`)
    );
    const state = spring.current;
    const pointer = { x: -1, y: -1 };
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const target = [0, 0, 0, 0];
    let frame = 0;
    let last = performance.now();

    const place = (now: number) => {
      frame = requestAnimationFrame(place);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const tagW = tag.offsetWidth;
      const tagH = tag.offsetHeight;
      const box = worldStore.tipBox;

      if (!box.on) {
        // Nothing to bracket (yet): the tag trails the pointer, as it used to
        root.removeAttribute('data-boxed');
        state.placedAt = 0;
        tag.style.visibility = pointer.x < 0 ? 'hidden' : '';
        const x = Math.min(pointer.x + 18, width - tagW - margin);
        const y = Math.min(pointer.y + 18, height - tagH - margin);
        tag.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        return;
      }
      tag.style.visibility = '';
      root.setAttribute('data-boxed', '');

      // The object's box, padded and never smaller than minSide
      const cx = (box.x0 + box.x1) / 2;
      const cy = (box.y0 + box.y1) / 2;
      const halfW = Math.max(box.x1 - box.x0 + pad * 2, minSide) / 2;
      const halfH = Math.max(box.y1 - box.y0 + pad * 2, minSide) / 2;
      target[0] = cx - halfW;
      target[1] = cy - halfH;
      target[2] = cx + halfW;
      target[3] = cy + halfH;
      const snap = motionLevel() !== 'full' || now - state.placedAt > stale;
      follow(state, target, dt, snap);
      state.placedAt = now;

      const [x0, y0, x1, y1] = state.at;
      const xs = [x0, x1, x0, x1];
      const ys = [y0, y0, y1, y1];
      brackets.forEach((el, i) => {
        if (el) el.style.transform = `translate3d(${xs[i]}px, ${ys[i]}px, 0)`;
      });
      // Free roam with the pointer locked: the reticle aims, and the tag
      // sits under it (and under its hint), where the eye already is
      const [x, y] = aimingReticle()
        ? [(width - tagW) / 2, height / 2 + underReticle]
        : placeTag({ left: x0, top: y0, right: x1, bottom: y1 }, tagW, tagH, width, height);
      tag.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    frame = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={rootRef} className="world-tip" aria-hidden="true">
      {corners.map((key) => (
        <span key={key} className={`world-tip__corner world-tip__corner--${key}`} />
      ))}
      <div ref={tagRef} className="world-tip__tag glass">
        <b>{tip.label}</b>
        {tip.sub && <span>{tip.sub}</span>}
      </div>
    </div>
  );
}
