import { useSyncExternalStore } from 'react';

import { worldMode } from 'components/World/worldMode';
import { onCue, onFlight, worldStore } from 'components/World/worldStore';
import { buildSpace, cueOut, listen, roam, stationVoices, voiceAt } from './spatial';

import type { StationKey } from 'components/World/routes';
import type { Cue, CueDetail } from 'components/World/worldStore';
import type { Space } from './spatial';

/* ------------------------------------------------------------------
   Optional sound, off unless the visitor turns it on (header toggle,
   the command palette or the loading screen). Everything is synthesised
   with Web Audio, so there is nothing to download: a quiet bed (a low
   drone and a breath of cabin air) under every station's own voice,
   heard from where the camera is (spatial.ts); a rush of filtered noise
   that follows the camera's speed (flights, free roam); a swell as a
   flight sets off and a chime in the destination's chord as it docks;
   and short cues for what happens in the world (worldStore `emitCue`):
   HUD blips, clicks and tricks, docking clamps, stations powering up,
   signals found, the rocket and the comms array transmitting. A cue
   that happens somewhere in the world (`CueDetail.at`) plays from there;
   the HUD's and the page's own cues play centred.

   Browsers only start audio from a click or key press, so the toggle
   starts it, and a returning visitor who left it on hears it from their
   first interaction with the page. It pauses while the tab is hidden.
   ------------------------------------------------------------------ */

const storageKey = 'sound';
/** Camera speed (world units per second) at which the rush peaks */
const fullRush = 75;

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  rush: GainNode;
  rushFilter: BiquadFilterNode;
  noise: AudioBuffer;
  /** The header HUD's hum, silent until it says so (worldStore.hudHum) */
  hum: GainNode;
  /** The stations' voices and the listener riding the camera */
  space: Space;
}

let engine: Engine | null = null;
let wanted: boolean | undefined;
let frame = 0;
let lastFrame = 0;
let armed = false;
/** The context is starting up: cues wait for it rather than going unheard */
let waking: Promise<void> | null = null;
const listeners = new Set<() => void>();

function readWanted() {
  if (wanted !== undefined) return wanted;
  try {
    wanted = localStorage.getItem(storageKey) === 'on';
  } catch {
    wanted = false;
  }
  return wanted;
}

