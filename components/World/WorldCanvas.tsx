'use client';

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';

import { Asteroids } from './Asteroids';
import { Beacons } from './Beacons';
import { bootState, readyBoot, reportBoot, useBooted } from './boot';
import { downloads } from './downloads';
import { CameraRig } from './CameraRig';
import { Cockpit } from './Cockpit';
import { CourseLine } from './CourseLine';
import { DockingBeam } from './DockingBeam';
import { Dust } from './Dust';
import { EdgeShimmer } from './EdgeShimmer';
import { Effects } from './Effects';
import { ExploreControls } from './ExploreControls';
import { GasClouds } from './GasClouds';
import { HeadingProjector } from './HeadingProjector';
import { setHullTheme } from './hull';
import { worldEvents } from './interaction';
import { Landmarks } from './Landmarks';
import { Lighting } from './Lighting';
import { MotionProbe } from './MotionProbe';
import { Nebula } from './Nebula';
import { Pings } from './Pings';
import { PowerDriver } from './power';
import { BrightStars, Starfield } from './Starfield';
import { StatsProbe } from './StatsProbe';
import { AboutStation } from './stations/AboutStation';
import { ContactStation } from './stations/ContactStation';
import { ExperienceStation } from './stations/ExperienceStation';
import { HomeStation } from './stations/HomeStation';
import { LostStation } from './stations/LostStation';
import { ProjectsStation } from './stations/ProjectsStation';
import { Signals } from './Signals';
import { Sparks } from './Sparks';
import { SkillsStation } from './stations/SkillsStation';
import { lowerTier, raiseTier, tierSettings } from './quality';
import { navigableStations } from './routes';
import { LiteContext } from './stationHooks';
import { baseFov } from './stations';
import { TipProbe } from './TipProbe';
import { Traffic } from './Traffic';
import { palettes } from './utils';
import {
  Precompiled,
  WarmupGate,
  WarmupProvider,
  createWarmupTracker,
  useWarmupIdle,
} from './warmup';
import { tourStops, useWorldMode } from './worldMode';
import { chrome, intentSettle, onChrome, onIntent, worldStore } from './worldStore';

import type { Dispatch, SetStateAction } from 'react';
import type { RootState } from '@react-three/fiber';
import type { Clock } from 'three';
import type { MotionLevel } from '@/utils/motion';
import type { QualityTier } from './quality';
import type { StationKey } from './stations';
import type { WorldContent } from './types';
import type { WorldTheme } from './utils';

/** Everywhere free roam can reach: every station, and the 404 derelict as a hidden signal */
const roamable: StationKey[] = [...navigableStations, 'lost'];

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Page chrome covers the whole world (the mobile menu, a full-screen modal) */
const isCovered = () => chrome.menuOpen || chrome.modalCover;
const notCovered = () => false;

/** The station the visitor is about to fly to (worldStore.intent) */
const readIntent = () => worldStore.intent;
const noIntent = () => '' as const;

/** Sets the clock's time (hook results are read-only in components) */
function setClockTime(clock: Clock, time: number) {
  clock.elapsedTime = time;
}

/** Drops the frames R3F still has queued (hook results are read-only in components) */
function dropQueuedFrames(state: RootState) {
  state.internal.frames = 0;
}

/**
 * The canvas stops drawing while page chrome covers it. R3F restarts its
 * clock at 0 whenever the frameloop changes, which would throw everything
 * timed by it (the rocket's launch, the tour's sway, shader time) back to
 * the start: when the cover lifts, the world's time carries on from where
 * it stopped instead, and a frame is asked for. A frame R3F still had
 * queued as it paused would draw once more with its "never" mode's own
 * timing (the clock set to the raw frame timestamp, a delta of the page's
 * whole life), so the queue is dropped as the cover goes up.
 */
function CoverPause({ covered }: { covered: boolean }) {
  const get = useThree((s) => s.get);
  const frameloop = useThree((s) => s.frameloop);
  const time = useRef(0);
  const paused = useRef(false);

  useFrame((state) => {
    if (state.frameloop !== 'never') time.current = state.clock.elapsedTime;
  });

  useLayoutEffect(() => {
    const state = get();
    if (covered) {
      paused.current = true;
      dropQueuedFrames(state);
      return;
    }
    if (!paused.current || frameloop === 'never') return;
    paused.current = false;
    setClockTime(state.clock, time.current);
    state.invalidate();
  }, [covered, frameloop, get]);

  return null;
}

