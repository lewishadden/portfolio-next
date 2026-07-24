import './Background.scss';

/**
 * Fixed atmosphere layer: faint topographic contour linework under three
 * slow-drifting ember orbs. Pure CSS/SVG — no canvas, no client JS.
 */
export const Background = () => (
  <div className="bg-container" aria-hidden="true">
    <svg className="bg-container__contours" focusable="false">
      <defs>
        <pattern id="bg-topo" width="560" height="560" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="var(--dot-grid-color)" strokeWidth="1.1">
            <path d="M150 60 C 220 52, 268 96, 262 158 C 256 222, 196 262, 136 252 C 78 242, 44 190, 54 136 C 64 84, 96 66, 150 60 Z" />
            <path d="M152 92 C 202 86, 234 116, 230 160 C 226 206, 184 232, 140 224 C 98 216, 76 180, 84 142 C 92 106, 112 96, 152 92 Z" />
            <path d="M154 124 C 186 120, 204 138, 200 162 C 196 190, 170 204, 142 198 C 118 193, 106 170, 112 148 C 118 128, 130 126, 154 124 Z" />
            <path d="M400 300 C 470 292, 520 336, 514 400 C 508 466, 446 508, 384 496 C 324 484, 290 430, 302 374 C 312 322, 344 306, 400 300 Z" />
            <path d="M402 334 C 452 328, 486 360, 480 404 C 474 450, 430 478, 386 468 C 344 458, 322 420, 332 382 C 340 346, 362 338, 402 334 Z" />
            <path d="M404 366 C 436 362, 456 382, 452 406 C 448 434, 420 450, 392 442 C 368 435, 356 412, 362 390 C 368 370, 380 368, 404 366 Z" />
            <path d="M-20 420 C 60 400, 140 440, 220 420 C 300 400, 340 350, 420 340" />
            <path d="M140 560 C 200 520, 300 540, 380 520 C 460 500, 520 540, 580 520" />
            <path d="M320 20 C 380 40, 440 20, 500 40 C 540 53, 560 80, 580 120" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg-topo)" />
    </svg>
    <div className="bg-container__orb bg-container__orb--1" />
    <div className="bg-container__orb bg-container__orb--2" />
    <div className="bg-container__orb bg-container__orb--3" />
  </div>
);

export default Background;