/** Four seconds of brown noise: the raw material for the bed, rush and bursts */
function brownNoise(ctx: AudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function loopNoise(e: Pick<Engine, 'ctx' | 'noise'>, offset: number) {
  const source = e.ctx.createBufferSource();
  source.buffer = e.noise;
  source.loop = true;
  source.start(0, offset);
  return source;
}

function build(): Engine {
  const ctx = new AudioContext();
  const noise = brownNoise(ctx);
  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 6;
  master.connect(limiter).connect(ctx.destination);

  // The bed: low fifths on A through a lowpass that slowly breathes, under
  // the stations' voices
  const drone = ctx.createGain();
  drone.gain.value = 0.022;
  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.value = 240;
  warmth.connect(drone).connect(master);
  for (const [type, frequency, level] of [
    ['sine', 55, 1],
    ['triangle', 82.6, 0.55],
    ['sine', 110.4, 0.3],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = level;
    osc.connect(gain).connect(warmth);
    osc.start();
  }
  const breath = ctx.createOscillator();
  breath.frequency.value = 0.07;
  const depth = ctx.createGain();
  depth.gain.value = 90;
  breath.connect(depth).connect(warmth.frequency);
  breath.start();

  // A faint bed of noise, like air in a cabin
  const bed = ctx.createBiquadFilter();
  bed.type = 'bandpass';
  bed.frequency.value = 480;
  bed.Q.value = 0.7;
  const bedLevel = ctx.createGain();
  bedLevel.gain.value = 0.013;
  loopNoise({ ctx, noise }, 0).connect(bed).connect(bedLevel).connect(master);

  // The rush of speed, silent at rest
  const rushFilter = ctx.createBiquadFilter();
  rushFilter.type = 'bandpass';
  rushFilter.frequency.value = 260;
  rushFilter.Q.value = 0.9;
  const rush = ctx.createGain();
  rush.gain.value = 0;
  loopNoise({ ctx, noise }, 1.7).connect(rushFilter).connect(rush).connect(master);

  // The header HUD's hum: a soft mains-like buzz with a slow waver
  const hum = ctx.createGain();
  hum.gain.value = 0;
  const humTone = ctx.createBiquadFilter();
  humTone.type = 'lowpass';
  humTone.frequency.value = 700;
  humTone.connect(hum).connect(master);
  for (const [type, frequency, level] of [
    ['triangle', 100, 1],
    ['sine', 200, 0.5],
    ['sawtooth', 300, 0.08],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = level;
    osc.connect(gain).connect(humTone);
    osc.start();
  }

  const space = buildSpace(ctx, master);
  roam(space, ctx, worldMode.get().mode === 'explore');

  return { ctx, master, rush, rushFilter, noise, hum, space };
}

/**
 * Every animation frame while sound is on and the tab is visible: the rush
 * follows the camera's speed, the hum the header HUD, and the listener the
 * camera
 */
function follow(time: number) {
  frame = requestAnimationFrame(follow);
  if (!engine || engine.ctx.state !== 'running') return;
  const dt = lastFrame ? Math.min((time - lastFrame) / 1000, 0.25) : 0;
  lastFrame = time;
  const speed = Math.min(worldStore.velocity / fullRush, 1);
  const now = engine.ctx.currentTime;
  engine.rush.gain.setTargetAtTime(0.16 * speed ** 1.4, now, 0.15);
  engine.rushFilter.frequency.setTargetAtTime(220 + 1600 * speed, now, 0.2);
  engine.hum.gain.setTargetAtTime(0.012 * worldStore.hudHum, now, 0.3);
  listen(engine.space, engine.ctx, dt);
}

function loop(on: boolean) {
  cancelAnimationFrame(frame);
  lastFrame = 0;
  if (on) frame = requestAnimationFrame(follow);
}

function wake(ctx: AudioContext) {
  const resumed = ctx
    .resume()
    .catch(() => undefined)
    .then(() => {
      if (waking === resumed) waking = null;
    });
  waking = resumed;
}

/**
 * Starts (or restarts) the sound. From inside a click or key press, so the
 * browser lets the context run: the loading screen's "launch with sound"
 * calls it just before the screen lifts, and the warp in's swell waits for
 * the context rather than being dropped
 */
function start() {
  armed = true;
  wire();
  engine ??= build();
  const { ctx, master, space } = engine;
  // Hear from wherever the camera is now, rather than gliding over from where it was
  space.ear.primed = false;
  wake(ctx);
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0.8, ctx.currentTime, 0.25);
  loop(!document.hidden);
}

function stop() {
  loop(false);
  if (!engine) return;
  const { ctx, master } = engine;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  window.setTimeout(() => {
    if (!readWanted()) void ctx.suspend();
  }, 600);
}

/* ---------------------------------- Cues ---------------------------------- */

/** Where a sound plays into: the master bus (centred), or a panner placing it in the world */
interface Out {
  e: Engine;
  to: AudioNode;
}

/** A note (gliding to `glideTo` if given), swelling in over `attack` seconds and dying away */
function tone(
  o: Out,
  at: number,
  frequency: number,
  duration: number,
  level: number,
  type: OscillatorType = 'sine',
  glideTo?: number,
  attack = 0.012
) {
  const { ctx } = o.e;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(o.to);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

/** A breath of filtered noise, its filter sweeping from `from` to `to` Hz */
function burst(
  o: Out,
  at: number,
  duration: number,
  level: number,
  filter: BiquadFilterType,
  from: number,
  to = from,
  attack = 0.01
) {
  const { ctx, noise } = o.e;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const shape = ctx.createBiquadFilter();
  shape.type = filter;
  shape.frequency.setValueAtTime(from, at);
  shape.frequency.exponentialRampToValueAtTime(to, at + duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(shape).connect(gain).connect(o.to);
  source.start(at, Math.random() * 3);
  source.stop(at + duration + 0.05);
}

/** A sound starting at context time `at` (a cue gets what was emitted with it) */
type Sound = (o: Out, at: number, detail?: CueDetail) => void;

const silent: Sound = () => undefined;

const cues: Record<Cue, Sound> = {
  blip: (o, at) => tone(o, at, 1046, 0.09, 0.05, 'sine', 1318),
  select: (o, at) => {
    tone(o, at, 659, 0.12, 0.06, 'triangle');
    tone(o, at + 0.09, 988, 0.18, 0.06, 'triangle');
  },
  proximity: (o, at) => {
    tone(o, at, 523, 0.16, 0.045);
    tone(o, at + 0.13, 784, 0.26, 0.045);
  },
  dock: (o, at) => {
    tone(o, at, 120, 0.45, 0.28, 'sine', 40);
    burst(o, at, 0.09, 0.12, 'highpass', 1800);
    burst(o, at + 0.5, 0.18, 0.1, 'bandpass', 900, 700);
    tone(o, at + 0.52, 70, 0.3, 0.2, 'sine', 45);
    burst(o, at + 0.7, 0.9, 0.035, 'highpass', 3000, 6000, 0.05);
  },
  found: (o, at) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) =>
      tone(o, at + i * 0.09, frequency, 0.7, 0.055, 'triangle')
    );
    tone(o, at + 0.36, 2093, 0.9, 0.012);
  },
  complete: (o, at) => {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, i) =>
      tone(o, at + i * 0.11, frequency, 1.3, 0.05, 'triangle')
    );
  },
  launch: (o, at) => {
    burst(o, at, 4.2, 0.4, 'lowpass', 90, 900, 0.5);
    tone(o, at, 46, 3.6, 0.22, 'sine', 30);
  },
  transmit: (o, at) => {
    for (let i = 0; i < 14; i++) {
      tone(o, at + i * 0.075, 1200 + Math.random() * 1400, 0.035, 0.022, 'square');
    }
  },
  // The header HUD: a tick under the pointer, a click, the brackets locking
  // onto a page, and powering on
  'hud-hover': (o, at) => tone(o, at, 2400, 0.035, 0.01, 'sine', 2900),
  'hud-click': (o, at) => {
    tone(o, at, 900, 0.05, 0.025, 'square', 600);
    burst(o, at, 0.04, 0.03, 'highpass', 3500);
  },
  'hud-lock': (o, at) => {
    tone(o, at, 1320, 0.04, 0.025, 'square');
    tone(o, at + 0.06, 1760, 0.12, 0.03, 'sine', 2093);
  },
  'hud-boot': (o, at) => {
    tone(o, at, 160, 0.7, 0.04, 'sawtooth', 640);
    burst(o, at + 0.05, 0.55, 0.025, 'bandpass', 900, 5200, 0.2);
    tone(o, at + 0.62, 1568, 0.18, 0.025, 'triangle');
  },
  // Something in 3D clicked: a sonar ping and its echo
  ping: (o, at) => {
    tone(o, at, 1760, 0.6, 0.035, 'sine', 1700);
    tone(o, at + 0.17, 1760, 0.5, 0.01, 'sine', 1700);
  },
  // A barrel roll, a helmet spin: a whoosh round, a zip up and a sparkle
  trick: (o, at) => {
    burst(o, at, 0.6, 0.05, 'bandpass', 450, 2800, 0.2);
    tone(o, at, 329.63, 0.45, 0.02, 'triangle', 987.77, 0.08);
    tone(o, at + 0.38, 1318.5, 0.35, 0.014);
    tone(o, at + 0.46, 1760, 0.45, 0.012);
  },
  // Free roam: a hull bumped, a dull thud through the frame
  bump: (o, at) => {
    tone(o, at, 82, 0.42, 0.3, 'sine', 34);
    burst(o, at, 0.3, 0.16, 'lowpass', 420, 80, 0.004);
    burst(o, at + 0.03, 0.14, 0.012, 'bandpass', 1300, 900);
  },
  // A station powering up as the camera arrives: a relay, then a hum
  // spooling up two octaves with a whine above it, settling on A
  power: (o, at) => {
    tone(o, at, 62, 0.25, 0.07, 'sine', 48);
    burst(o, at, 0.05, 0.02, 'highpass', 2600);
    tone(o, at + 0.05, 55, 1.2, 0.04, 'triangle', 220, 0.9);
    tone(o, at + 0.05, 55, 1.2, 0.008, 'sawtooth', 220, 0.9);
    tone(o, at + 0.1, 440, 1.1, 0.006, 'sine', 1760, 0.85);
    tone(o, at + 1.1, 220, 0.7, 0.02, 'triangle');
  },
  // The command palette opening: a hologram fizzing up
  palette: (o, at) => {
    tone(o, at, 659.25, 0.16, 0.028, 'sine', 880);
    tone(o, at + 0.07, 1318.5, 0.32, 0.014, 'triangle');
    burst(o, at, 0.18, 0.012, 'highpass', 2400, 5200, 0.07);
  },
  // The theme switching: a click, then up into the light or down into the
  // dark (read once the switch has landed on the page)
  theme: (o) => {
    window.setTimeout(() => {
      if (!readWanted() || o.e.ctx.state !== 'running') return;
      const at = o.e.ctx.currentTime + 0.01;
      const light = document.documentElement.dataset.theme === 'light';
      burst(o, at, 0.03, 0.03, 'highpass', 3800);
      (light ? [440, 659.25, 880] : [880, 659.25, 440]).forEach((frequency, i) =>
        tone(o, at + 0.03 + i * 0.06, frequency, 0.4, 0.02, light ? 'triangle' : 'sine')
      );
    }, 40);
  },
  // Not voiced yet: the cues exist so the world can emit them
  tick: silent,
  pod: silent,
  sonar: silent,
  scan: silent,
  arrive: silent,
  edge: silent,
  hail: silent,
};

