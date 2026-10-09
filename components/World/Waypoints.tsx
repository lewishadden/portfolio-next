'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { navigableStations, stationNames } from './routes';
import { contactMarks, contactName, useFoundSignals, useScan } from './signalStore';
import { onAutopilot, setAutopilot, worldStore } from './worldStore';

import type { Signal } from './signalStore';

/** Clear space the edge markers keep from the HUD bar (top), dock prompt (bottom) and sides */
const inset = { top: 92, bottom: 112, side: 56 };
/** Room a marker's label needs before the next one along: across, and down */
const room = { x: 150, y: 46 };

const noCourse = () => '';
const readCourse = () => worldStore.autopilot;

/** The station the autopilot is flying to, '' when flying by hand */
export function useAutopilot() {
  return useSyncExternalStore(onAutopilot, readCourse, noCourse);
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
 * Positioned every frame from worldStore.waypoints and contactMarks, which
 * the canvas writes; React only renders them when the contacts change.
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

    const xs = markers.map(() => 0);
    const ys = markers.map(() => 0);
    const edges = markers.map(() => '');
    const live = markers.map(() => false);

    const place = () => {
      frame = requestAnimationFrame(place);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
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
          // Along the way to turn, out to the inset frame round the screen
          const dx = waypoint.x;
          const dy = -waypoint.y;
          const reachX = dx ? (dx > 0 ? cx - inset.side : inset.side - cx) / dx : Infinity;
          const reachY = dy ? (dy > 0 ? h - inset.bottom - cy : inset.top - cy) / dy : Infinity;
          const reach = Math.max(0, Math.min(reachX, reachY));
          xs[i] = cx + dx * reach;
          ys[i] = cy + dy * reach;
          edges[i] = reachX <= reachY ? 'side' : 'end';
          marker.style.setProperty('--turn', `${Math.atan2(dy, dx)}rad`);
        }
        marker.classList.toggle('waypoint--edge', !waypoint.onScreen);
        // Fade out on arrival: the station fills the view by then
        const presence = presenceOf(marker, waypoint.distance);
        live[i] = presence > 0.05;
        marker.style.opacity = presence.toFixed(2);
        marker.style.pointerEvents = presence > 0.3 ? '' : 'none';
        const km = `${Math.round(waypoint.distance)} km`;
        if (km !== shown[i] && distances[i]) {
          distances[i].textContent = km;
          shown[i] = km;
        }
      });

      // Markers that land on top of each other spread apart: along their
      // edge when pinned to one, downwards when on screen
      for (let pass = 0; pass < 4; pass++) {
        for (let a = 0; a < markers.length; a++) {
          for (let b = a + 1; b < markers.length; b++) {
            if (!live[a] || !live[b]) continue;
            const dx = xs[b] - xs[a];
            const dy = ys[b] - ys[a];
            if (Math.abs(dx) >= room.x || Math.abs(dy) >= room.y) continue;
            if (edges[a] === 'end' && edges[b] === 'end') {
              const push = (room.x - Math.abs(dx)) / 2;
              const sign = dx === 0 ? 1 : Math.sign(dx);
              xs[a] -= push * sign;
              xs[b] += push * sign;
            } else {
              const push = (room.y - Math.abs(dy)) / 2;
              const sign = dy === 0 ? 1 : Math.sign(dy);
              ys[a] -= push * sign;
              ys[b] += push * sign;
            }
          }
        }
      }

      markers.forEach((marker, i) => {
        if (!markOf(marker)) return;
        const x = edges[i] ? Math.min(Math.max(xs[i], inset.side), w - inset.side) : xs[i];
        const y = edges[i] ? Math.min(Math.max(ys[i], inset.top), h - inset.bottom) : ys[i];
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
