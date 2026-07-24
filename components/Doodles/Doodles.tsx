import './Doodles.scss';

/**
 * Hand-drawn SVG accents. Every path uses pathLength={1} so the shared
 * .doodle CSS can run a stroke draw-on when the global reveal observer
 * adds `.is-in`. All are decorative — hidden from assistive tech.
 */

type DoodleProps = {
  className?: string;
  /** Seconds to wait after reveal before the stroke starts drawing. */
  delay?: number;
};

const doodleStyle = (delay?: number) =>
  delay ? ({ '--doodle-delay': `${delay}s` } as React.CSSProperties) : undefined;

/** Wavy underline that overshoots slightly at the tail. */
export const Squiggle = ({ className = '', delay }: DoodleProps) => (
  <svg
    className={`doodle reveal ${className}`}
    style={doodleStyle(delay)}
    viewBox="0 0 220 26"
    aria-hidden="true"
    focusable="false"
  >
    <path
      pathLength={1}
      d="M4 15 C 22 7, 38 21, 57 14 S 92 6, 111 14 S 147 22, 165 13 S 199 7, 216 16"
    />
  </svg>
);

/** Rough double-stroke underline, second pass shorter and lower. */
export const RoughUnderline = ({ className = '', delay }: DoodleProps) => (
  <svg
    className={`doodle reveal ${className}`}
    style={doodleStyle(delay)}
    viewBox="0 0 240 22"
    aria-hidden="true"
    focusable="false"
  >
    <path pathLength={1} d="M5 8 C 60 3, 150 4, 235 7" />
    <path pathLength={1} d="M18 16 C 80 12, 160 12, 214 15" />
  </svg>
);

/** Sketchy curved arrow, drawn tail-to-head. */
export const ArrowScribble = ({ className = '', delay }: DoodleProps) => (
  <svg
    className={`doodle reveal ${className}`}
    style={doodleStyle(delay)}
    viewBox="0 0 120 90"
    aria-hidden="true"
    focusable="false"
  >
    <path pathLength={1} d="M8 10 C 14 48, 40 74, 92 71" />
    <path pathLength={1} d="M76 56 C 84 63, 90 68, 94 71 C 88 73, 80 77, 73 83" />
  </svg>
);

/** Six-stroke asterisk spark. */
export const Spark = ({ className = '', delay }: DoodleProps) => (
  <svg
    className={`doodle reveal ${className}`}
    style={doodleStyle(delay)}
    viewBox="0 0 60 60"
    aria-hidden="true"
    focusable="false"
  >
    <path pathLength={1} d="M30 6 C 29 16, 30 24, 30 28" />
    <path pathLength={1} d="M30 54 C 30 46, 30 38, 30 33" />
    <path pathLength={1} d="M7 30 C 16 30, 22 30, 26 30" />
    <path pathLength={1} d="M53 30 C 46 31, 39 30, 34 30" />
    <path pathLength={1} d="M13 13 C 19 19, 23 23, 26 26" />
    <path pathLength={1} d="M47 47 C 41 41, 37 37, 34 34" />
  </svg>
);

/** Scribbled circle that loops one-and-a-bit times, hand-thrown. */
export const CircleScribble = ({ className = '', delay }: DoodleProps) => (
  <svg
    className={`doodle reveal ${className}`}
    style={doodleStyle(delay)}
    viewBox="0 0 200 90"
    aria-hidden="true"
    focusable="false"
  >
    <path
      pathLength={1}
      d="M128 12 C 66 4, 12 22, 10 46 C 8 72, 62 84, 106 82 C 152 80, 192 66, 190 43 C 188 20, 138 8, 88 12"
    />
  </svg>
);

/** Dashed flight-path with a gentle S-curve. */
export const DottedPath = ({ className = '', delay }: DoodleProps) => (
  <svg
    className={`doodle doodle--dotted reveal ${className}`}
    style={doodleStyle(delay)}
    viewBox="0 0 260 80"
    aria-hidden="true"
    focusable="false"
  >
    <path pathLength={1} d="M6 70 C 60 66, 96 22, 148 20 C 196 18, 226 38, 254 12" />
  </svg>
);

/** Little hand-drawn four-point star (filled after draw). */
export const TinyStar = ({ className = '', delay }: DoodleProps) => (
  <svg
    className={`doodle reveal ${className}`}
    style={doodleStyle(delay)}
    viewBox="0 0 40 40"
    aria-hidden="true"
    focusable="false"
  >
    <path
      pathLength={1}
      d="M20 4 C 21 12, 23 16, 20 20 C 25 18, 30 19, 36 20 C 29 22, 24 23, 20 20 C 22 26, 21 31, 20 36 C 19 30, 18 25, 20 20 C 15 22, 10 21, 4 20 C 11 18, 16 18, 20 20 C 18 15, 19 9, 20 4 Z"
    />
  </svg>
);
