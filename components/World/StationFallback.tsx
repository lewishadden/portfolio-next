import Image from 'next/image';

/**
 * 2D render of a station's model, displayed only when the WebGL world is off
 * (no WebGL, Save-Data, or switched off: see World.tsx), over the still sky
 * World.scss puts in the world's place. Hidden images are never fetched.
 */
export function StationFallback({ src, className = '' }: { src: string; className?: string }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
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
