import { liteQuery, stationForPath, stationKeys, stationPositions } from 'components/World/routes';
import { worldMode } from 'components/World/worldMode';
import { worldStore } from 'components/World/worldStore';
import { motionLevel } from '@/utils/motion';

import type { StationKey } from 'components/World/routes';

/* ------------------------------------------------------------------
   Sound in space (sound.ts builds it into its engine). The listener
   rides the camera, and every station sings where it floats: a soft
   chord of its own, breathing slowly, through a positional panner
   (HRTF; equal power on phones and touch devices, where seven HRTF
   convolvers are a lot for the audio thread and the speakers can't
   place a sound anyway). The chords are all drawn from A major
   pentatonic (A B C♯ E F♯), the key of the bed under them, so voices
   that overlap mid-flight still agree. Docked at a station (11–16 units
   off) its voice is the one you hear; its neighbours, 60–100 units
   away, are faint, so a flight crossfades one into the next and pans
   them as the camera turns. The 404 derelict's voice is off key,
   detuned and warbling, and only sounds on its own page and in free
   roam. A station that isn't fully powered (worldStore.charge: standby,
   or surging as it powers up) sings quieter, or louder, with it. With
   the world off there is no camera: the listener sits at the page's
   station and glides to the next one on navigation.

   Cues that happen somewhere (a click on a hull, a station powering up,
   a signal found) play through a small pool of panners placed where they
   happen (cueOut); the HUD's and the page's own cues stay centred. Near
   a hull, on desktop, the placed cues ring on in a short reverb (a
   convolver with a procedural 1.8s tail), which fades out in open space.
   ------------------------------------------------------------------ */

export interface VoiceSpec {
  /** The chord, in Hz */
  notes: readonly [number, number, number];
  waves: readonly [OscillatorType, OscillatorType, OscillatorType];
  /** Each note's detune in cents: a few apart, so they beat gently */
  detune: readonly [number, number, number];
  /** Lowpass cutoff (Hz) the breath sways round, and its resonance */
  tone: number;
  resonance: number;
  /** Breaths per second */
  breath: number;
  /** Loudness, relative to the other voices */
  level: number;
  /** How far the pitch warbles with the breath, in cents */
  warble?: number;
  /** Where the voice sits from the station's origin: tall stations sing from their middle */
  offset?: readonly [number, number, number];
}

export const stationVoices: Record<StationKey, VoiceSpec> = {
  // Asus2: open, the way in
  home: {
    notes: [110, 164.81, 246.94],
    waves: ['sine', 'triangle', 'sine'],
    detune: [-3, 2, 4],
    tone: 560,
    resonance: 0.5,
    breath: 0.07,
    level: 1,
  },
  // F♯ minor: warm, human
  about: {
    notes: [92.5, 138.59, 220],
    waves: ['triangle', 'sine', 'sine'],
    detune: [2, -4, 3],
    tone: 520,
    resonance: 0.5,
    breath: 0.055,
    level: 1.15,
  },
  // Esus2, low and steady, from halfway down the beam
  experience: {
    notes: [82.41, 123.47, 185],
    waves: ['sine', 'triangle', 'triangle'],
    detune: [-2, 3, -5],
    tone: 480,
    resonance: 0.6,
    breath: 0.09,
    level: 1.1,
    offset: [0, -17, 0],
  },
  // C♯m7, brighter and busier, from the middle of the helix
  projects: {
    notes: [138.59, 164.81, 246.94],
    waves: ['triangle', 'triangle', 'sine'],
    detune: [3, -3, 5],
    tone: 820,
    resonance: 0.7,
    breath: 0.11,
    level: 0.9,
    offset: [0, -6, 0],
  },
  // Bsus2, higher and curious
  skills: {
    notes: [123.47, 185, 277.18],
    waves: ['sine', 'triangle', 'sine'],
    detune: [-4, 2, 3],
    tone: 700,
    resonance: 0.6,
    breath: 0.08,
    level: 0.95,
  },
  // A major, spread wide: a signal going out
  contact: {
    notes: [110, 277.18, 329.63],
    waves: ['sine', 'sine', 'triangle'],
    detune: [2, -3, 4],
    tone: 900,
    resonance: 0.5,
    breath: 0.065,
    level: 0.95,
  },
  // B♭ and E: a tritone, a semitone off the key, drifting out of tune
  // through a resonant filter that whistles as the breath sweeps it
  lost: {
    notes: [116.54, 164.81, 233.08],
    waves: ['triangle', 'square', 'sine'],
    detune: [-21, 16, 37],
    tone: 380,
    resonance: 6,
    breath: 0.037,
    level: 1.3,
    warble: 28,
  },
};

