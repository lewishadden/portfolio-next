import { Fragment } from 'react';

import './Marquee.scss';

/**
 * Slow infinite ticker. Items alternate between italic serif and mono
 * so the strip reads like set type, not a component library.
 * The track is duplicated once (aria-hidden) for a seamless loop.
 */
export const Marquee = ({
  items,
  separator = '✳',
  duration = 36,
  className = '',
  reverse = false,
}: {
  items: string[];
  separator?: string;
  /** Seconds for one full loop. */
  duration?: number;
  className?: string;
  reverse?: boolean;
}) => {
  const row = (hidden: boolean) => (
    <div className="marquee__row" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <Fragment key={`${item}-${i}`}>
          <span className={`marquee__item marquee__item--${i % 2 ? 'mono' : 'serif'}`}>{item}</span>
          <span className="marquee__sep" aria-hidden="true">
            {separator}
          </span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className={`marquee ${reverse ? 'marquee--reverse' : ''} ${className}`}>
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
