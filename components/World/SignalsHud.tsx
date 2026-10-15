'use client';

import { Icon } from '@iconify/react';

import {
  allFound,
  dismissFound,
  openSignalLog,
  signalCount,
  signals,
  useDetector,
  useFoundSignals,
  useLatestSignal,
} from './signalStore';

import type { SignalAction } from './signalStore';
import type { WorldContent } from './types';

/** Free roam's tally of signals found, for the HUD's top bar */
export function SignalCount() {
  const found = useFoundSignals().length;
  return (
    <span
      className={`explore-hud__signals${found === signalCount ? ' explore-hud__signals--all' : ''}`}
      title="Hidden signals found"
    >
      <Icon icon="ph:broadcast-bold" width={15} height={15} aria-hidden="true" />
      <span aria-hidden="true">
        {found}/{signalCount}
      </span>
      <span className="sr-only">
        {found} of {signalCount} hidden signals found
      </span>
    </span>
  );
}

/** Warms up as you near a signal you haven't found: hot and cold, no direction */
export function SignalDetector() {
  const bars = useDetector();
  if (!bars) return null;
  return (
    <div className="explore-hud__detector" aria-hidden="true">
      <span className="explore-hud__detector-label">
        {bars >= 4 ? 'Strong signal' : 'Signal detected'}
      </span>
      <span className="explore-hud__detector-bars">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < bars ? 'is-on' : undefined} />
        ))}
      </span>
    </div>
  );
}

export function SignalActionButton({
  action,
  cv,
  onPage,
}: {
  action: SignalAction;
  cv?: WorldContent['cv'];
  onPage: (path: string) => void;
}) {
  const icon = action.kind === 'cv' ? 'ph:file-arrow-down-bold' : 'ph:arrow-up-right-bold';
  if (action.kind === 'page') {
    return (
      <button type="button" className="btn btn--primary" onClick={() => onPage(action.href)}>
        <span>{action.label}</span>
        <Icon icon={icon} width={15} height={15} aria-hidden="true" />
      </button>
    );
  }
  const link =
    action.kind === 'cv'
      ? cv && { href: cv.url, download: cv.name }
      : { href: action.href, target: '_blank', rel: 'noopener noreferrer' };
  if (!link) return null;
  return (
    <a className="btn btn--primary" {...link}>
      <span>{action.label}</span>
      <Icon icon={icon} width={15} height={15} aria-hidden="true" />
      {action.kind === 'link' && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}

/** What a signal says when you find it, with what it carries */
export function SignalCard({
  cv,
  onPage,
}: {
  cv: WorldContent['cv'];
  onPage: (path: string) => void;
}) {
  const latest = useLatestSignal();
  const found = useFoundSignals().length;
  const signal = signals.find((s) => s.id === latest);

  if (!signal) return null;
  const complete = found === signalCount;
  return (
    <div className="explore-hud__signal glass" role="region" aria-label="Discovered signal">
      <p className="explore-hud__signal-eyebrow" role="status">
        <Icon icon="ph:broadcast-bold" width={14} height={14} aria-hidden="true" />
        Signal found · {found}/{signalCount}
      </p>
      <h2 className="explore-hud__signal-title">{signal.name}</h2>
      <p className="explore-hud__signal-text">{signal.message}</p>
      {complete && (
        <p className="explore-hud__signal-text explore-hud__signal-text--all">
          <b>{allFound.name}.</b> {allFound.message}
        </p>
      )}
      <div className="explore-hud__signal-actions">
        {signal.action && <SignalActionButton action={signal.action} cv={cv} onPage={onPage} />}
        {complete && allFound.action && signal.action?.kind !== 'page' && (
          <SignalActionButton action={allFound.action} cv={cv} onPage={onPage} />
        )}
        <button type="button" className="btn btn--ghost" onClick={openSignalLog}>
          Ship log
        </button>
        <button type="button" className="explore-hud__exit" onClick={dismissFound}>
          Close
        </button>
      </div>
    </div>
  );
}