/** Loudness of a voice at full strength, before its own `level` */
const voiceLevel = 0.016;
/** How much of a voice's loudness rises and falls with its breath */
const swayDepth = 0.35;
/**
 * How the voices fall away (the panner's exponential distance model):
 * full strength within `near` units, then (distance / near) ^ -rolloff,
 * so about 0.46 at 30, 0.12 at 60 (the nearest neighbour) and 0.06 at 90
 */
const near = 20;
const rolloff = 1.9;
/**
 * How placed cues fall away (inverse distance model): full strength within
 * `cueNear` units (a click on a station, a docked station powering up),
 * then gently, so a cue across the sector is quieter but still heard
 */
const cueNear = 20;
const cueRolloff = 1;
/** How many cues can sound from different places at once */
const cuePool = 4;
/**
 * The detector's sonar falls away more gently still: it pings from a
 * signal up to detector range (170 units) away, and is still heard there
 */
const sonarNear = 40;
const sonarRolloff = 0.6;
/** The reverb's tail (seconds), and how loud it is right by a hull */
const reverbTail = 1.8;
const reverbLevel = 0.26;
/** Distances from a station's voice (units) where its hull starts to ring, and rings fully */
const hullFar = 55;
const hullNear = 20;
/** With the world off, how far in front of the page's station the listener sits */
const docked = 14;
/** Seconds the derelict's voice takes to come in or fade away */
const heardTime = 1.2;
/** Seconds a voice takes to follow its station's power */
const powerTime = 0.05;
/** Seconds the listener takes to follow the live camera, and to glide when there isn't one */
const followTime = 0.04;
const glideTime = 1.2;

type Point = readonly [number, number, number];

interface Voice {
  /** The voice's loudness, breathing round its level */
  amp: GainNode;
  /** How far the breath moves `amp` */
  sway: GainNode;
  level: number;
  /** How much of it is heard (0..1, eased): the derelict only on its page and in free roam */
  heard: number;
  /** The loudness `amp` was last set to */
  gain: number;
  panner: PannerNode;
  /** Where it sings from: cues from the station (its chime, its answer to a hail) play from here */
  at: Point;
}

/** One of the panners placed cues play through, and when (context time) its last cue dies away */
interface CuePanner {
  panner: PannerNode;
  busyUntil: number;
}

export interface Space {
  voices: Record<StationKey, Voice>;
  cues: CuePanner[];
  /** The detector's sonar: a panner of its own, set where the nearest unfound signal is */
  sonar: PannerNode;
  /** The reverb near hulls (desktop only): its loudness and the level it was last set to */
  reverb: { wet: GainNode; level: number } | null;
  /** The listener, eased towards the camera (forward is kept a unit vector) */
  ear: { x: number; y: number; z: number; fx: number; fy: number; fz: number; primed: boolean };
  /** The listener has AudioParams (Firefox's and older Safari's only have setPosition) */
  params: boolean;
}

/** AudioParam positions where the browser has them (typed boolean, so TS doesn't narrow the node away) */
const hasParams = (node: object): boolean => 'positionX' in node;

/** Puts a panner at a point, from context time `time` */
function place(panner: PannerNode, [x, y, z]: Point, time: number) {
  if (hasParams(panner)) {
    panner.positionX.setValueAtTime(x, time);
    panner.positionY.setValueAtTime(y, time);
    panner.positionZ.setValueAtTime(z, time);
  } else {
    panner.setPosition(x, y, z);
  }
}

/** HRTF on desktop; equal power on lite devices, where HRTF convolvers are a lot for the audio thread */
function makePanner(ctx: AudioContext, lite: boolean) {
  const panner = ctx.createPanner();
  panner.panningModel = lite ? 'equalpower' : 'HRTF';
  return panner;
}

/** The reverb's impulse: stereo noise dying away over `reverbTail` seconds, darker as it fades */
function hullImpulse(ctx: AudioContext) {
  const length = Math.round(ctx.sampleRate * reverbTail);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Smoothed more as it decays: a hull's ring loses its highs first
      const smooth = 0.15 + 0.8 * t;
      last += (Math.random() * 2 - 1 - last) * (1 - smooth);
      data[i] = last * (1 - t) ** 3 * Math.min(1, i / (ctx.sampleRate * 0.006));
    }
  }
  return impulse;
}

