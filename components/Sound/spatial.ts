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
   detuned and warbling, and only sounds in free roam. With the world
   off there is no camera: the listener sits at the page's station and
   glides to the next one on navigation.
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
/** With the world off, how far in front of the page's station the listener sits */
const docked = 14;
/** Seconds the listener takes to follow the live camera, and to glide when there isn't one */
const followTime = 0.04;
const glideTime = 1.2;

interface Voice {
  /** The voice's loudness, breathing round its level */
  amp: GainNode;
  /** How far the breath moves `amp` */
  sway: GainNode;
  level: number;
  /** Where it sings from: cues can play through it to come from the station */
  panner: PannerNode;
}

export interface Space {
  voices: Record<StationKey, Voice>;
  /** The listener, eased towards the camera (forward is kept a unit vector) */
  ear: { x: number; y: number; z: number; fx: number; fy: number; fz: number; primed: boolean };
  /** The listener has AudioParams (Firefox's and older Safari's only have setPosition) */
  params: boolean;
}

/** AudioParam positions where the browser has them (typed boolean, so TS doesn't narrow the node away) */
const hasParams = (node: object): boolean => 'positionX' in node;

function place(panner: PannerNode, [x, y, z]: readonly [number, number, number]) {
  if (hasParams(panner)) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else {
    panner.setPosition(x, y, z);
  }
}

/** Every station's voice, playing into `out` from where it floats */
export function buildSpace(ctx: AudioContext, out: AudioNode): Space {
  const voices = {} as Record<StationKey, Voice>;
  const lite = window.matchMedia(liteQuery).matches;
  for (const key of stationKeys) {
    const spec = stationVoices[key];
    const panner = ctx.createPanner();
    panner.panningModel = lite ? 'equalpower' : 'HRTF';
    panner.distanceModel = 'exponential';
    panner.refDistance = near;
    panner.rolloffFactor = rolloff;
    const [x, y, z] = stationPositions[key];
    const [ox, oy, oz] = spec.offset ?? [0, 0, 0];
    place(panner, [x + ox, y + oy, z + oz]);
    panner.connect(out);

    // Silent until roam() lets the derelict in
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

    voices[key] = { amp, sway, level, panner };
  }

  return {
    voices,
    ear: { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, primed: false },
    params: hasParams(ctx.listener),
  };
}

/** The derelict sings only in free roam */
export function roam(space: Space, ctx: AudioContext, on: boolean) {
  const { amp, sway, level } = space.voices.lost;
  const now = ctx.currentTime;
  amp.gain.setTargetAtTime(on ? level : 0, now, 1.2);
  sway.gain.setTargetAtTime(on ? level * swayDepth : 0, now, 1.2);
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
}
