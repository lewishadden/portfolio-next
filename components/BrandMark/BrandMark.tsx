'use client';

import { useEffect, useId, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { stationForPath } from 'components/World/routes';

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
import { createMarkMotion } from './markMotion';

import './BrandMark.scss';

/** Ghost moons behind the moon when it races (a flight, free roam, a hover) */
const ghosts = 4;
/** Half the station notch's length round the ring (radians) */
const notchHalf = 0.09;

const tilt = `rotate(${ring.tilt} ${ring.cx} ${ring.cy})`;

/** A short stretch of the ring centred on `angle`, as a path */
function notchPath(angle: number) {
  const a = moonPoint(angle - notchHalf);
  const b = moonPoint(angle + notchHalf);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${ring.rx} ${ring.ry} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

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
 * The LH orbital monogram (geometry in markGeometry.ts), as SVG: the
 * header's logo until the 3D model takes over (HeaderMark), and wherever
 * WebGL isn't used. Live, it moves as markMotion.ts says: the moon orbits,
 * slipping behind the letters, faster with a trail during flights, free roam
 * or a hover, and a notch on the ring marks the docked station. `orbit` (the
 * loading screen) just circles, declaratively, so it moves before the page
 * has hydrated. Still for reduced motion.
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
  const hoverRef = useRef(false);
  const at = stationSlots[station] ?? stationSlots.home;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || orbit) return;
    const layers = Array.from({ length: ghosts + 1 }, (_, k) => [
      ...svg.querySelectorAll<SVGCircleElement>(`[data-moon="${k}"]`),
    ]);
    const notch = svg.querySelector<SVGPathElement>('[data-notch]');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = createMarkMotion();
    let last = performance.now();
    let frame = 0;

    const place = (circles: SVGCircleElement[], angle: number) => {
      const { x, y } = moonPoint(angle);
      for (const circle of circles) {
        circle.setAttribute('cx', x.toFixed(2));
        circle.setAttribute('cy', y.toFixed(2));
      }
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const pose = motion.step(dt, hoverRef.current, reduce.matches);
      place(layers[0], pose.moon);
      for (let k = 1; k <= ghosts; k++) {
        place(layers[k], pose.moon + k * (0.08 + pose.rush * 0.1));
        const opacity = pose.rush * 0.7 * (1 - k / (ghosts + 1));
        for (const circle of layers[k]) circle.setAttribute('opacity', opacity.toFixed(2));
      }
      notch?.setAttribute('d', notchPath(pose.notch));
      svg.classList.toggle('brand-mark--lost', pose.station === 'lost');
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [orbit]);

  const filter = `url(#${id}-glow)`;
  return (
    <svg
      ref={svgRef}
      className={`brand-mark ${className}`}
      viewBox={`${markBounds.x} ${markBounds.y} ${markBounds.width} ${markBounds.height}`}
      aria-hidden="true"
      focusable="false"
      onPointerEnter={() => {
        hoverRef.current = true;
      }}
      onPointerLeave={() => {
        hoverRef.current = false;
      }}
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
        {/* The ring's near half cuts a gap where it crosses the letters */}
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
        <Bars letter={letterL} />
        <Bars letter={letterH} />
      </g>
      <g transform={tilt}>
        <path
          className="brand-mark__ring"
          d={frontArc}
          stroke={`url(#${id}-ring)`}
          strokeWidth={ringWidth}
        />
        {!orbit && (
          <path className="brand-mark__notch" data-notch="" d={notchPath(at)} filter={filter} />
        )}
        <g clipPath={`url(#${id}-near)`}>
          <Moons at={at} orbit={orbit} filter={filter} />
        </g>
      </g>
    </svg>
  );
}

export default BrandMark;