/** Every station's voice, playing into `out` from where it floats, and the panners cues play through */
export function buildSpace(ctx: AudioContext, out: AudioNode): Space {
  const voices = {} as Record<StationKey, Voice>;
  const lite = window.matchMedia(liteQuery).matches;
  for (const key of stationKeys) {
    const spec = stationVoices[key];
    const panner = makePanner(ctx, lite);
    panner.distanceModel = 'exponential';
    panner.refDistance = near;
    panner.rolloffFactor = rolloff;
    const [x, y, z] = stationPositions[key];
    const [ox, oy, oz] = spec.offset ?? [0, 0, 0];
    const at: Point = [x + ox, y + oy, z + oz];
    place(panner, at, 0);
    panner.connect(out);

    // The derelict is silent until tune() lets it in
    const level = voiceLevel * spec.level;
    const heard = key === 'lost' ? 0 : 1;
    const amp = ctx.createGain();
    amp.gain.value = level * heard;
    amp.connect(panner);
    const color = ctx.createBiquadFilter();
    color.type = 'lowpass';
    color.frequency.value = spec.tone;
    color.Q.value = spec.resonance;
    color.connect(amp);

    // One slow breath sways its loudness and opens and closes its filter
    const breath = ctx.createOscillator();
    breath.frequency.value = spec.breath;
    const sway = ctx.createGain();
    sway.gain.value = level * swayDepth * heard;
    breath.connect(sway).connect(amp.gain);
    const open = ctx.createGain();
    open.gain.value = spec.tone * 0.4;
    breath.connect(open).connect(color.frequency);
    let warble: GainNode | null = null;
    if (spec.warble) {
      warble = ctx.createGain();
      warble.gain.value = spec.warble;
      breath.connect(warble);
    }
    breath.start();

    spec.notes.forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      osc.type = spec.waves[i];
      osc.frequency.value = frequency;
      osc.detune.value = spec.detune[i];
      warble?.connect(osc.detune);
      osc.connect(color);
      osc.start();
    });

    voices[key] = { amp, sway, level, heard, gain: level * heard, panner, at };
  }

  // The reverb: placed cues send into it, and it rings louder the nearer a hull is
  let reverb: Space['reverb'] = null;
  let send: AudioNode | null = null;
  if (!lite) {
    const convolver = ctx.createConvolver();
    convolver.buffer = hullImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0;
    convolver.connect(wet).connect(out);
    send = convolver;
    reverb = { wet, level: 0 };
  }

  const cues: CuePanner[] = [];
  for (let i = 0; i < cuePool; i++) {
    const panner = makePanner(ctx, lite);
    panner.distanceModel = 'inverse';
    panner.refDistance = cueNear;
    panner.rolloffFactor = cueRolloff;
    panner.connect(out);
    if (send) panner.connect(send);
    cues.push({ panner, busyUntil: 0 });
  }

  const sonar = makePanner(ctx, lite);
  sonar.distanceModel = 'inverse';
  sonar.refDistance = sonarNear;
  sonar.rolloffFactor = sonarRolloff;
  sonar.connect(out);
  if (send) sonar.connect(send);

  return {
    voices,
    cues,
    sonar,
    reverb,
    ear: { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, primed: false },
    params: hasParams(ctx.listener),
  };
}

/**
 * Where a cue happening at `at` plays into: the pool's panner that falls
 * quiet first, placed there from context time `start` and held for
 * `tail` seconds (how long the cue rings)
 */
export function cueOut(space: Space, at: Point, start: number, tail: number): AudioNode {
  let pick = space.cues[0];
  for (const cue of space.cues) if (cue.busyUntil < pick.busyUntil) pick = cue;
  pick.busyUntil = start + tail;
  place(pick.panner, at, start);
  return pick.panner;
}

/** Where the detector's sonar plays into: its own panner, set at the signal from context time `start` */
export function sonarOut(space: Space, at: Point, start: number): AudioNode {
  place(space.sonar, at, start);
  return space.sonar;
}

/** Where a station's voice sings from: cues from the station itself play from here */
export const voiceAt = (space: Space, key: StationKey) => space.voices[key].at;