/** With frameloop="demand" (the still motion level), repaint on scroll, resize and route changes */
function DemandDriver({
  station,
  theme,
  focusProject,
}: {
  station: StationKey;
  theme: WorldTheme;
  focusProject: number;
}) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    invalidate();
    const repaint = () => invalidate();
    window.addEventListener('scroll', repaint, { passive: true });
    window.addEventListener('resize', repaint);
    // Models stream in after the first paint
    const timers = [400, 1200, 3000].map((ms) => setTimeout(repaint, ms));
    return () => {
      window.removeEventListener('scroll', repaint);
      window.removeEventListener('resize', repaint);
      timers.forEach(clearTimeout);
    };
  }, [invalidate, station, theme, focusProject]);

  return null;
}

/** PerformanceMonitor judges the frame rate over `judgeSamples` samples of `sampleMs` each */
const sampleMs = 400;
const judgeSamples = 10;
/** How long after loading work or a flight its verdicts are ignored: a whole judging window, with room for slow frames */
const settleMs = sampleMs * judgeSamples * 1.25;
/** After this many falls straight after a rise, the tier stops rising: the device sits on the edge */
const maxReversals = 3;
/** A fall counts as straight after a rise within the next judging window or the one after */
const reversalMs = settleMs * 2;

/**
 * Adapts the quality tier to the device. The monitor stays mounted for the
 * canvas's life, so its history survives navigations, but its verdicts only
 * count once nothing has warmed up and the camera hasn't flown between
 * stations (scroll-follow is much slower and doesn't count) for a whole
 * judging window. Otherwise one-off loading work reads as a slow device and
 * drops the tier for good. Nor do they count while the canvas renders on
 * demand: sparse frames aren't a frame rate. A device always above the upper
 * bound keeps inclining at the ceiling, which is no change at all; one that
 * falls back straight after a rise (within two judging windows) three times
 * stops rising rather than flapping between tiers (each change resizes the
 * canvas and the composer, a visible hitch). A fall long after a rise (a
 * heavy page, thermal throttling) is a fall, not a flap.
 */
function QualityGovernor({
  tier,
  ceiling,
  setTier,
}: {
  tier: QualityTier;
  ceiling: QualityTier;
  setTier: Dispatch<SetStateAction<QualityTier>>;
}) {
  const idle = useWarmupIdle();
  const frameloop = useThree((s) => s.frameloop);
  const watch = useRef({ busyUntil: 0, roseAt: -Infinity, reversals: 0, lastFrame: 0 });

  useFrame(() => {
    const now = performance.now();
    const state = watch.current;
    // A pause (the menu covering the world, a hidden tab) reads as one very
    // slow frame in the monitor's samples: not the device's doing either
    if (!idle || worldStore.velocity > 12 || now - state.lastFrame > 250) {
      state.busyUntil = now + settleMs;
    }
    state.lastFrame = now;
  });

  const judging = () => frameloop === 'always' && performance.now() >= watch.current.busyUntil;

  return (
    <PerformanceMonitor
      onDecline={() => {
        if (!judging() || tier === 'low') return;
        const state = watch.current;
        if (performance.now() - state.roseAt <= reversalMs) state.reversals++;
        state.roseAt = -Infinity;
        setTier(lowerTier(tier));
      }}
      onIncline={() => {
        const state = watch.current;
        if (!judging() || tier === ceiling || state.reversals >= maxReversals) return;
        state.roseAt = performance.now();
        setTier(raiseTier(tier, ceiling));
      }}
      // Judge over four seconds, and only step for a clear and sustained change
      ms={sampleMs}
      iterations={judgeSamples}
      bounds={(refreshRate) => (refreshRate > 90 ? [48, 84] : [42, 56])}
    />
  );
}

export interface WorldCanvasProps {
  station: StationKey;
  theme: WorldTheme;
  /** `still` draws on demand, `calm` draws every frame with the camera cutting between stations */
  motion: MotionLevel;
  lite: boolean;
  content: WorldContent;
  /** Index of the project whose screen faces the camera, -1 for none */
  focusProject: number;
  onReady: () => void;
}

