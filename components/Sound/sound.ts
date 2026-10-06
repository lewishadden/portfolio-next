import { useSyncExternalStore } from 'react';

import { onCue, worldStore } from 'components/World/worldStore';

import type { Cue } from 'components/World/worldStore';

/* ------------------------------------------------------------------
   Optional sound, off unless the visitor turns it on (header toggle or
   the command palette). Everything is synthesised with Web Audio, so
   there is nothing to download: a low drone with a breathing noise bed
   for the ambience, a rush of filtered noise that follows the camera's
   speed (flights, free roam), and short cues for what happens in the
   world (worldStore `emitCue`): HUD blips, docking clamps, signals
   found, the rocket and the comms array transmitting.

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
}

let engine: Engine | null = null;
let wanted: boolean | undefined;
let frame = 0;
let armed = false;
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

  // Drone: low fifths through a lowpass that slowly breathes
  const drone = ctx.createGain();
  drone.gain.value = 0.045;
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
  bedLevel.gain.value = 0.018;
  loopNoise({ ctx, noise }, 0).connect(bed).connect(bedLevel).connect(master);

  // The rush of speed, silent at rest
  const rushFilter = ctx.createBiquadFilter();
  rushFilter.type = 'bandpass';
  rushFilter.frequency.value = 260;
  rushFilter.Q.value = 0.9;
  const rush = ctx.createGain();
  rush.gain.value = 0;
  loopNoise({ ctx, noise }, 1.7).connect(rushFilter).connect(rush).connect(master);

  return { ctx, master, rush, rushFilter, noise };
}

/** Follows the camera's speed with the rush, every frame while sound is on */
function follow() {
  frame = requestAnimationFrame(follow);
  if (!engine) return;
  const speed = Math.min(worldStore.velocity / fullRush, 1);
  const now = engine.ctx.currentTime;
  engine.rush.gain.setTargetAtTime(0.16 * speed ** 1.4, now, 0.15);
  engine.rushFilter.frequency.setTargetAtTime(220 + 1600 * speed, now, 0.2);
}

function start() {
  engine ??= build();
  const { ctx, master } = engine;
  void ctx.resume();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0.8, ctx.currentTime, 0.25);
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(follow);
}

function stop() {
  cancelAnimationFrame(frame);
  if (!engine) return;
  const { ctx, master } = engine;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  window.setTimeout(() => {
    if (!readWanted()) void ctx.suspend();
  }, 600);
}

/* ---------------------------------- Cues ---------------------------------- */

function tone(
  e: Engine,
  at: number,
  frequency: number,
  duration: number,
  level: number,
  type: OscillatorType = 'sine',
  glideTo?: number
) {
  const osc = e.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + duration);
  const gain = e.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(e.master);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

function burst(
  e: Engine,
  at: number,
  duration: number,
  level: number,
  filter: BiquadFilterType,
  from: number,
  to = from,
  attack = 0.01
) {
  const source = e.ctx.createBufferSource();
  source.buffer = e.noise;
  const shape = e.ctx.createBiquadFilter();
  shape.type = filter;
  shape.frequency.setValueAtTime(from, at);
  shape.frequency.exponentialRampToValueAtTime(to, at + duration);
  const gain = e.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(shape).connect(gain).connect(e.master);
  source.start(at, Math.random() * 3);
  source.stop(at + duration + 0.05);
}

const cues: Record<Cue, (e: Engine, at: number) => void> = {
  blip: (e, at) => tone(e, at, 1046, 0.09, 0.05, 'sine', 1318),
  select: (e, at) => {
    tone(e, at, 659, 0.12, 0.06, 'triangle');
    tone(e, at + 0.09, 988, 0.18, 0.06, 'triangle');
  },
  proximity: (e, at) => {
    tone(e, at, 523, 0.16, 0.045);
    tone(e, at + 0.13, 784, 0.26, 0.045);
  },
  dock: (e, at) => {
    tone(e, at, 120, 0.45, 0.28, 'sine', 40);
    burst(e, at, 0.09, 0.12, 'highpass', 1800);
    burst(e, at + 0.5, 0.18, 0.1, 'bandpass', 900, 700);
    tone(e, at + 0.52, 70, 0.3, 0.2, 'sine', 45);
    burst(e, at + 0.7, 0.9, 0.035, 'highpass', 3000, 6000, 0.05);
  },
  found: (e, at) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) =>
      tone(e, at + i * 0.09, frequency, 0.7, 0.055, 'triangle')
    );
    tone(e, at + 0.36, 2093, 0.9, 0.012);
  },
  complete: (e, at) => {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, i) =>
      tone(e, at + i * 0.11, frequency, 1.3, 0.05, 'triangle')
    );
  },
  launch: (e, at) => {
    burst(e, at, 4.2, 0.4, 'lowpass', 90, 900, 0.5);
    tone(e, at, 46, 3.6, 0.22, 'sine', 30);
  },
  transmit: (e, at) => {
    for (let i = 0; i < 14; i++) {
      tone(e, at + i * 0.075, 1200 + Math.random() * 1400, 0.035, 0.022, 'square');
    }
  },
};

function play(cue: Cue) {
  if (!engine || !readWanted() || engine.ctx.state !== 'running') return;
  cues[cue](engine, engine.ctx.currentTime + 0.01);
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
 * Hooks the engine up to the world's cues and the tab's visibility, and
 * arms a returning visitor's sound to start on their first interaction.
 * Runs once, from the toggle.
 */
function wire() {
  if (wired) return;
  wired = true;
  onCue(play);
  document.addEventListener('visibilitychange', () => {
    if (!engine || !readWanted()) return;
    if (document.hidden) void engine.ctx.suspend();
    else void engine.ctx.resume();
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
