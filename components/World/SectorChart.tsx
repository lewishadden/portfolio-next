'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

import { useWorldPreference } from '@/hooks/useWorldPreference';

import {
  navigableStations,
  stationForPath,
  stationNames,
  stationPaths,
  stationPositions,
} from './routes';
import { onFlight, setPreview, worldStore } from './worldStore';

import type { StationKey } from './routes';

import './SectorChart.scss';

const stationBriefs: Record<StationKey, string> = {
  home: 'Orient yourself at the gateway, meet Lewis and choose your next destination.',
  about: 'Open the crew dossier for background, working approach and recommendations.',
  experience: 'Read the mission logs: roles, teams and the work delivered along the way.',
  projects:
    'Explore the fabrication yard. Inspect project briefs, screenshots and technical stories.',
  skills: 'Visit the research outpost to connect skills with the projects and roles that use them.',
  contact: 'Open a channel at the comms array and send Lewis a message.',
  lost: 'An uncharted signal beyond the main route.',
};

// The same orthographic orientation as the compact radar, without its sway:
// a chart's targets must stay still while someone points, reads or uses a key.
function project(x: number, y: number, z: number): [number, number] {
  const dx = x - 3;
  const dy = y + 1;
  const dz = z + 113;
  const rx = dx * Math.cos(0.62) - dz * Math.sin(0.62);
  const rz = dx * Math.sin(0.62) + dz * Math.cos(0.62);
  return [500 + rx * 2.9, 270 + (rz * Math.sin(0.92) - dy * Math.cos(0.92)) * 2.9];
}

const beacons = navigableStations.map((key) => ({
  key,
  point: project(...stationPositions[key]),
  base: project(stationPositions[key][0], -30, stationPositions[key][2]),
}));
const gridLines = [
  ...Array.from({ length: 5 }, (_, i) => [
    project(-80 + i * 40, -30, -260),
    project(-80 + i * 40, -30, 35),
  ]),
  ...Array.from({ length: 8 }, (_, i) => [
    project(-80, -30, -250 + i * 40),
    project(80, -30, -250 + i * 40),
  ]),
];

let visited: readonly string[] = [];
const noVisits: readonly string[] = [];
const visitListeners = new Set<() => void>();
const subscribeVisits = (listener: () => void) => {
  visitListeners.add(listener);
  return () => {
    visitListeners.delete(listener);
  };
};

function recordVisit(station: string) {
  if (!navigableStations.some((key) => key === station)) return;
  if (!visited.includes(station)) visited = [...visited, station];
  try {
    sessionStorage.setItem('world:visited', JSON.stringify(visited));
  } catch {
    // Storage can be blocked in private browsing.
  }
  visitListeners.forEach((listener) => listener());
}

/** Records route visits; opening the chart itself never marks a destination as visited. */
export function useStationVisits() {
  const pathname = usePathname();
  useEffect(() => {
    let saved: string[] = [];
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem('world:visited') ?? '[]');
      if (Array.isArray(value)) {
        saved = value.filter((key) => navigableStations.some((station) => station === key));
      }
    } catch {
      // Session storage is optional; visits still work in memory.
    }
    visited = [...new Set([...saved, ...visited])];
    recordVisit(stationForPath(pathname));
  }, [pathname]);
  useEffect(
    () =>
      onFlight((event, station) => {
        if (event === 'end') recordVisit(station);
      }),
    []
  );
}

