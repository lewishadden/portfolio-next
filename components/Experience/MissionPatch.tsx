import { useId } from 'react';

/**
 * A role's mission patch, embroidered-badge style: the mission number round
 * the top, the company round the bottom, the company's monogram on a planet
 * with an orbiting satellite in the middle (the site's mark). Decorative:
 * the card says all of it in text.
 */
export function MissionPatch({
  number,
  company,
  initials,
  tone,
}: {
  number: string;
  company: string;
  initials: string;
  /** Which of the patch colours (0-4) */
  tone: number;
}) {
  const id = useId().replace(/[^\w-]/g, '');
  return (
    <svg
      className={`xp__patch xp__patch--${tone % 5}`}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Text sits outside the top arc and inside the bottom one, both upright */}
        <path id={`${id}-top`} d="M 20 60 A 40 40 0 0 1 100 60" />
        <path id={`${id}-bottom`} d="M 13 60 A 47 47 0 0 0 107 60" />
      </defs>
      <circle className="xp__patch-rim" cx="60" cy="60" r="56" />
      <circle className="xp__patch-stitch" cx="60" cy="60" r="51.5" />
      <circle className="xp__patch-field" cx="60" cy="60" r="31" />
      <circle className="xp__patch-planet" cx="60" cy="60" r="17" />
      <ellipse
        className="xp__patch-orbit"
        cx="60"
        cy="60"
        rx="27"
        ry="8"
        transform="rotate(-18 60 60)"
      />
      <circle className="xp__patch-sat" cx="84.5" cy="51" r="2.6" />
      <circle className="xp__patch-star" cx="30" cy="42" r="1.2" />
      <circle className="xp__patch-star" cx="91" cy="79" r="1" />
      <circle className="xp__patch-star" cx="38" cy="83" r="0.8" />
      <text className="xp__patch-initials" x="60" y="64.5" textAnchor="middle">
        {initials}
      </text>
      <text className="xp__patch-ring">
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
          MISSION {number}
        </textPath>
      </text>
      <text className="xp__patch-ring">
        <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
          {company.toUpperCase()}
        </textPath>
      </text>
    </svg>
  );
}

export default MissionPatch;