export default function WorldCanvas({
  station: pageStation,
  theme,
  motion,
  lite,
  content,
  focusProject,
  onReady,
}: WorldCanvasProps) {
  // The tour flies its own route; explore mode can reach every station
  const { mode, tourStop } = useWorldMode();
  const station = mode === 'tour' ? tourStops[tourStop] : pageStation;

  // The station the visitor is about to fly to mounts (and warms) ahead of
  // the click, once the page is idle: not while the loading screen is up,
  // and only once the intent has stood a moment (see intentSettle)
  const intent = useSyncExternalStore(onIntent, readIntent, noIntent);
  const booted = useBooted();
  const [warming, setWarming] = useState<StationKey | ''>('');
  useEffect(() => {
    if (!intent || !booted) return;
    const w = window as IdleWindow;
    let idle = 0;
    // A transition, so a click that comes in the meantime cuts in
    const warm = () => startTransition(() => setWarming(intent));
    const timer = window.setTimeout(() => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(warm, { timeout: 1000 });
      else warm();
    }, intentSettle);
    return () => {
      window.clearTimeout(timer);
      if (idle) w.cancelIdleCallback?.(idle);
    };
  }, [intent, booted]);

  // Stations mount the first time they are visited and stay mounted so flights
  // back to them are seamless; unvisited stations cost nothing. The tour
  // warms the next stop while it lingers at this one; a page, the station
  // the visitor is about to fly to.
  const [visited, setVisited] = useState<StationKey[]>([station]);
  const wanted =
    mode === 'tour' ? [station, tourStops[(tourStop + 1) % tourStops.length]] : [station];
  if (warming) wanted.push(warming);
  const missing = wanted.filter((key) => !visited.includes(key));
  if (missing.length) setVisited([...visited, ...missing]);

  // Explore mode can reach every station, and the derelict is one of its
  // hidden signals: mount the rest one at a time, so their downloads and
  // warm-ups queue up instead of landing together
  const allMounted = roamable.every((key) => visited.includes(key));
  useEffect(() => {
    if (mode !== 'explore' || allMounted) return;
    const id = window.setInterval(() => {
      setVisited((current) => {
        const next = roamable.find((key) => !current.includes(key));
        return next ? [...current, next] : current;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [mode, allMounted]);
  // The signals hidden out in the world, from the first free roam on
  const [roamed, setRoamed] = useState(false);
  if (mode === 'explore' && !roamed) setRoamed(true);

  // Phones / touch devices start (and top out) one tier down
  const ceiling: QualityTier = lite ? 'medium' : 'high';
  const [tier, setTier] = useState<QualityTier>(ceiling);
  const { dpr } = tierSettings[tier];

  useEffect(() => {
    document.documentElement.dataset.worldTier = tier;
  }, [tier]);
  const palette = palettes[theme];
  const has = (key: StationKey) => visited.includes(key);
  // Shadows are decided once: switching them later would recompile every lit material
  const [shadows] = useState(!lite);

  useEffect(() => setHullTheme(theme), [theme]);

  // Shader compiles, the nebula bake and texture uploads run before the first
  // frame is drawn (the canvas is paused and hidden until then) and before
  // new stations or models show, so none of them stalls a visible frame.
  const [tracker] = useState(createWarmupTracker);
  const [warm, setWarm] = useState(false);
  const onWarm = useCallback(() => setWarm(true), []);

  useEffect(() => {
    if (!warm) return;
    // Two frames: the first draws, the second is on screen
    const id = requestAnimationFrame(() => requestAnimationFrame(() => onReady()));
    return () => cancelAnimationFrame(id);
  }, [warm, onReady]);

  // The loading screen: progress from asset downloads and warm-up work, and
  // ready once the first view is drawn with nothing loading or warming up
  useEffect(() => {
    // Only on the first load (switching the world back on later has no screen)
    if (bootState().ready) return;
    reportBoot(0.2, 1);
    let calm = 0;
    const id = window.setInterval(() => {
      const work = tracker.counts();
      const units = downloads.total + work.started;
      const done = downloads.loaded + work.settled;
      reportBoot(0.2 + 0.78 * (units ? done / units : 0), downloads.busy ? 2 : 3);
      // Settled for a moment: a finished download's warm-up registers a frame or two later
      calm = warm && !downloads.busy && tracker.idle() ? calm + 1 : 0;
      if (calm >= 3) {
        window.clearInterval(id);
        readyBoot();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [tracker, warm]);

  // Paused while page chrome covers the world (it is opaque: nothing to see).
  // Still: drawn only when something changes, except in free roam, where the
  // visitor flies the camera (and the autopilot needs every frame)
  const covered = useSyncExternalStore(onChrome, isCovered, notCovered);
  const frameloop =
    !warm || covered ? 'never' : motion === 'still' && mode !== 'explore' ? 'demand' : 'always';

  return (
    <Canvas
      className="world__canvas"
      dpr={[1, dpr]}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: baseFov, near: 0.1, far: 2000, position: [0, 0, 60] }}
      frameloop={frameloop}
      shadows={shadows ? 'percentage' : false}
      // The canvas sits behind the page: listen on the document, react only
      // over open space. No eventPrefix: it would replace worldEvents' compute,
      // which makes that check (and maps the pointer from client coordinates)
      events={worldEvents}
      eventSource={document.body}
      onCreated={({ gl }) => {
        // Reading every shader's info log on first use is a synchronous round
        // trip to the GPU process per shader; keep it for development only
        gl.debug.checkShaderErrors = process.env.NODE_ENV !== 'production';
      }}
    >
      <WarmupProvider tracker={tracker}>
        <LiteContext.Provider value={lite}>
          <color attach="background" args={[palette.background]} />
          <fog attach="fog" args={[palette.background, palette.fog[0], palette.fog[1]]} />
          <QualityGovernor tier={tier} ceiling={ceiling} setTier={setTier} />
          <CoverPause covered={covered} />
          {frameloop === 'demand' && (
            <DemandDriver station={station} theme={theme} focusProject={focusProject} />
          )}

          <CameraRig station={station} motion={motion} />
          <TipProbe />
          <ExploreControls />
          <MotionProbe motion={motion} />
          <Cockpit theme={theme} />
          <Sparks theme={theme} />
          <PowerDriver />

          <Lighting theme={theme} station={station} shadows={shadows} />

          <Nebula theme={theme} octaves={lite ? 4 : 5} size={lite ? 1024 : 3072} />
          <Starfield count={lite ? 1800 : 4200} theme={theme} />
          <BrightStars count={lite ? 24 : 48} theme={theme} />
          <Landmarks theme={theme} />
          <Asteroids count={lite ? 120 : 300} theme={theme} />
          <Dust count={lite ? 260 : 600} theme={theme} />
          <GasClouds count={lite ? 22 : 44} theme={theme} tier={tier} />
          <Traffic count={lite ? 3 : 8} theme={theme} tier={tier} />

          {has('home') && (
            <Precompiled>
              <HomeStation theme={theme} />
            </Precompiled>
          )}
          {has('about') && (
            <Precompiled>
              <AboutStation theme={theme} />
            </Precompiled>
          )}
          {has('experience') && (
            <Precompiled>
              <ExperienceStation theme={theme} roles={content.roles} />
            </Precompiled>
          )}
          {has('projects') && (
            <Precompiled>
              <ProjectsStation theme={theme} projects={content.projects} focus={focusProject} />
            </Precompiled>
          )}
          {has('skills') && (
            <Precompiled>
              <SkillsStation
                theme={theme}
                skills={content.skills}
                categories={content.categories}
              />
            </Precompiled>
          )}
          {has('contact') && (
            <Precompiled>
              <ContactStation theme={theme} />
            </Precompiled>
          )}
          {has('lost') && (
            <Precompiled>
              <LostStation theme={theme} />
            </Precompiled>
          )}

          {roamed && (
            <Precompiled>
              <Signals theme={theme} />
            </Precompiled>
          )}

          <Beacons theme={theme} current={station} />
          <CourseLine theme={theme} />
          <HeadingProjector theme={theme} station={station} />
          <DockingBeam theme={theme} />
          <EdgeShimmer theme={theme} />
          <Pings theme={theme} />
          <StatsProbe station={station} />
          <Effects theme={theme} tier={tier} />
          {/* Last, so every sibling has mounted and queued its own warm-up first */}
          <WarmupGate onWarm={onWarm} />
        </LiteContext.Provider>
      </WarmupProvider>
    </Canvas>
  );
}