/** The station whose voice is nearest a point: whose chord a cue from there plays */
export function stationNear(at: Point): StationKey {
  let best: StationKey = 'home';
  let bestDistance = Infinity;
  for (const key of stationKeys) {
    const [x, y, z] = stationPositions[key];
    const distance = Math.hypot(at[0] - x, at[1] - y, at[2] - z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = key;
    }
  }
  return best;
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** The reverb swells near a hull and fades out in open space */
function ring(space: Space, ctx: AudioContext) {
  const { reverb, ear } = space;
  if (!reverb) return;
  let nearest = Infinity;
  for (const key of stationKeys) {
    const [x, y, z] = space.voices[key].at;
    nearest = Math.min(nearest, Math.hypot(ear.x - x, ear.y - y, ear.z - z));
  }
  const level = reverbLevel * (1 - smoothstep(hullNear, hullFar, nearest));
  if (Math.abs(level - reverb.level) < 0.004) return;
  reverb.level = level;
  reverb.wet.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
}

/**
 * Every animation frame, each voice's loudness: the derelict sings only on
 * its own page (the 404) and in free roam, and a station that isn't fully
 * powered (worldStore.charge, written while the world runs: standby, or
 * up to 1.4 surging as it powers up) sings at 0.2 + 0.8 x its charge
 * (held at 1.3) of its level
 */
function tune(space: Space, ctx: AudioContext, dt: number, live: boolean) {
  const derelict =
    worldMode.get().mode === 'explore' || stationForPath(window.location.pathname) === 'lost';
  const k = 1 - Math.exp(-dt / heardTime);
  const now = ctx.currentTime;
  for (const key of stationKeys) {
    const voice = space.voices[key];
    const heard = key !== 'lost' || derelict ? 1 : 0;
    voice.heard += (heard - voice.heard) * k;
    if (Math.abs(heard - voice.heard) < 1e-3) voice.heard = heard;
    const charge = live ? worldStore.charge[key] : undefined;
    const power = charge === undefined ? 1 : 0.2 + 0.8 * Math.min(Math.max(charge, 0), 1.3);
    const gain = voice.level * voice.heard * power;
    if (Math.abs(gain - voice.gain) < voice.level * 0.004 && (gain > 0 || voice.gain === 0)) {
      continue;
    }
    voice.gain = gain;
    voice.amp.gain.setTargetAtTime(gain, now, powerTime);
    voice.sway.gain.setTargetAtTime(gain * swayDepth, now, powerTime);
  }
}

const aim = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 };

/** Moves the listener after the camera: every animation frame while sound is on */
export function listen(space: Space, ctx: AudioContext, dt: number) {
  const live = document.documentElement.dataset.world === 'on';
  if (live) {
    const { camera } = worldStore;
    aim.x = camera.x;
    aim.y = camera.y;
    aim.z = camera.z;
    aim.fx = camera.fx;
    aim.fy = camera.fy;
    aim.fz = camera.fz;
  } else {
    const [x, y, z] = stationPositions[stationForPath(window.location.pathname)];
    aim.x = x;
    aim.y = y;
    aim.z = z + docked;
    aim.fx = 0;
    aim.fy = 0;
    aim.fz = -1;
  }

  // Close behind a flying camera; a glide (crossfading the voices) when
  // there is none, or it cuts from station to station: below full motion,
  // except in free roam, where the visitor flies it at every level
  const { ear } = space;
  const flown = live && (motionLevel() === 'full' || worldMode.get().mode === 'explore');
  const time = flown ? followTime : glideTime;
  const k = ear.primed ? 1 - Math.exp(-dt / time) : 1;
  ear.primed = true;
  ear.x += (aim.x - ear.x) * k;
  ear.y += (aim.y - ear.y) * k;
  ear.z += (aim.z - ear.z) * k;
  const fx = ear.fx + (aim.fx - ear.fx) * k;
  const fy = ear.fy + (aim.fy - ear.fy) * k;
  const fz = ear.fz + (aim.fz - ear.fz) * k;
  const length = Math.hypot(fx, fy, fz);
  // Looking straight up or down, forward would meet the up vector: hold the last heading
  if (length > 1e-3 && Math.abs(fy / length) < 0.995) {
    ear.fx = fx / length;
    ear.fy = fy / length;
    ear.fz = fz / length;
  }

  const { listener } = ctx;
  if (space.params) {
    const now = ctx.currentTime;
    listener.positionX.setTargetAtTime(ear.x, now, 0.03);
    listener.positionY.setTargetAtTime(ear.y, now, 0.03);
    listener.positionZ.setTargetAtTime(ear.z, now, 0.03);
    listener.forwardX.setTargetAtTime(ear.fx, now, 0.03);
    listener.forwardY.setTargetAtTime(ear.fy, now, 0.03);
    listener.forwardZ.setTargetAtTime(ear.fz, now, 0.03);
  } else {
    listener.setPosition(ear.x, ear.y, ear.z);
    listener.setOrientation(ear.fx, ear.fy, ear.fz, 0, 1, 0);
  }
  ring(space, ctx);
  tune(space, ctx, dt, live);
}
