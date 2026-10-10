'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { navigableStations, stationNames } from './routes';
import { contactMarks, contactName, useFoundSignals, useScan } from './signalStore';
import { onAutopilot, setAutopilot, worldStore } from './worldStore';

import type { Signal } from './signalStore';

/**
 * Clear space the edge markers keep from the top, bottom and sides of the
 * screen at the least. They keep further from the HUD where it reaches
 * further in (hudLimits): the head (top bar, coach, scan line), and the
 * dock prompt or autopilot status at the bottom
 */
const inset = { top: 92, bottom: 112, side: 56 };
/** Room a marker's label needs before the next one along: across, and down */
const room = { x: 150, y: 46 };
/**
 * From one row of markers along the top or bottom to the next, inwards: a
 * mark's label hangs on one side of it and its arrow pokes out the other,
 * so the next row's arrows clear this row's labels
 */
const rowStep = 84;
/**
 * An edge marker's arrow pokes this far past its mark (16px out, half its
 * 14px box), its label hanging on the other side: the mark keeps this far
 * from a HUD panel, plus a little air
 */
const arrowReach = 28;
/** Labels pinned along the top or bottom: the least gap between two, and from the screen's side */
const labelGap = 10;
const labelMargin = 8;
/** How far a pinned marker's label sits from its mark, towards the middle (World.scss, .waypoint--edge) */
const labelReach = 34;
/** Short screens (World.scss's short-screen rule): the markers keep to the top, not under the HUD's head */
const shortScreen = 500;

const noCourse = () => '';
const readCourse = () => worldStore.autopilot;

/** The station the autopilot is flying to, '' when flying by hand */
export function useAutopilot() {
  return useSyncExternalStore(onAutopilot, readCourse, noCourse);
}

/** Room an edge marker keeps from the sector map: above and below it, and its label to its right */
const mapRoom = { y: 26, left: 16, label: 150 };

/** Every how many frames the markers look again for the sector map */
const mapEvery = 10;

/** The sector map's box while it shows over free roam (NavRadar), or null */
function mapBox() {
  const map = document.querySelector<HTMLElement>('.nav-radar--on:not(.nav-radar--clear)');
  if (!map || getComputedStyle(map).visibility === 'hidden') return null;
  return map.getBoundingClientRect();
}

/** A HUD panel's box, or null when it isn't showing */
function boxOf(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return box.width > 0 && box.height > 0 ? box : null;
}

/**
 * How far in from the top and bottom of the screen the edge markers stay
 * (CSS px): clear of the HUD's head (the top bar, wrapping to two rows on
 * a phone, and the coach, scan line and, on a phone, the dock prompt under
 * it) where a marker would sit under it, and of the dock prompt or the
 * autopilot status at the bottom (the ones sitting there, not those in the
 * head), so neither hides a marker's mark, arrow or label nor takes its clicks
 */
interface HudLimits {
  head: DOMRect | null;
  bottom: number;
  /** The screen's height */
  height: number;
}

function hudLimits(h: number, out: HudLimits) {
  out.head = boxOf('.explore-hud__head');
  out.height = h;
  const panel = boxOf('.explore-hud > .explore-hud__dock, .explore-hud > .explore-hud__autopilot');
  out.bottom = panel ? Math.max(inset.bottom, h - panel.top + arrowReach) : inset.bottom;
  return out;
}

/**
 * The top edge for a marker at `x` (and its label, `span` either side of
 * `labelX`, hanging under it): under the head where the head reaches over
 * either. Not on a short screen (a phone on its side), where the head and
 * the dock prompt in it reach down to the middle: under them the markers
 * would crowd the middle of the view and the buttons at the bottom
 */
function topAt(x: number, limits: HudLimits, labelX = x, span = 0) {
  const { head } = limits;
  if (!head || limits.height <= shortScreen) return inset.top;
  const clear = (from: number, to: number) => to < head.left || from > head.right;
  if (clear(x - arrowReach, x + arrowReach) && clear(labelX - span, labelX + span)) {
    return inset.top;
  }
  return Math.max(inset.top, head.bottom + arrowReach);
}

