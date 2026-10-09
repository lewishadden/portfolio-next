'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@iconify/react';

import { BrandMark } from 'components/BrandMark/BrandMark';
import { useSound } from 'components/Sound/sound';
import {
  bootState,
  bootSteps,
  clearBoot,
  finishBoot,
  onBoot,
  useBootPhase,
} from 'components/World/boot';
import { useLenisHold } from '@/hooks/useLenisHold';
import { motionLevel } from '@/utils/motion';

import './BootScreen.scss';

/** Longest the screen waits for the world, from the page's start, before lifting anyway (ms) */
const giveUp = 20_000;
/** Pause on a full bar before lifting, and how long the lift takes (BootScreen.scss) (ms) */
const fullHold = 280;
const liftTime = 1_000;

/**
 * Lifting at full motion, the big mark flies into the header's logo slot
 * (BootScreen.scss, `boot-dock`, 0.8s): where it has to go, as offsets of
 * its centre and a scale, or null if there's no slot to fly to
 */
function dockOffsets(root: HTMLElement) {
  const mark = root.querySelector<SVGSVGElement>('.boot__mark');
  const slot =
    document.querySelector<Element>('.header__logo-mark .brand-mark-live__svg') ??
    document.querySelector<Element>('.header__logo-mark');
  if (!mark || !slot) return null;
  const from = mark.getBoundingClientRect();
  const to = slot.getBoundingClientRect();
  if (!from.height || !to.height) return null;
  return {
    x: to.left + to.width / 2 - (from.left + from.width / 2),
    y: to.top + to.height / 2 - (from.top + from.height / 2),
    scale: to.height / from.height,
  };
}

// True once hydrated: what only works with the app shows from then on
const subscribeNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * The loading screen on a full page load while the 3D world gets ready (see
 * World/boot). ThemeScript shows it before first paint when the world will
 * run; the bar follows what is really loading, creeping on between reports
 * so it never looks stuck. When the world is ready the bar fills, the stars
 * streak past and the screen dissolves into the camera's warp in.
 *
 * It never traps anyone: the skip button is in the server HTML (shown after a
 * few seconds by CSS) and ThemeScript makes it work, and gives up, even if
 * the app never starts. Once it has, "Launch with sound" turns sound on with
 * a click, so the audio can start in time with the warp in.
 */
export function BootScreen() {
  const phase = useBootPhase();
  const rootRef = useRef<HTMLDivElement>(null);
  const hydrated = useSyncExternalStore(subscribeNothing, onClient, onServer);
  const { on: sound, setSound } = useSound();
  // Offered unless sound was already on; once chosen here, it stays to show it's on
  const [choseSound, setChoseSound] = useState(false);
  const offerSound = hydrated && (!sound || choseSound);

  // No world this visit (ThemeScript didn't raise the screen): start at once
  useEffect(() => {
    if (document.documentElement.dataset.boot === 'loading') return;
    clearBoot();
  }, []);

  // The page stays put underneath
  useLenisHold(phase === 'loading');

  useEffect(() => {
    if (phase === 'gone') return;
    if (phase === 'leaving') {
      // Below full motion there's no lift to watch: straight to the page
      if (motionLevel() !== 'full') {
        clearBoot();
        return;
      }
      const root = rootRef.current;
      const dock = root && dockOffsets(root);
      if (root && dock) {
        root.style.setProperty('--dock-x', `${dock.x.toFixed(1)}px`);
        root.style.setProperty('--dock-y', `${dock.y.toFixed(1)}px`);
        root.style.setProperty('--dock-scale', dock.scale.toFixed(4));
        root.classList.add('boot--docking');
      }
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
    // From the page's start, not hydration: a slow start doesn't add to the wait
    const fallback = window.setTimeout(finishBoot, Math.max(0, giveUp - performance.now()));
    const stop = onBoot(() => {
      if (bootState().done) cancelAnimationFrame(frame);
    });
    return () => {
      cancelAnimationFrame(frame);
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
        <BrandMark className="boot__mark" orbit />

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

        {offerSound && (
          <button
            type="button"
            className={`boot__sound${sound ? ' boot__sound--on' : ''}`}
            aria-pressed={sound}
            onClick={() => {
              setChoseSound(true);
              setSound(!sound);
            }}
          >
            <Icon
              icon={sound ? 'ph:speaker-high-bold' : 'ph:speaker-simple-x-bold'}
              width={16}
              height={16}
              aria-hidden="true"
            />
            <span>Launch with sound</span>
            <span className="boot__sound-state" aria-hidden="true">
              {sound ? 'On' : 'Off'}
            </span>
          </button>
        )}
      </div>

      {/* In the server HTML, appearing after a few seconds (BootScreen.scss);
          ThemeScript handles the click until the app is running */}
      {phase === 'loading' && (
        <button type="button" className="boot__skip" onClick={finishBoot}>
          Skip to the page
        </button>
      )}
    </div>
  );
}

export default BootScreen;
