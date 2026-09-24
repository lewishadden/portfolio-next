import { Fragment } from 'react';

import './Marquee.scss';

/**
 * Infinite ticker. Items alternate between display type and outlined mono so
 * the strip reads like a HUD readout. The track is duplicated once
 * (aria-hidden) for a seamless loop; hover pauses it.
 */
export const Marquee = ({
  items,
  separator = '✦',
  duration = 36,
  className = '',
  reverse = false,
  label,
}: {
  items: string[];
  separator?: string;
  /** Seconds for one full loop. */
  duration?: number;
  className?: string;
  reverse?: boolean;
  /** Accessible summary; the moving text itself is hidden from screen readers */
  label?: string;
}) => {
  const row = (hidden: boolean) => (
    <div className="marquee__row" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <Fragment key={`${item}-${i}`}>
          <span className={`marquee__item marquee__item--${i % 2 ? 'alt' : 'main'}`}>{item}</span>
          <span className="marquee__sep" aria-hidden="true">
            {separator}
          </span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div
      className={`marquee ${reverse ? 'marquee--reverse' : ''} ${className}`}
      role={label ? 'marquee' : undefined}
      aria-label={label}
    >
      <div
        className="marquee__track"
        style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
      >
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
};

export default Marquee;