/**
 * An edge marker that would sit on the sector map moves off it: along its
 * edge, past the map's end (above or below it on a side, beside it on the
 * top or bottom), so the map never hides it
 */
function clearOfMap(edge: string, x: number, y: number, map: DOMRect | null, w: number, h: number) {
  if (!edge || !map) return [x, y];
  const over =
    x > map.left - mapRoom.left &&
    x < map.right + mapRoom.left &&
    y > map.top - mapRoom.y &&
    y < map.bottom + mapRoom.y;
  // Its label runs to the right of the mark
  const labelOver = x + mapRoom.label > map.left && x < map.right && y > map.top && y < map.bottom;
  if (!over && !labelOver) return [x, y];
  if (edge === 'side') {
    return [x, map.top > h / 2 ? map.top - mapRoom.y : map.bottom + mapRoom.y];
  }
  return [map.left < w / 2 ? map.right + mapRoom.left : map.left - mapRoom.label, y];
}

/** Where a marker's station or contact is on screen this frame (see worldStore.waypoints) */
function markOf(marker: HTMLElement) {
  const { station, signal } = marker.dataset;
  if (station) return worldStore.waypoints[station];
  return signal ? contactMarks[signal as Signal['id']] : undefined;
}

/** How present a marker is by its distance: stations fade as you arrive, contacts as they are found */
function presenceOf(marker: HTMLElement, distance: number) {
  const [near, span] = marker.dataset.signal ? [8, 12] : [16, 18];
  return Math.min(Math.max((distance - near) / span, 0), 1);
}

/**
 * Free roam's waypoints: every station marked where it is on screen, with
 * its distance, or pinned to the edge with an arrow pointing the way to
 * turn when it is off screen or behind. Markers fade out as you arrive
 * (the station and the dock prompt take over). Clicking one (or pressing
 * its number) sets the autopilot for it. The contacts sonar scans have
 * picked out (not yet found) are marked the same way in amber, and their
 * markers set course for them ('signal:<id>', which parks a little short).
 * Markers riding the edge keep off the sector map and the HUD's panels,
 * and line up along it rather than pile up. Positioned every frame
 * from worldStore.waypoints and contactMarks, which the canvas writes;
 * React only renders them when the contacts change.
 */
