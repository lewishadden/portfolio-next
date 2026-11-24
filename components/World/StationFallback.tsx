import Image from 'next/image';

/**
 * 2D render of a station's model, displayed only when the WebGL world is off
 * (no WebGL, Save-Data, or switched off: see World.tsx), over the still sky
 * World.scss puts in the world's place. Hidden images are never fetched.
 * Its alt text says what it shows (illustrationAlt), standing in for the
 * station readout's scene line, which is only there while the world is on;
 * hidden (the world on, or no JavaScript), it is out of the accessibility
 * tree too
 */
export function StationFallback({ src, className = '' }: { src: string; className?: string }) {
  const alt = illustrationAlt[src] ?? '';
  return (
    <Image
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={800}
      height={800}
      sizes="(min-width: 900px) 420px, 60vw"
      className={`station-fallback ${className}`}
    />
  );
}

/**
 * The 2D renders, by what they show. The terminal (also the projects'
 * Open Graph render) stands in for the stations that are built in code
 * rather than modelled: skills and the project pages
 */
export const illustrations = {
  astronaut: '/static/images/illustrations/astronaut.webp',
  helmet: '/static/images/illustrations/helmet.webp',
  satellite: '/static/images/illustrations/satellite.webp',
  terminal: '/static/images/illustrations/terminal.webp',
  rocket: '/static/images/illustrations/rocket.webp',
} as const;

/** What each render shows, for its alt text (the terminal fits skills and the project pages alike) */
const illustrationAlt: Record<string, string> = {
  [illustrations.astronaut]: 'An astronaut floats in space, typing on a laptop.',
  [illustrations.helmet]: 'A white spacesuit helmet with a violet visor.',
  [illustrations.satellite]: 'A satellite with a dish and two solar panels.',
  [illustrations.terminal]: 'A retro computer terminal with lines of code on its screen.',
  [illustrations.rocket]: 'A small white rocket stands ready for launch.',
};