/** The fewest seconds between two of the same cue (a scrape along a hull bumps every frame) */
const spacing: Partial<Record<Cue, number>> = { bump: 0.35, ping: 0.06, trick: 0.3 };
const lastPlayed: Partial<Record<Cue, number>> = {};

/**
 * The HUD's and the page's own cues: they belong to the visitor's view,
 * not to anywhere in the world, so they play centred even when emitted
 * with a place
 */
const centred = new Set<Cue>([
  'hud-hover',
  'hud-click',
  'hud-lock',
  'hud-boot',
  'palette',
  'theme',
  'select',
  'blip',
]);

/** Roughly how long each placed cue rings (seconds), so its panner isn't moved while it does */
const tails: Partial<Record<Cue, number>> = {
  dock: 1.7,
  found: 1.4,
  complete: 1.9,
  launch: 4.3,
  power: 1.9,
};

type Where = readonly [number, number, number];

/**
 * Plays a sound now, or once a context that is starting up is running:
 * from `where` in the world (for `tail` seconds), or centred
 */
function schedule(sound: Sound, where?: Where, tail = 1, detail?: CueDetail) {
  if (!engine || !readWanted()) return;
  const run = () => {
    if (!engine || !readWanted() || engine.ctx.state !== 'running') return;
    const at = engine.ctx.currentTime + 0.01;
    const to = where ? cueOut(engine.space, where, at, tail) : engine.master;
    sound({ e: engine, to }, at, detail);
  };
  if (engine.ctx.state === 'running') run();
  else if (waking) void waking.then(run);
}

