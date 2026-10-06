'use client';

import { useEffect, useId, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { stationForPath } from 'components/World/routes';
import { worldMode } from 'components/World/worldMode';
import { worldStore } from 'components/World/worldStore';

import {
  backArc,
  barRadius,
  cutWidth,
  frontArc,
  letterH,
  letterL,
  markBounds,
  markHeight,
  markWidth,
  moonPoint,
  orbitPath,
  ring,
  ringWidth,
  stationSlots,
} from './markGeometry';

import './BrandMark.scss';

/** Ghost moons behind the moon when it moves fast (a flight, free roam) */
const ghosts = 4;
/** Frames of history between ghosts */
const ghostSpacing = 3;
/** How long a hover lap takes (ms) */
const lapTime = 1100;

const tilt = `rotate(${ring.tilt} ${ring.cx} ${ring.cy})`;
const smootherstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** The same angle, brought within half a turn of `near` */
const near = (angle: number, to: number) =>
  to + ((((angle - to + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

function Bars({ letter }: { letter: typeof letterL }) {
  return (
    <>
      {letter.map(([x, y, width, height]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} rx={barRadius} />
      ))}
    </>
  );
}

/** The moon and its ghosts, drawn in both halves of the ring (each clipped to its half) */
function Moons({ at, orbit, filter }: { at: number; orbit: boolean; filter: string }) {
  const point = moonPoint(at);
  if (orbit) {
    return (
      <g filter={filter}>
        <circle className="brand-mark__moon" r="3.4">
          <animateMotion dur="7s" repeatCount="indefinite" path={orbitPath} />
        </circle>
      </g>
    );
  }
  return (
    <g filter={filter}>
      {Array.from({ length: ghosts }, (_, i) => (
        <circle
          key={i}
          className="brand-mark__ghost"
          data-moon={ghosts - i}
          cx={point.x}
          cy={point.y}
          r={3.4 - (ghosts - i) * 0.5}
          opacity={0}
        />
      ))}
      <circle className="brand-mark__moon" data-moon={0} cx={point.x} cy={point.y} r="3.4" />
    </g>
  );
}

/**
 * The LH orbital monogram (geometry in brandMark.ts). Live, it follows the
 * world: the moon rests at the station you're docked at (Home at the ring's
 * left end, the rest along its front), sweeps round to the next one during
 * a camera flight with a trail of ghosts, circles freely in free roam (as
 * fast as you fly) and slips behind the L on the way. A hover sends it on a
 * lap. `orbit` (the loading screen) just circles, declaratively, so it moves
 * before the page has hydrated. Still for reduced motion.
 */
export function BrandMark({
  className = '',
  orbit = false,
}: {
  className?: string;
  orbit?: boolean;
}) {
  const id = useId().replace(/[^\w-]/g, '');
  const station = stationForPath(usePathname());
  const svgRef = useRef<SVGSVGElement>(null);
  const lapRef = useRef(-1);
  const at = stationSlots[station] ?? stationSlots.home;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || orbit) return;
    const layers = Array.from({ length: ghosts + 1 }, (_, k) => [
      ...svg.querySelectorAll<SVGCircleElement>(`[data-moon="${k}"]`),
    ]);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const root = document.documentElement;
    const history: number[] = [];
    let angle = stationSlots[stationForPath(window.location.pathname)] ?? stationSlots.home;
    let from = angle;
    let flying = false;
    let last = performance.now();
    let frame = 0;

    const place = (circles: SVGCircleElement[], a: number) => {
      const { x, y } = moonPoint(a);
      for (const circle of circles) {
        circle.setAttribute('cx', x.toFixed(2));
        circle.setAttribute('cy', y.toFixed(2));
      }
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const worldOn = root.dataset.world === 'on';
      const { mode } = worldMode.get();
      const { flight } = worldStore;
      const docked = worldOn && flight.to ? flight.to : stationForPath(window.location.pathname);
      const target = stationSlots[docked] ?? stationSlots.home;

      if (worldOn && mode === 'explore') {
        // Free roam: round and round, faster as you fly faster
        angle -= (0.6 + Math.min(worldStore.velocity / 25, 3.5)) * dt;
        flying = false;
      } else if (worldOn && flight.active && !reduce.matches) {
        // A flight: from wherever it was to the destination's place, in step
        if (!flying) from = near(angle, target);
        flying = true;
        angle = from + (target - from) * smootherstep(flight.progress);
      } else {
        flying = false;
        angle = reduce.matches ? target : near(angle, target);
        angle += (target - angle) * (1 - Math.exp(-4 * dt));
      }

      let shown = angle;
      if (lapRef.current >= 0) {
        const p = (now - lapRef.current) / lapTime;
        if (p >= 1) lapRef.current = -1;
        else shown -= Math.PI * 2 * smootherstep(p);
      }
      if (!reduce.matches && !flying && mode !== 'explore') shown += 0.04 * Math.sin(now / 900);

      history.unshift(shown);
      history.length = Math.min(history.length, ghosts * ghostSpacing + 1);
      place(layers[0], shown);
      for (let k = 1; k <= ghosts; k++) {
        const past = history[Math.min(k * ghostSpacing, history.length - 1)];
        place(layers[k], past);
        const opacity = Math.min(Math.abs(shown - past) * 3, 1) * (1 - k / (ghosts + 1)) * 0.7;
        for (const circle of layers[k]) circle.setAttribute('opacity', opacity.toFixed(2));
      }
      svg.classList.toggle('brand-mark--lost', docked === 'lost');
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [orbit]);

  const lap = () => {
    if (orbit || lapRef.current >= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lapRef.current = performance.now();
  };

  const filter = `url(#${id}-glow)`;
  return (
    <svg
      ref={svgRef}
      className={`brand-mark ${className}`}
      viewBox={`${markBounds.x} ${markBounds.y} ${markBounds.width} ${markBounds.height}`}
      aria-hidden="true"
      focusable="false"
      onPointerEnter={lap}
    >
      <defs>
        <linearGradient
          id={`${id}-letters`}
          gradientUnits="userSpaceOnUse"
          x1="14"
          y1="12"
          x2="58"
          y2="42"
        >
          <stop offset="0" className="brand-mark__violet" />
          <stop offset="1" className="brand-mark__cyan" />
        </linearGradient>
        <linearGradient
          id={`${id}-ring`}
          gradientUnits="userSpaceOnUse"
          x1={ring.cx - ring.rx}
          y1="0"
          x2={ring.cx + ring.rx}
          y2="0"
        >
          <stop offset="0" className="brand-mark__cyan" />
          <stop offset="1" className="brand-mark__violet" />
        </linearGradient>
        {/* The ring's near half cuts a gap where it crosses the H */}
        <mask
          id={`${id}-cut`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={markWidth}
          height={markHeight}
        >
          <rect width={markWidth} height={markHeight} fill="#fff" />
          <path d={frontArc} transform={tilt} fill="none" stroke="#000" strokeWidth={cutWidth} />
        </mask>
        {/* Each half of the ring's frame: the moon is drawn in both, each clipped to its half */}
        <clipPath id={`${id}-far`}>
          <rect x={-20} y={-40} width={markWidth + 40} height={ring.cy + 40} />
        </clipPath>
        <clipPath id={`${id}-near`}>
          <rect x={-20} y={ring.cy} width={markWidth + 40} height={60} />
        </clipPath>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform={tilt}>
        <path className="brand-mark__ring brand-mark__ring--far" d={backArc} />
        <g clipPath={`url(#${id}-far)`}>
          <Moons at={at} orbit={orbit} filter={filter} />
        </g>
      </g>
      <g fill={`url(#${id}-letters)`} mask={`url(#${id}-cut)`}>
        <Bars letter={letterH} />
      </g>
      <g transform={tilt}>
        <path
          className="brand-mark__ring"
          d={frontArc}
          stroke={`url(#${id}-ring)`}
          strokeWidth={ringWidth}
        />
        <g clipPath={`url(#${id}-near)`}>
          <Moons at={at} orbit={orbit} filter={filter} />
        </g>
      </g>
      <g fill={`url(#${id}-letters)`}>
        <Bars letter={letterL} />
      </g>
    </svg>
  );
}

export default BrandMark;
