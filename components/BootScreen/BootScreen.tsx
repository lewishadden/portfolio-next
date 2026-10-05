'use client';

import { useEffect, useRef, useState } from 'react';
import { useLenis } from 'lenis/react';

import {
  bootState,
  bootSteps,
  clearBoot,
  finishBoot,
  onBoot,
  useBootPhase,
} from 'components/World/boot';

import './BootScreen.scss';

/** Longest the screen waits for the world before lifting anyway (ms) */
const giveUp = 20_000;
/** When the skip button appears (ms) */
const skipAfter = 3_500;
/** Pause on a full bar before lifting, and how long the lift takes (BootScreen.scss) (ms) */
const fullHold = 280;
const liftTime = 1_000;

/**
 * The loading screen on a full page load while the 3D world gets ready (see
 * World/boot). ThemeScript shows it before first paint when the world will
 * run; the bar follows what is really loading, creeping on between reports
 * so it never looks stuck. When the world is ready the bar fills, the stars
 * streak past and the screen dissolves into the camera's warp in.
 */
export function BootScreen() {
  const phase = useBootPhase();
  const rootRef = useRef<HTMLDivElement>(null);
  const [canSkip, setCanSkip] = useState(false);
  const lenis = useLenis();

  // No world this visit (ThemeScript didn't raise the screen): start at once
  useEffect(() => {
    if (document.documentElement.dataset.boot === 'loading') return;
    clearBoot();
  }, []);

  // The page stays put underneath
  useEffect(() => {
    if (!lenis || phase !== 'loading') return;
    lenis.stop();
    return () => lenis.start();
  }, [lenis, phase]);

  useEffect(() => {
    if (phase === 'gone') return;
    if (phase === 'leaving') {
      const id = window.setTimeout(clearBoot, liftTime);
      return () => window.clearTimeout(id);
    }
    const root = rootRef.current;
    if (!root || document.documentElement.dataset.boot !== 'loading') return;
    const status = root.querySelector<HTMLElement>('[data-step]');
    const percent = root.querySelector<HTMLElement>('[data-percent]');
    const bar = root.querySelector<HTMLElement>('[role="progressbar"]');
    const began = performance.now();
    let shown = 0;
    let reported = 0;
    let since = began;
    let step = -1;
    let full = 0;
    let last = began;
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const { progress, ready } = bootState();
      if (progress !== reported) {
        reported = progress;
        since = now;
      }
      // Between reports, creep a little further on so it never sits still
      const creep = ready ? 0 : 0.1 * (1 - Math.exp(-(now - since) / 2500));
      const target = ready ? 1 : Math.min(progress + creep, 0.97);
      shown += (target - shown) * (1 - Math.exp(-(ready ? 9 : 4) * dt));
      if (ready && shown > 0.995) shown = 1;
      root.style.setProperty('--progress', shown.toFixed(4));
      const whole = Math.floor(shown * 100);
      if (percent && percent.textContent !== `${whole}%`) {
        percent.textContent = `${whole}%`;
        bar?.setAttribute('aria-valuenow', String(whole));
      }
      const current = bootState().step;
      if (status && current !== step) {
        step = current;
        status.textContent = bootSteps[current];
      }
      if (shown === 1) {
        full ||= now;
        if (now - full > fullHold) {
          cancelAnimationFrame(frame);
          finishBoot();
        }
      }
    };
    frame = requestAnimationFrame(tick);
    const skip = window.setTimeout(() => setCanSkip(true), skipAfter);
    const fallback = window.setTimeout(finishBoot, giveUp);
    const stop = onBoot(() => {
      if (bootState().done) cancelAnimationFrame(frame);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(skip);
      window.clearTimeout(fallback);
      stop();
    };
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div ref={rootRef} className="boot">
      <div className="boot__sky" aria-hidden="true">
        <span className="boot__stars boot__stars--far" />
        <span className="boot__stars boot__stars--mid" />
        <span className="boot__stars boot__stars--near" />
        <span className="boot__streaks" />
      </div>

      <div className="boot__content">
        <div className="boot__emblem" aria-hidden="true">
          <span className="boot__orbit">
            <span className="boot__moon" />
          </span>
          <span className="boot__planet" />
        </div>

        <p className="boot__name">Lewis Hadden</p>

        <div
          className="boot__track"
          role="progressbar"
          aria-label="Loading the 3D world"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <span className="boot__trail" />
          <span className="boot__head" />
          <span className="boot__goal" />
        </div>

        <p className="boot__status">
          <span data-step="" aria-live="polite">
            {bootSteps[0]}
          </span>
          <span className="boot__percent" data-percent="">
            0%
          </span>
        </p>
      </div>

      {canSkip && phase === 'loading' && (
        <button type="button" className="boot__skip" onClick={finishBoot}>
          Skip to the page
        </button>
      )}
    </div>
  );
}

export default BootScreen;
