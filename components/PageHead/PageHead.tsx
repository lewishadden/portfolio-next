import { Reveal } from 'components/Motion/Reveal';
import { ScrambleText } from 'components/Motion/ScrambleText';
import { StationFallback } from 'components/World/StationFallback';

import type { ReactNode } from 'react';

/**
 * Shared page header: numbered eyebrow, display title with a gradient accent
 * word, and a subtitle. `stage` leaves room beside (wide) or above (narrow)
 * the copy for the page's 3D station (or its 2D render when WebGL is off).
 */
export function PageHead({
  id,
  index,
  label,
  title,
  accent,
  sub,
  stage = true,
  center = false,
  illustration,
  children,
}: {
  /** id for the <h1>, referenced by the section's aria-labelledby */
  id: string;
  index: string;
  label: string;
  title: string;
  accent?: string;
  sub?: ReactNode;
  stage?: boolean;
  center?: boolean;
  /** 2D render of the station, shown only when the WebGL world is off */
  illustration?: string;
  children?: ReactNode;
}) {
  return (
    <>
      {illustration && <StationFallback src={illustration} />}
      <header
        className={`page-head${stage ? ' page-head--stage' : ''}${center ? ' page-head--center' : ''}`}
      >
        {stage && <div className="page-head__stage" aria-hidden="true" />}
        <Reveal className="page-head__eyebrow" y={16}>
          <p className="eyebrow">
            <span className="eyebrow__index">{index}</span>
            <span className="eyebrow__line" aria-hidden="true" />
            <ScrambleText text={label} trigger="mount" delay={250} />
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 id={id} className="page-title">
            {title}
            {accent && (
              <>
                {' '}
                <span className="text-gradient">{accent}</span>
              </>
            )}
          </h1>
        </Reveal>
        {sub && (
          <Reveal delay={0.16}>
            <p className="page-sub">{sub}</p>
          </Reveal>
        )}
        {children}
      </header>
    </>
  );
}

export default PageHead;
