'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

import { commandPalette } from '@/components/CommandPalette/CommandPalette';
import { useSound } from '@/components/Sound/sound';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWorldPreference } from '@/hooks/useWorldPreference';

import { inspectEntity, isInspecting, useInspection } from './inspection';
import { unlockPointer } from './pointerLock';
import { SectorChart, useStationVisits } from './SectorChart';
import { SignalActionButton } from './SignalsHud';
import { allFound, dismissFound, signalCount, signalLogEvent, signals, useFoundSignals } from './signalStore';
import { stationPaths } from './routes';
import { setTravelPreference, useTravelPreference } from './travelPreference';
import { launchWorldMode, useWorldMode, worldMode } from './worldMode';
import { navigateTo, setAutopilot, setPreview } from './worldStore';

import type { StationKey } from './routes';
import type { WorldContent } from './types';

import './WorldUtilities.scss';

type UtilityPanel = 'chart' | 'log' | 'preferences';
const utilityPanels: { id: UtilityPanel; label: string; icon: string }[] = [
  { id: 'chart', label: 'Sector chart', icon: 'ph:planet-bold' },
  { id: 'log', label: 'Ship log', icon: 'ph:book-open-bold' },
  { id: 'preferences', label: 'Preferences', icon: 'ph:sliders-horizontal-bold' },
];