function play(cue: Cue, detail?: CueDetail) {
  const now = performance.now() / 1000;
  if (now - (lastPlayed[cue] ?? -Infinity) < (spacing[cue] ?? 0)) return;
  lastPlayed[cue] = now;
  const where = centred.has(cue) ? undefined : detail?.at;
  schedule(cues[cue], where, tails[cue], detail);
}

/* --------------------------------- Flights --------------------------------- */

/** A flight sets off: a rising whoosh of filtered noise over a low drop, the drive spooling up */
const swell: Sound = (o, at) => {
  burst(o, at, 1.7, 0.075, 'bandpass', 160, 2600, 0.85);
  tone(o, at, 92, 1.3, 0.1, 'sine', 38, 0.06);
  tone(o, at + 0.3, 880, 1.1, 0.006, 'sine', 1760, 0.6);
};

/**
 * Docked: soft clamps, then the station's own chord two octaves up as a
 * chime, played from the station
 */
function arrival(key: StationKey): Sound {
  return (o, at) => {
    burst(o, at, 0.08, 0.03, 'bandpass', 1100, 650, 0.004);
    tone(o, at, 110, 0.28, 0.06, 'sine', 62);
    const { notes, detune } = stationVoices[key];
    const from = { e: o.e, to: cueOut(o.e.space, voiceAt(o.e.space, key), at, 1.5) };
    notes.forEach((frequency, i) =>
      tone(
        from,
        at + 0.1 + i * 0.07,
        frequency * 4 * 2 ** (detune[i] / 1200),
        1.2,
        0.016,
        'triangle'
      )
    );
  };
}