export function SectorChart({
  onTravel,
  onInspect,
}: {
  onTravel: (station: StationKey) => void;
  onInspect: (station: StationKey) => void;
}) {
  const pathname = usePathname();
  const current = stationForPath(pathname);
  const { enabled, supported } = useWorldPreference();
  const worldActive = enabled && supported;
  const [selected, setSelected] = useState<StationKey>(current === 'lost' ? 'home' : current);
  const visitedStations = useSyncExternalStore(
    subscribeVisits,
    () => visited,
    () => noVisits
  );
  const markerRef = useRef<SVGCircleElement>(null);
  const routeRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    setPreview(selected);
    return () => setPreview('');
  }, [selected]);

  useEffect(() => {
    const draw = () => {
      const { camera, flight, previewPath } = worldStore;
      const [x, y] = worldActive
        ? project(camera.x, camera.y, camera.z)
        : project(...stationPositions[current]);
      markerRef.current?.setAttribute('cx', String(Math.max(12, Math.min(988, x))));
      markerRef.current?.setAttribute('cy', String(Math.max(12, Math.min(528, y))));
      const path = flight.active ? flight.path : previewPath;
      const points = [];
      for (let i = 0; i < path.length; i += 3) {
        const [px, py] = project(path[i], path[i + 1], path[i + 2]);
        points.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
      }
      routeRef.current?.setAttribute('d', worldActive ? points.join(' ') : '');
    };
    draw();
    const timer = window.setInterval(draw, 200);
    return () => window.clearInterval(timer);
  }, [current, worldActive]);

  const names = stationNames[selected];
  return (
    <section className="sector-chart" aria-label="Interactive sector chart">
      <p className="sector-chart__hint" id="sector-chart-hint">
        Choose a beacon to plot a course. All six stations are also available as page links.
      </p>
      <div
        className="sector-chart__plot"
        role="group"
        aria-label="Station beacons"
        aria-describedby="sector-chart-hint"
      >
        <svg viewBox="0 0 1000 540" preserveAspectRatio="none" aria-hidden="true">
          <g className="sector-chart__grid">
            {gridLines.map(([a, b], i) => (
              <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            ))}
          </g>
          <g className="sector-chart__stems">
            {beacons.map(({ key, point, base }) => (
              <line key={key} x1={base[0]} y1={base[1]} x2={point[0]} y2={point[1]} />
            ))}
          </g>
          <path ref={routeRef} className="sector-chart__route" />
          <circle ref={markerRef} className="sector-chart__position" r="9" />
        </svg>
        {beacons.map(({ key, point }, index) => (
          <button
            key={key}
            type="button"
            className="sector-chart__beacon"
            style={{ left: `${point[0] / 10}%`, top: `${point[1] / 5.4}%` }}
            aria-pressed={selected === key}
            aria-label={`${stationNames[key].page}, ${stationNames[key].craft}${visitedStations.includes(key) ? ', visited' : ''}${current === key ? ', current page' : ''}`}
            onClick={() => setSelected(key)}
            onFocus={() => setPreview(key)}
            onPointerEnter={() => setPreview(key)}
            onPointerLeave={() => setPreview(selected)}
            onBlur={() => setPreview(selected)}
          >
            <span className="sector-chart__number">{String(index + 1).padStart(2, '0')}</span>
            <span className="sector-chart__name" aria-hidden="true">
              {stationNames[key].page}
            </span>
            {visitedStations.includes(key) && (
              <span className="sector-chart__visited" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="sector-chart__legend">
        ◎ Current position · ✓ Visited · Station height shown by each tether
      </p>
      <div className="sector-chart__brief" aria-live="polite" aria-atomic="true">
        <p className="sector-chart__eyebrow">
          {names.craft} ·{' '}
          {current === selected
            ? 'Current page'
            : visitedStations.includes(selected)
              ? 'Visited'
              : 'Unvisited'}
        </p>
        <h3>{names.page}</h3>
        <p>{stationBriefs[selected]}</p>
      </div>
      <div className="sector-chart__actions">
        <button type="button" className="btn btn--primary" onClick={() => onTravel(selected)}>
          Travel to {names.page}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onInspect(selected)}>
          Inspect {names.page}
        </button>
      </div>
      <nav className="sector-chart__links" aria-label="Station pages">
        {navigableStations.map((key, index) => (
          <a key={key} href={stationPaths[key]} aria-current={current === key ? 'page' : undefined}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')} </span>
            {stationNames[key].page}
          </a>
        ))}
      </nav>
    </section>
  );
}