function ShipLog({
  cv,
  onPage,
}: {
  cv?: WorldContent['cv'];
  onPage: (path: string) => void;
}) {
  const found = useFoundSignals();
  const entries = signals.filter((signal) => found.includes(signal.id));
  return (
    <section className="ship-log" aria-label="Discovered transmissions">
      <p className="world-utilities__intro">{entries.length} of {signalCount} signals found. Discovered transmissions stay here for your next visit.</p>
      {entries.length === 0 ? (
        <p className="ship-log__empty">No transmissions recorded yet. Explore the sector and follow the signal detector to make a discovery.</p>
      ) : (
        <ul className="ship-log__entries">
          {entries.map((signal) => (
            <li key={signal.id}>
              <details className="ship-log__entry">
                <summary>{signal.name}<span>Read transmission</span></summary>
                <p>{signal.message}</p>
                {signal.action && (signal.action.kind !== 'cv' || cv) && (
                  <SignalActionButton action={signal.action} cv={cv} onPage={onPage} />
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
      {entries.length === signalCount && (
        <div className="ship-log__complete">
          <h3>{allFound.name}</h3>
          <p>{allFound.message}</p>
          {allFound.action && <SignalActionButton action={allFound.action} cv={cv} onPage={onPage} />}
        </div>
      )}
    </section>
  );
}

/** Accessible cockpit tools, also available when the canvas is off or unavailable. */
export function WorldUtilities({ cv }: { cv?: WorldContent['cv'] } = {}) {
  const [panel, setPanel] = useState<UtilityPanel | null>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(panel !== null);
  const { mode, tourResume } = useWorldMode();
  const { enabled, supported, setEnabled } = useWorldPreference();
  const reducedMotion = useReducedMotion();
  const preference = useTravelPreference();
  const { on: soundOn, setSound } = useSound();
  const found = useFoundSignals();
  const inspecting = useInspection() !== null;
  useStationVisits();

  const open = (next: UtilityPanel) => {
    if (isInspecting()) return;
    unlockPointer();
    setPanel(next);
  };

  useEffect(() => {
    const onLog = () => {
      if (isInspecting()) return;
      unlockPointer();
      dismissFound();
      setPanel('log');
    };
    window.addEventListener(signalLogEvent, onLog);
    return () => window.removeEventListener(signalLogEvent, onLog);
  }, []);

  useEffect(() => {
    if (!panel) return;
    document.documentElement.classList.add('world-console-open');
    const frame = requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setPanel(null);
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.documentElement.classList.remove('world-console-open');
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [panel, dialogRef]);

  useEffect(() => {
    if (panel || !pendingAction.current) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    action();
  }, [panel]);

  // Release the utility focus trap before another dialog acquires focus, or
  // before navigation makes the trigger's page inert. React commits first.
  const handoff = (action: () => void) => {
    pendingAction.current = action;
    setPanel(null);
    setPreview('');
  };
  const visitPage = (path: string) => handoff(() => {
    worldMode.exit();
    navigateTo(path);
  });
  const travel = (station: StationKey) => handoff(() => {
    if (worldMode.get().mode === 'explore' && enabled && supported) {
      setAutopilot(station);
    } else {
      worldMode.exit();
      navigateTo(stationPaths[station]);
    }
  });
  const startTour = (resume: boolean) => handoff(() => {
    launchWorldMode('tour', () => setEnabled(true), resume);
  });

  return (
    <>
      <nav className="world-utilities" aria-label="World utilities" inert={inspecting}>
        {utilityPanels.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => open(item.id)}
            aria-label={item.label}
            aria-haspopup="dialog"
            aria-expanded={panel === item.id}
          >
            <Icon icon={item.icon} width={18} height={18} aria-hidden="true" />
            <span>{item.id === 'chart' ? 'Chart' : item.id === 'log' ? 'Log' : 'Options'}</span>
            {item.id === 'log' && found.length > 0 && <small aria-hidden="true">{found.length}</small>}
          </button>
        ))}
      </nav>
      {panel && (
        <div className="world-utilities__backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) setPanel(null);
        }}>
          <div
            ref={dialogRef}
            className="world-utilities__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="world-utilities-title"
            data-world-input-owner="utilities"
            data-lenis-prevent
            tabIndex={-1}
          >
            <header className="world-utilities__header">
              <div>
                <p className="world-utilities__eyebrow">Cockpit console</p>
                <h2 id="world-utilities-title">{utilityPanels.find((item) => item.id === panel)?.label}</h2>
              </div>
              <button type="button" className="world-utilities__close" onClick={() => setPanel(null)} aria-label="Close console">
                <Icon icon="ph:x-bold" width={20} height={20} aria-hidden="true" />
              </button>
            </header>
            <nav className="world-utilities__sections" aria-label="Console sections">
              {utilityPanels.map((item) => (
                <button key={item.id} type="button" aria-pressed={panel === item.id} onClick={() => setPanel(item.id)}>{item.label}</button>
              ))}
            </nav>
            {panel === 'chart' && <SectorChart onTravel={travel} onInspect={(station) => handoff(() => inspectEntity({ kind: 'station', id: station, station }))} />}
            {panel === 'log' && <ShipLog cv={cv} onPage={visitPage} />}
            {panel === 'preferences' && (
              <div className="world-utilities__preferences">
                <fieldset className="world-utilities__travel">
                  <legend>Travel presentation</legend>
                  <p>Choose how you move between stations while keeping the world around you.</p>
                  <label><input type="radio" name="travel-presentation" value="cinematic" aria-label="Cinematic" checked={preference === 'cinematic'} onChange={() => setTravelPreference('cinematic')} /><span><b>Cinematic</b><small>Full station flights and camera motion</small></span></label>
                  <label><input type="radio" name="travel-presentation" value="calm" aria-label="Calm" checked={preference === 'calm'} onChange={() => setTravelPreference('calm')} /><span><b>Calm</b><small>Gentle, short travel with a steady camera</small></span></label>
                  {reducedMotion && <p>Your device’s reduced-motion preference takes priority.</p>}
                </fieldset>
                <div className="world-utilities__settings">
                  <button type="button" className="btn btn--ghost" aria-pressed={soundOn} onClick={() => setSound(!soundOn)}>Sound {soundOn ? 'on' : 'off'}</button>
                  {supported && <button type="button" className="btn btn--ghost" aria-pressed={enabled} onClick={() => setEnabled(!enabled)}>3D world {enabled ? 'on' : 'off'}</button>}
                  <button type="button" className="btn btn--ghost" onClick={() => handoff(commandPalette.open)}>Command palette</button>
                </div>
                {supported && mode !== 'tour' && (
                  <div className="world-utilities__settings">
                    <button type="button" className="btn btn--primary" onClick={() => startTour(false)}>Start guided tour</button>
                    {tourResume !== null && <button type="button" className="btn btn--ghost" onClick={() => startTour(true)}>Resume tour</button>}
                  </div>
                )}
                {mode !== 'page' && <button type="button" className="btn btn--ghost" onClick={() => handoff(worldMode.exit)}>Return to page</button>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