let lastSwell = -Infinity;

function flightSound(event: 'start' | 'approach' | 'end', to: string) {
  if (event === 'start') {
    // A change of course mid-flight sets off again: one swell is enough
    const now = performance.now() / 1000;
    if (now - lastSwell < 0.4) return;
    lastSwell = now;
    schedule(swell);
  } else if (event === 'end' && to in stationVoices) {
    schedule(arrival(to as StationKey));
  }
}

/* ------------------------------ Turning it on ------------------------------ */

function setSound(on: boolean) {
  wanted = on;
  try {
    if (on) localStorage.setItem(storageKey, 'on');
    else localStorage.removeItem(storageKey);
  } catch {
    // Storage blocked: the choice lasts until reload
  }
  if (on) {
    start();
    play('select');
  } else {
    stop();
  }
  listeners.forEach((listener) => listener());
}

let wired = false;

/**
 * Hooks the engine up to the world's cues, flights and mode and the tab's
 * visibility, and arms a returning visitor's sound to start on their first
 * interaction. Runs once, from the toggle (or whatever starts the sound).
 */
function wire() {
  if (wired) return;
  wired = true;
  onCue(play);
  onFlight(flightSound);
  worldMode.subscribe(() => {
    if (engine) roam(engine.space, engine.ctx, worldMode.get().mode === 'explore');
  });
  document.addEventListener('visibilitychange', () => {
    if (!engine || !readWanted()) return;
    loop(!document.hidden);
    if (document.hidden) void engine.ctx.suspend();
    else wake(engine.ctx);
  });
  if (readWanted() && !armed) {
    armed = true;
    const begin = () => {
      window.removeEventListener('pointerdown', begin, true);
      window.removeEventListener('keydown', begin, true);
      if (readWanted()) start();
    };
    window.addEventListener('pointerdown', begin, true);
    window.addEventListener('keydown', begin, true);
  }
}

const subscribe = (listener: () => void) => {
  wire();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const serverOff = () => false;

/** Whether the visitor has sound on, and a toggle (call it from a click) */
export function useSound() {
  const on = useSyncExternalStore(subscribe, readWanted, serverOff);
  return { on, setSound };
}

export const soundOn = readWanted;
export { setSound };