export function Waypoints() {
  const listRef = useRef<HTMLOListElement>(null);
  const contactsRef = useRef<HTMLOListElement>(null);
  const course = useAutopilot();
  const { scanned } = useScan();
  const found = useFoundSignals();
  const contacts = scanned.filter((id) => !found.includes(id));
  const contactKey = contacts.join(' ');

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const markers = [list, contactsRef.current].flatMap((ol) =>
      ol ? [...ol.querySelectorAll<HTMLElement>('[data-station], [data-signal]')] : []
    );
    const distances = markers.map((marker) => marker.querySelector<HTMLElement>('[data-km]'));
    const shown = markers.map(() => '');
    let frame = 0;

    let frames = 0;
    let map: DOMRect | null = null;
    const limits: HudLimits = { head: null, bottom: inset.bottom, height: 0 };
    const labels = markers.map((marker) => marker.querySelector<HTMLElement>('.waypoint__text'));
    const widths = markers.map(() => 0);
    const heights = markers.map(() => 0);
    const turns = markers.map(() => 0);
    const xs = markers.map(() => 0);
    const ys = markers.map(() => 0);
    const edges = markers.map(() => '');
    const live = markers.map(() => false);
    const row: number[] = [];

    /** Along the way to turn (`dx`, `dy`), out to the frame round the screen: x, y and which edge */
    const pin = (dx: number, dy: number, w: number, h: number, top: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const reachX = dx ? (dx > 0 ? cx - inset.side : inset.side - cx) / dx : Infinity;
      const reachY = dy ? (dy > 0 ? h - limits.bottom - cy : top - cy) / dy : Infinity;
      const reach = Math.max(0, Math.min(reachX, reachY));
      return [cx + dx * reach, cy + dy * reach, reachX <= reachY ? 1 : 0];
    };

    /**
     * Where a pinned marker's label sits from its mark: across to its
     * centre, and down to its top (keep in step with .waypoint--edge
     * .waypoint__text in World.scss)
     */
    const labelDx = (i: number) => -Math.cos(turns[i]) * (labelReach + widths[i] / 2);
    const labelDy = (i: number) => -15 - Math.sin(turns[i]) * labelReach;

    /**
     * The markers pinned along one edge (top or bottom), left to right,
     * spaced by their labels' widths, every mark kept inside the frame and
     * every label on screen; what doesn't fit goes on another row, inwards
     */
    const lineUp = (ids: number[], w: number, h: number, top: boolean) => {
      if (!ids.length) return;
      const half = (i: number) => (widths[i] || room.x) / 2;
      // Worked in terms of where each label's centre is
      for (const i of ids) xs[i] += labelDx(i);
      ids.sort((a, b) => xs[a] - xs[b]);
      let start = 0;
      for (let line = 0; start < ids.length; line++) {
        const y = top ? 0 : h - limits.bottom - line * rowStep;
        // Along the bottom, right of the sector map where it sits at that height
        const from =
          !top && map && map.left < w / 2 && y > map.top - mapRoom.y && y < map.bottom + mapRoom.y
            ? map.right + mapRoom.left
            : labelMargin;
        // Fill the row while the labels fit side by side
        row.length = 0;
        let used = 0;
        for (let k = start; k < ids.length; k++) {
          const need = half(ids[k]) * 2 + (row.length ? labelGap : 0);
          if (row.length && used + need > w - labelMargin - from) break;
          row.push(ids[k]);
          used += need;
        }
        start += row.length;
        // How far each label's centre can go: on screen, its mark in the frame
        const lowest = (i: number) => Math.max(from + half(i), inset.side + labelDx(i));
        const highest = (i: number) =>
          Math.min(w - labelMargin - half(i), w - inset.side + labelDx(i));
        // Pushed apart left to right, then back in from the right
        for (let k = 0; k < row.length; k++) {
          const i = row[k];
          const least = k ? xs[row[k - 1]] + half(row[k - 1]) + labelGap + half(i) : -Infinity;
          xs[i] = Math.max(xs[i], least, lowest(i));
        }
        for (let k = row.length - 1; k >= 0; k--) {
          const i = row[k];
          const most =
            k < row.length - 1 ? xs[row[k + 1]] - half(row[k + 1]) - labelGap - half(i) : Infinity;
          xs[i] = Math.max(Math.min(xs[i], most, highest(i)), lowest(i));
        }
        for (const i of row) xs[i] -= labelDx(i);
        const topY =
          Math.max(...row.map((i) => topAt(xs[i], limits, xs[i] + labelDx(i), half(i)))) +
          line * rowStep;
        for (const i of row) ys[i] = top ? topY : y;
      }
    };

    /**
     * The markers pinned up one side, top to bottom, spaced so their labels
     * don't overlap (overlapping evenly only when there isn't room), between
     * the HUD's head and the dock prompt or autopilot status (hudLimits),
     * clear of the sector map and of the rows along the top and bottom
     */
    const stackUp = (ids: number[], w: number, h: number, right: boolean) => {
      if (!ids.length) return;
      const x = right ? w - inset.side : inset.side;
      let top = topAt(x, limits);
      let bottom = h - limits.bottom;
      // Above or below the sector map, where it sits on this side
      if (map && x > map.left - mapRoom.left && x < map.right + mapRoom.left) {
        if (map.top > h / 2) bottom = Math.min(bottom, map.top - mapRoom.y);
        else top = Math.max(top, map.bottom + mapRoom.y);
      }
      // Below (or above) a row along the top (or bottom) that reaches this corner
      markers.forEach((_, i) => {
        if (!live[i] || edges[i] !== 'end' || Math.abs(xs[i] - x) > room.x) return;
        if (Math.sin(turns[i]) < 0) top = Math.max(top, ys[i] + room.y);
        else bottom = Math.min(bottom, ys[i] - room.y);
      });
      bottom = Math.max(top, bottom);
      // Worked in terms of where each label's top is
      for (const i of ids) ys[i] += labelDy(i);
      ids.sort((a, b) => ys[a] - ys[b]);
      ids.forEach((i, k) => {
        const below = k ? ys[ids[k - 1]] + heights[ids[k - 1]] + labelGap / 2 : -Infinity;
        ys[i] = Math.max(ys[i], below, top + labelDy(i));
      });
      for (let k = ids.length - 1; k >= 0; k--) {
        const i = ids[k];
        const above = k < ids.length - 1 ? ys[ids[k + 1]] - heights[i] - labelGap / 2 : Infinity;
        ys[i] = Math.min(ys[i], above, bottom + labelDy(i));
      }
      for (const i of ids) ys[i] = Math.max(ys[i] - labelDy(i), top);
    };

    const place = () => {
      frame = requestAnimationFrame(place);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cy = h / 2;
      // Read before anything is written this frame, every few frames (they
      // only move when they show, hide, change or the window resizes)
      if (frames++ % mapEvery === 0) {
        map = mapBox();
        hudLimits(h, limits);
        labels.forEach((label, i) => {
          widths[i] = label?.offsetWidth ?? 0;
          heights[i] = label?.offsetHeight || room.y - labelGap;
        });
      }
      const focused = document.activeElement;
      markers.forEach((marker, i) => {
        const waypoint = markOf(marker);
        live[i] = false;
        if (!waypoint) {
          marker.style.opacity = '0';
          return;
        }
        if (waypoint.onScreen) {
          xs[i] = ((waypoint.x + 1) / 2) * w;
          ys[i] = ((1 - waypoint.y) / 2) * h;
          edges[i] = '';
        } else {
          // Along the way to turn, out to the frame round the screen (in
          // further at the top where the HUD's head is over it)
          const dx = waypoint.x;
          const dy = -waypoint.y;
          let [x, y, side] = pin(dx, dy, w, h, inset.top);
          // (Not when the head reaches down near the middle, the coach under
          // it on a phone: the row lines up under it all the same, lineUp)
          const under = topAt(x, limits);
          if (dy < 0 && y < under && under < cy - room.y) {
            [x, y, side] = pin(dx, dy, w, h, under);
          }
          edges[i] = side ? 'side' : 'end';
          [xs[i], ys[i]] = clearOfMap(edges[i], x, y, map, w, h);
          turns[i] = Math.atan2(dy, dx);
          marker.style.setProperty('--turn', `${turns[i]}rad`);
        }
        marker.classList.toggle('waypoint--edge', !waypoint.onScreen);
        // Fade out on arrival: the station fills the view by then. Not while
        // it has keyboard focus (Enter on it set the course, and keeps it
        // there to dock): faded, the focused control would be invisible
        const presence =
          marker === focused && marker.matches(':focus-visible')
            ? 1
            : presenceOf(marker, waypoint.distance);
        live[i] = presence > 0.05;
        marker.style.opacity = presence.toFixed(2);
        marker.style.pointerEvents = presence > 0.3 ? '' : 'none';
        const km = `${Math.round(waypoint.distance)} km`;
        if (km !== shown[i] && distances[i]) {
          distances[i].textContent = km;
          shown[i] = km;
        }
      });

      // Markers that land on top of each other spread apart: along the top
      // and bottom by their labels' widths (a second row taking what doesn't
      // fit), and up or down a side, they line up; on screen they move
      // apart up and down (only the one on screen, if the other is pinned)
      const ends = markers.map((_, i) => i).filter((i) => live[i] && edges[i] === 'end');
      lineUp(
        ends.filter((i) => Math.sin(turns[i]) < 0),
        w,
        h,
        true
      );
      lineUp(
        ends.filter((i) => Math.sin(turns[i]) >= 0),
        w,
        h,
        false
      );

      const sides = markers.map((_, i) => i).filter((i) => live[i] && edges[i] === 'side');
      stackUp(
        sides.filter((i) => xs[i] < w / 2),
        w,
        h,
        false
      );
      stackUp(
        sides.filter((i) => xs[i] >= w / 2),
        w,
        h,
        true
      );
      for (let pass = 0; pass < 4; pass++) {
        for (let a = 0; a < markers.length; a++) {
          for (let b = a + 1; b < markers.length; b++) {
            if (!live[a] || !live[b] || (edges[a] && edges[b])) continue;
            const dx = xs[b] - xs[a];
            const dy = ys[b] - ys[a];
            if (Math.abs(dx) >= room.x || Math.abs(dy) >= room.y) continue;
            const push = room.y - Math.abs(dy);
            const sign = dy === 0 ? 1 : Math.sign(dy);
            if (edges[a]) ys[b] += push * sign;
            else if (edges[b]) ys[a] -= push * sign;
            else {
              ys[a] -= (push / 2) * sign;
              ys[b] += (push / 2) * sign;
            }
          }
        }
      }

      markers.forEach((marker, i) => {
        if (!markOf(marker)) return;
        // Lined up along their edge already (lineUp, stackUp)
        const lined = !!edges[i] && live[i];
        const [x, y] = clearOfMap(
          edges[i],
          edges[i] && !lined ? Math.min(Math.max(xs[i], inset.side), w - inset.side) : xs[i],
          edges[i] && !lined
            ? Math.min(Math.max(ys[i], topAt(xs[i], limits)), h - limits.bottom)
            : ys[i],
          map,
          w,
          h
        );
        marker.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      });
    };
    frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [contactKey]);

  return (
    <>
      <ol ref={listRef} className="explore-hud__waypoints" aria-label="Stations">
        {navigableStations.map((key, i) => {
          const { page, craft } = stationNames[key];
          const active = course === key;
          return (
            <li key={key}>
              <button
                type="button"
                data-station={key}
                className={active ? 'waypoint waypoint--course' : 'waypoint'}
                aria-pressed={active}
                aria-label={`Autopilot to ${page}, the ${craft.toLowerCase()}`}
                onClick={() => setAutopilot(active ? '' : key)}
              >
                <span className="waypoint__arrow" aria-hidden="true" />
                <span className="waypoint__mark" aria-hidden="true" />
                <span className="waypoint__text" aria-hidden="true">
                  <span className="waypoint__name">
                    <kbd>{i}</kbd>
                    {page}
                  </span>
                  <span className="waypoint__km" data-km="" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {contacts.length > 0 && (
        <ol ref={contactsRef} className="explore-hud__waypoints" aria-label="Contacts">
          {contacts.map((id) => {
            const target = `signal:${id}`;
            const active = course === target;
            const name = contactName(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  data-signal={id}
                  className={`waypoint waypoint--contact${active ? ' waypoint--course' : ''}`}
                  aria-pressed={active}
                  aria-label={`Autopilot to ${name}, picked out by a scan`}
                  onClick={() => setAutopilot(active ? '' : target)}
                >
                  <span className="waypoint__arrow" aria-hidden="true" />
                  <span className="waypoint__mark" aria-hidden="true" />
                  <span className="waypoint__text" aria-hidden="true">
                    <span className="waypoint__name">{name}</span>
                    <span className="waypoint__km" data-km="" />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
