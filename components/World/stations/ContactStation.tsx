'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { easing } from 'maath';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  Group,
  MathUtils,
  Mesh,
  Points,
  QuadraticBezierCurve3,
  Quaternion,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three';

import { motionLevel } from '@/utils/motion';

import globePoints from '../data/globePoints.json';
import {
  asGlow,
  createBeamMaterial,
  createFresnelMaterial,
  createHaloMaterial,
  createRingMaterial,
} from '../materials';
import { Model } from '../Model';
import { NavLights } from '../parts';
import { StationScope } from '../power';
import { createReaction, stepReaction, trickProgress, useReactionHandlers } from '../reaction';
import { stationInRange, useThemedMaterials, useWide } from '../stationHooks';
import { StationHull } from '../StationHull';
import { stationModels, stationPositions } from '../stations';
import { latLngToVector3, palettes, seededRandom, setUniform } from '../utils';
import { setWorldHover, worldStore, worldTip } from '../worldStore';

import { RocketSmoke } from './RocketSmoke';
import { useStillRepaint } from './stillFrames';

import type { ThreeEvent } from '@react-three/fiber';
import type { NavLight } from '../parts';
import type { Reaction } from '../reaction';
import type { WorldPalette, WorldTheme } from '../utils';

/** Where the dish array sits, and the point on it the data link leaves from */
const arrayPosition = new Vector3(4.3, -0.9, -3.2);
const dishFocus = new Vector3(3.85, 0.65, -2.9);
/** Relative to the array, which sweeps about its base */
const arrayLights: NavLight[] = [
  { position: [-0.95, -0.65, 0], kind: 'red' },
  { position: [0.95, -0.65, 0], kind: 'green' },
  { position: [0, -0.7, 0.95], kind: 'white' },
];

const radius = 2.25;
const home = { lat: 52.57, lng: -0.24 };
// UK & EU remote — arcs from Peterborough to a handful of European hubs
const cities = [
  { lat: 52.37, lng: 4.9 },
  { lat: 52.52, lng: 13.4 },
  { lat: 38.72, lng: -9.14 },
  { lat: 41.39, lng: 2.17 },
  { lat: 59.33, lng: 18.07 },
  { lat: 53.35, lng: -6.26 },
  { lat: 48.86, lng: 2.35 },
  { lat: 48.14, lng: 11.58 },
];

const dotVertex = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uTime;
  attribute float aSeed;
  varying float vFacing;
  varying float vLat;
  varying float vTwinkle;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 normal = normalize(mat3(modelMatrix) * normalize(position));
    vFacing = dot(normal, normalize(cameraPosition - world.xyz));
    vLat = position.y / ${radius.toFixed(2)};
    vTwinkle = 0.75 + 0.25 * sin(uTime * 1.5 + aSeed * 40.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 2.2 * uPixelRatio * (14.0 / -mv.z);
  }
`;

const dotFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uLight;
  uniform float uCharge;
  varying float vFacing;
  varying float vLat;
  varying float vTwinkle;
  void main() {
    if (vFacing < -0.05) discard;
    float d = length(gl_PointCoord - 0.5);
    // The station's power: the land goes dark in standby, and flickers and surges on
    float alpha = smoothstep(0.5, 0.2, d) * smoothstep(-0.05, 0.35, vFacing) * vTwinkle * min(uCharge, 1.0);
    vec3 col = mix(uColorA, uColorB, smoothstep(-0.2, 0.9, vLat));
    gl_FragColor = vec4(col * mix(1.6, 1.0, uLight) * max(uCharge, 1.0), alpha);
  }
`;

/** The transmission: packets streaming from the dish to the Peterborough pin */
const packetCount = 28;
/** Share of the arc packets loop over near the dish while a message is only being written */
const idleReach = 0.22;
/** Seconds a packet takes from the pin back up to the dish (a contact card pointed at) */
const courierTime = 1.3;
/** The packet and its fading trail: how far behind it each point is, and how bright */
const courierTrail = [0, 0.035, 0.07, 0.105];
const courierFade = [2.4, 1.1, 0.55, 0.25];
/** Seconds the stream shows at least, so a fast send is still seen */
const transmitHold = 1.8;
const packetFrom = new Vector3();
const packetTo = new Vector3();
const packetBend = new Vector3();
const packetPoint = new Vector3();
const globeCentre = new Vector3(0, 0.5, 0);
const packetCurve = new QuadraticBezierCurve3(packetFrom, packetBend, packetTo);

const packetVertex = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aAlong;
  attribute float aFade;
  varying float vAlong;
  varying float vFade;
  void main() {
    vAlong = aAlong;
    vFade = aFade;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.0 + 4.0 * sin(aAlong * 3.1416)) * uSize * uPixelRatio * (10.0 / -mv.z);
  }
`;

const packetFragment = /* glsl */ `
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform float uActive;
  uniform float uLight;
  varying float vAlong;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d) * uActive * vFade;
    gl_FragColor = vec4(mix(uFrom, uTo, vAlong) * mix(2.4, 1.1, uLight), alpha);
  }
`;

const exhaustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uActive;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vLife;
  void main() {
    float life = fract(uTime * 1.6 + aSeed);
    vLife = life;
    float angle = aSeed * 6.2831 * 7.0;
    float spread = 0.08 + life * 0.45;
    vec3 p = position + vec3(cos(angle) * spread, -life * 2.6, sin(angle) * spread);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uActive * (1.0 - life) * 26.0 * uPixelRatio * (6.0 / -mv.z);
  }
`;

const exhaustFragment = /* glsl */ `
  uniform vec3 uHot;
  uniform vec3 uCool;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d) * (1.0 - vLife);
    // Shock diamonds: bright knots down the plume
    float knots = 1.0 + 0.7 * pow(max(sin(vLife * 34.0), 0.0), 6.0) * (1.0 - vLife);
    gl_FragColor = vec4(mix(uHot, uCool, vLife) * 2.2 * knots, alpha);
  }
`;

/** Packets: points that brighten from cyan at the dish to pink at the pin */
function createPacketMaterial(p: WorldPalette, size = 1) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uSize: { value: size },
        uActive: { value: 0 },
        uFrom: { value: new Color(p.cyan) },
        uTo: { value: new Color(p.pink) },
        uLight: { value: 0 },
      },
      vertexShader: packetVertex,
      fragmentShader: packetFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );
}

const buildMaterials = (p: WorldPalette) => ({
  dots: asGlow(
    new ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uColorA: { value: new Color(p.violet) },
        uColorB: { value: new Color(p.cyan) },
        uLight: { value: 0 },
        uCharge: { value: 1 },
      },
      vertexShader: dotVertex,
      fragmentShader: dotFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  ),
  atmosphere: createFresnelMaterial({ color: p.cyan, power: 3.2, intensity: 1.5 }),
  aura: createFresnelMaterial({ color: p.violet, power: 2.4, intensity: 1.1, backSide: true }),
  link: createBeamMaterial({ color: p.cyan, intensity: 2.6, opacity: 0.7, speed: 1.4 }),
  arc: createRingMaterial({
    colorA: p.cyan,
    colorB: p.pink,
    intensity: 1.8,
    speed: 0.35,
    opacity: 0.8,
  }),
  beacon0: createRingMaterial({ colorA: p.pink, colorB: p.violet, intensity: 3, speed: 0 }),
  beacon1: createRingMaterial({ colorA: p.pink, colorB: p.violet, intensity: 3, speed: 0 }),
  beacon2: createRingMaterial({ colorA: p.pink, colorB: p.violet, intensity: 3, speed: 0 }),
  packets: createPacketMaterial(p),
  courier: createPacketMaterial(p, 2.8),
  flare: createHaloMaterial({ color: '#fbbf24', intensity: 2.4, opacity: 0 }),
  exhaust: asGlow(
    new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uActive: { value: 0 },
        uPixelRatio: { value: 1 },
        uHot: { value: new Color('#fde68a') },
        uCool: { value: new Color(p.pink) },
        uLight: { value: 0 },
      },
      vertexShader: exhaustVertex,
      fragmentShader: exhaustFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  ),
});

/** Aims the packets' arc from the dish to the pin, wherever the globe has turned it */
function aimPackets(globe: Group, tip: Vector3) {
  globe.updateMatrix();
  packetFrom.copy(dishFocus);
  packetTo.copy(tip).applyMatrix4(globe.matrix);
  // Bend the arc out over the globe so it never cuts through it
  packetBend
    .addVectors(packetFrom, packetTo)
    .multiplyScalar(0.5)
    .sub(globeCentre)
    .setLength(radius * 1.9)
    .add(globeCentre);
}

/**
 * Lays the packets out along the arc, `clock` setting how far they have
 * got. With `reach` 1 they stream the whole way to the pin (a message
 * sending); down at `idleReach` they loop near the dish, fading in and out
 * at either end of the loop (a message being written)
 */
function streamPackets(points: Points, globe: Group, tip: Vector3, clock: number, reach: number) {
  aimPackets(globe, tip);
  const full = MathUtils.clamp((reach - idleReach) / (1 - idleReach), 0, 1);
  const position = points.geometry.getAttribute('position') as BufferAttribute;
  const along = points.geometry.getAttribute('aAlong') as BufferAttribute;
  const fade = points.geometry.getAttribute('aFade') as BufferAttribute;
  for (let i = 0; i < packetCount; i++) {
    const u = (clock + i / packetCount) % 1;
    packetCurve.getPoint(u * reach, packetPoint);
    position.setXYZ(i, packetPoint.x, packetPoint.y, packetPoint.z);
    along.setX(i, u * reach);
    fade.setX(i, MathUtils.lerp(Math.sin(u * Math.PI), 1, full));
  }
  position.needsUpdate = along.needsUpdate = fade.needsUpdate = true;
}

/**
 * Places the packet (and its trail) arcing from the pin back up to the
 * dish, `progress` 0..1 of the way: the stream's path, run the other way
 */
function sendCourier(points: Points, globe: Group, tip: Vector3, progress: number) {
  aimPackets(globe, tip);
  const position = points.geometry.getAttribute('position') as BufferAttribute;
  const along = points.geometry.getAttribute('aAlong') as BufferAttribute;
  courierTrail.forEach((behind, i) => {
    const u = 1 - MathUtils.clamp(progress - behind, 0, 1);
    packetCurve.getPoint(u, packetPoint);
    position.setXYZ(i, packetPoint.x, packetPoint.y, packetPoint.z);
    along.setX(i, u);
  });
  position.needsUpdate = along.needsUpdate = true;
}

function buildArcs() {
  const start = latLngToVector3(home.lat, home.lng, radius);
  return cities.map((city) => {
    const end = latLngToVector3(city.lat, city.lng, radius);
    const lift = radius + 0.25 + start.distanceTo(end) * 0.45;
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(lift);
    return new TubeGeometry(new QuadraticBezierCurve3(start, mid, end), 48, 0.011, 6, false);
  });
}

const globeTip = { label: 'Peterborough, UK', sub: 'Drag to spin the globe' };
const rocketTip = { label: 'Ready for launch', sub: 'Send a message to fire it, or click to rev' };
/** Seconds the rocket's rev (a hop and a burst of exhaust) takes */
const revTime = 1;

/** Drag-to-spin state: offsets added to the globe's idle sway, plus momentum */
interface Spin {
  yaw: number;
  pitch: number;
  velocity: number;
  dragging: boolean;
  lastX: number;
  lastY: number;
  lastTime: number;
}

/**
 * The globe sits behind the page, so the same press would also start a text
 * selection in the copy under the pointer. Nothing selects until release.
 */
function holdSelection() {
  const root = document.documentElement;
  const block = (event: Event) => event.preventDefault();
  window.getSelection()?.removeAllRanges();
  root.classList.add('world-dragging');
  document.addEventListener('selectstart', block);
  return () => {
    root.classList.remove('world-dragging');
    document.removeEventListener('selectstart', block);
  };
}

/** Starts a drag on the globe; window listeners follow the pointer until release */
function startSpin(spin: Spin, e: ThreeEvent<PointerEvent>) {
  e.stopPropagation();
  e.nativeEvent.preventDefault();
  const release = holdSelection();
  spin.dragging = true;
  spin.lastX = e.clientX;
  spin.lastY = e.clientY;
  spin.lastTime = performance.now();
  spin.velocity = 0;
  const move = (event: PointerEvent) => {
    const now = performance.now();
    const dx = event.clientX - spin.lastX;
    const dy = event.clientY - spin.lastY;
    const step = dx * 0.0085;
    spin.yaw += step;
    spin.pitch = MathUtils.clamp(spin.pitch + dy * 0.004, -0.5, 0.5);
    spin.velocity = step / Math.max((now - spin.lastTime) / 1000, 1 / 120);
    spin.lastX = event.clientX;
    spin.lastY = event.clientY;
    spin.lastTime = now;
  };
  const end = () => {
    spin.dragging = false;
    release();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

/**
 * The comms array's state between frames: how locked on to the globe the
 * dish is (a form field has focus), its sweep, the data link's and the
 * packets' own clocks (they speed up and slow down without jumping), how
 * far the packets reach, the packet arcing back from the pin, and how far
 * the globe has turned Peterborough to the camera
 */
interface Comms {
  lock: number;
  sweep: number;
  link: number;
  stream: number;
  reach: number;
  composing: number;
  courierAt: number;
  courierFor: string;
  face: number;
  /** The pin's rings' own clock (they quicken while a message sends) */
  rings: number;
  /** The station's own clock, which holds at `still` (nothing ambient moves) */
  ambient: number;
}

/** Turns of the sweep, either side of the globe, while the dish idles */
const sweepAngle = 0.3;
const sweepRate = 0.3;

const cameraLocal = new Vector3();
const pinFacing = new Vector3();
const untilt = new Quaternion();
const xAxis = new Vector3(1, 0, 0);

/** The shortest turn from angle `a` to `b`, -π..π */
function turnBetween(a: number, b: number) {
  return MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
}

/**
 * The globe's yaw that turns the pin (`pin`, its direction in the globe's
 * own frame) to face the camera, for the globe's pitch, nearest `from`
 */
function yawFacing(globe: Group, pin: Vector3, camera: Vector3, from: number) {
  // The camera's direction from the globe, tilted back by the globe's pitch
  pinFacing.copy(camera).sub(globe.position);
  pinFacing.applyQuaternion(untilt.setFromAxisAngle(xAxis, -globe.rotation.x));
  const yaw = Math.atan2(pinFacing.x, pinFacing.z) - Math.atan2(pin.x, pin.z);
  return from + turnBetween(from, yaw);
}

const launchDuration = 5.5;
const returnDuration = 1.6;

/** The rocket's state between frames: when it last lit, and its engine's glow */
interface Launch {
  ignitedAt: number;
  flash: number;
}

const nozzlePoint = new Vector3();
const warm = new Color('#fff0d8');
const glowColour = new Color();

/**
 * Flies the rocket: up and away after a launch (shaking the camera as it
 * lights, the shake fading as it climbs), back in from below, then a gentle
 * bob, hopping with a burst of exhaust when clicked. Returns how hard the
 * engine burns, 0..1. `base` is where it sits: its sway never wanders off it
 */
function updateRocket(
  rocket: Group,
  base: { x: number; y: number },
  launch: Launch,
  rev: Reaction,
  t: number,
  idle: number,
  dt: number
) {
  const since = worldStore.launchAt < 0 ? Infinity : t - worldStore.launchAt;
  if (since < launchDuration) {
    if (launch.ignitedAt !== worldStore.launchAt) {
      launch.ignitedAt = worldStore.launchAt;
      worldStore.shake = 1;
    }
    worldStore.shake = Math.max(worldStore.shake, 0.55 * (1 - since / launchDuration) ** 2);
    const lift = 0.9 * since * since;
    rocket.position.y = base.y + lift;
    // Engine judder, round its own line rather than adding up
    rocket.position.x = base.x + Math.sin(t * 53) * 0.012 * Math.min(since * 4, 1);
    rocket.rotation.z = Math.sin(t * 40) * 0.01;
    return Math.min(since * 3, 1);
  }
  rocket.position.x = base.x;
  if (since < launchDuration + returnDuration) {
    // Re-enter from below
    const k = (since - launchDuration) / returnDuration;
    rocket.position.y = base.y - 5 * (1 - k) * (1 - k);
    return 0;
  }
  const hop = trickProgress(rev, revTime);
  const lifted = hop >= 0 ? Math.sin(hop * Math.PI) * 0.45 : 0;
  easing.damp(rocket.position, 'y', base.y + Math.sin(idle * 1.1) * 0.12 + lifted, 0.12, dt);
  rocket.rotation.z =
    Math.sin(idle * 0.7) * 0.05 + (hop >= 0 ? Math.sin(hop * Math.PI * 6) * 0.02 : 0);
  return hop >= 0 ? Math.sin(hop * Math.PI) * 0.85 : 0;
}

/**
 * The engine's light: a flare at the nozzle (a bright burst as it lights,
 * then flickering with the burn) that warms the globe's atmosphere, and the
 * globe's own glow lifting while the pointer is over it
 */
function lightUp(
  materials: ReturnType<typeof buildMaterials>,
  launch: Launch,
  thrust: number,
  hovered: number,
  cyan: string,
  t: number,
  dt: number
) {
  const since = worldStore.launchAt < 0 ? Infinity : t - worldStore.launchAt;
  const burst = since < 0.6 ? 1 - since / 0.6 : 0;
  const flicker = 0.85 + 0.15 * Math.sin(t * 61) * Math.sin(t * 23);
  launch.flash = MathUtils.damp(launch.flash, Math.max(thrust * flicker, burst * 1.6), 14, dt);
  setUniform(materials.flare, 'uOpacity', Math.min(launch.flash, 1.6) * 0.8);
  // Lit by the engine while it is close, cooling as the rocket climbs away
  const nearby = since < launchDuration ? Math.max(0, 1 - since / 3) : 0;
  const warmth = Math.max(burst, nearby * thrust * 0.6);
  setUniform(materials.atmosphere, 'uColor', glowColour.set(cyan).lerp(warm, warmth * 0.6));
  setUniform(materials.atmosphere, 'uIntensity', 1.5 + warmth * 1.2 + hovered * 0.6);
  setUniform(materials.aura, 'uIntensity', 1.1 + warmth * 0.8 + hovered * 0.5);
}

/**
 * `/contact` — dotted holo-globe with a Peterborough beacon, a comms array
 * that streams a message to the beacon while it sends, and a rocket that
 * launches once it has landed
 */
export function ContactStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const globeRef = useRef<Group>(null);
  const spinRef = useRef<Spin>({
    yaw: 0,
    pitch: 0,
    velocity: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  });
  const beaconRef = useRef<Group>(null);
  const rocketRef = useRef<Group>(null);
  const packetsRef = useRef<Points>(null);
  const courierRef = useRef<Points>(null);
  const arrayRef = useRef<Group>(null);
  const transmit = useRef({ since: -Infinity, was: false, level: 0 });
  const commsRef = useRef<Comms>({
    lock: 0,
    sweep: 0,
    link: 0,
    stream: 0,
    reach: 1,
    composing: 0,
    courierAt: -Infinity,
    courierFor: '',
    face: 0,
    rings: 0,
    ambient: 0,
  });
  const launch = useRef<Launch>({ ignitedAt: -1, flash: 0 });
  const globeHover = useRef({ on: false, level: 0 });
  const rev = useRef(createReaction());
  const revHandlers = useReactionHandlers(rev, rocketTip, revTime);
  const nozzle = useRef(new Vector3());
  const burning = useRef(false);
  const wide = useWide();
  const materials = useThemedMaterials(buildMaterials, theme, 'contact');
  const palette = palettes[theme];
  useStillRepaint();

  const { positions, seeds } = useMemo(() => {
    const random = seededRandom(5);
    const count = globePoints.length / 2;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const v = new Vector3();
    for (let i = 0; i < count; i++) {
      latLngToVector3(globePoints[i * 2], globePoints[i * 2 + 1], radius, v);
      positions.set([v.x, v.y, v.z], i * 3);
      seeds[i] = random();
    }
    return { positions, seeds };
  }, []);

  const exhaustSeeds = useMemo(() => {
    const random = seededRandom(9);
    return Float32Array.from({ length: 90 }, () => random());
  }, []);
  const exhaustPositions = useMemo(() => new Float32Array(90 * 3), []);

  const arcs = useMemo(() => buildArcs(), []);
  useEffect(() => () => arcs.forEach((arc) => arc.dispose()), [arcs]);

  const beaconPosition = useMemo(() => latLngToVector3(home.lat, home.lng, radius), []);
  /** The pin's tip, on the globe (the stream lands on it) */
  const beaconTip = useMemo(
    () => beaconPosition.clone().addScaledVector(beaconPosition.clone().normalize(), 0.72),
    [beaconPosition]
  );
  const packetBuffers = useMemo(
    () => ({
      positions: new Float32Array(packetCount * 3),
      along: new Float32Array(packetCount),
      fade: new Float32Array(packetCount).fill(1),
    }),
    []
  );
  // The packet that arcs back from the pin (bigger and brighter than the stream's), and its trail
  const courierBuffers = useMemo(
    () => ({
      position: new Float32Array(courierTrail.length * 3),
      along: new Float32Array(courierTrail.length),
      fade: Float32Array.from(courierFade),
    }),
    []
  );

  // The data link: a pulse of light from the dish to the globe's surface
  const link = useMemo(() => {
    const globeCentre = new Vector3(0, 0.5, 0);
    const towards = globeCentre.clone().sub(dishFocus).normalize();
    const end = globeCentre.clone().addScaledVector(towards, -radius * 1.02);
    const length = end.distanceTo(dishFocus);
    return {
      length,
      position: dishFocus.clone().lerp(end, 0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), towards),
    };
  }, []);
  const beaconQuaternion = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), beaconPosition.clone().normalize()),
    [beaconPosition]
  );

  const rocketBase = wide ? { x: 2.8, y: 2.1, z: 1.2 } : { x: 1.5, y: 2.3, z: 1.5 };

  useFrame(({ camera, clock, viewport }, delta) => {
    const group = groupRef.current;
    if (!stationInRange(group, camera, 'contact')) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    // At `still` nothing moves on its own (step), and what answers the page snaps (ease)
    const still = motionLevel() === 'still';
    const step = still ? 0 : dt;
    const ease = still ? 1 : dt;
    const comms = commsRef.current;
    const idle = (comms.ambient += step);
    setUniform(materials.dots, 'uTime', idle);
    setUniform(materials.dots, 'uPixelRatio', viewport.dpr);
    setUniform(materials.arc, 'uTime', idle);
    setUniform(materials.exhaust, 'uTime', t);
    setUniform(materials.exhaust, 'uPixelRatio', viewport.dpr);

    // A form field has focus: the dish stops sweeping and locks on to the
    // globe, and the data link runs faster, as if listening
    comms.lock = MathUtils.damp(comms.lock, worldStore.commsFocus ? 1 : 0, 3, ease);
    comms.sweep += step * sweepRate;
    const array = arrayRef.current;
    if (array) array.rotation.y = Math.sin(comms.sweep) * sweepAngle * (1 - comms.lock);
    comms.link += step * (1 + comms.lock * 1.6);
    setUniform(materials.link, 'uTime', comms.link);

    const globe = globeRef.current;
    if (globe && group) {
      // Momentum after a drag, easing out; the tilt drifts back to rest
      const spin = spinRef.current;
      if (!spin.dragging) {
        spin.yaw += spin.velocity * step;
        spin.velocity = still ? 0 : spin.velocity * Math.exp(-1.6 * dt);
        spin.pitch = MathUtils.damp(spin.pitch, 0, 1.2, ease);
      }
      const sway =
        -Math.PI / 2 + Math.sin(idle * 0.12) * 0.35 + worldStore.pointerX * 0.2 + spin.yaw;
      globe.rotation.x = 0.62 + worldStore.pointerY * 0.08 + spin.pitch;
      // The location map pointed at: the globe turns Peterborough to the camera
      const facing = worldStore.targetHover === 'globe:home' && !spin.dragging;
      comms.face = MathUtils.damp(comms.face, facing ? 1 : 0, 2.5, ease);
      const faced =
        comms.face > 0.001
          ? yawFacing(
              globe,
              beaconPosition,
              group.worldToLocal(cameraLocal.copy(camera.position)),
              sway
            )
          : sway;
      globe.rotation.y = MathUtils.lerp(sway, faced, comms.face);
    }

    // Transmitting: packets stream along an arc over the globe to the pin
    // (wherever the globe has turned it), and the pin's rings speed up. A
    // message being written waits at the dish: a few packets loop near it,
    // more as it grows
    const sending = transmit.current;
    if (worldStore.transmitting && !sending.was) sending.since = t;
    sending.was = worldStore.transmitting;
    const active = worldStore.transmitting || t - sending.since < transmitHold;
    sending.level = MathUtils.damp(sending.level, active ? 1 : 0, active ? 6 : 3, dt);
    // Up to 0.35 for a full message (the square root, so a few lines already show)
    const writing = Math.sqrt(worldStore.composing) * 0.35;
    comms.composing = MathUtils.damp(comms.composing, writing, 4, ease);
    const activity = Math.max(sending.level, comms.composing);
    const reach = sending.level >= comms.composing ? 1 : idleReach;
    comms.reach = MathUtils.damp(comms.reach, reach, 3, ease);
    comms.stream += step * 0.85;
    setUniform(materials.packets, 'uActive', activity);
    setUniform(materials.packets, 'uPixelRatio', viewport.dpr);
    const packets = packetsRef.current;
    if (packets && globe) {
      packets.visible = activity > 0.01;
      if (packets.visible) streamPackets(packets, globe, beaconTip, comms.stream, comms.reach);
    }

    // A contact card pointed at: one packet arcs from the pin back up to the dish
    const card = worldStore.targetHover.startsWith('contact:') ? worldStore.targetHover : '';
    if (card !== comms.courierFor) {
      comms.courierFor = card;
      if (card && !still) comms.courierAt = t;
    }
    const flown = (t - comms.courierAt) / courierTime;
    const courier = courierRef.current;
    if (courier && globe) {
      courier.visible = flown >= 0 && flown < 1;
      if (courier.visible) {
        sendCourier(courier, globe, beaconTip, MathUtils.smootherstep(flown, 0, 1));
        setUniform(materials.courier, 'uActive', Math.min(1, flown * 8, (1 - flown) * 5));
        setUniform(materials.courier, 'uPixelRatio', viewport.dpr);
      }
    }

    comms.rings += step * (0.6 + sending.level * 1.2);
    beaconRef.current?.children.forEach((ring, i) => {
      const phase = (comms.rings + i / 3) % 1;
      ring.scale.setScalar(0.1 + phase * 0.9);
      const material = (ring as Mesh).material as ShaderMaterial;
      setUniform(material, 'uOpacity', 1 - phase);
    });

    const rocket = rocketRef.current;
    stepReaction(rev.current, t, dt);
    let thrust = 0;
    if (rocket) {
      thrust = updateRocket(rocket, rocketBase, launch.current, rev.current, t, idle, dt);
      setUniform(materials.exhaust, 'uActive', thrust);
      // Smoke trails only a real launch, from the nozzle in the station's space
      nozzle.current.copy(rocket.position).add(nozzlePoint.set(0, wide ? -1 : -0.72, 0));
      burning.current = worldStore.launchAt >= 0 && t - worldStore.launchAt < launchDuration;
    }
    const hover = globeHover.current;
    hover.level = MathUtils.damp(hover.level, hover.on ? 1 : 0, 6, ease);
    lightUp(materials, launch.current, thrust, hover.level, palette.cyan, t, dt);
  });

  return (
    <StationScope station="contact">
      <group ref={groupRef} position={stationPositions.contact}>
        <group ref={globeRef} position={[0, 0.5, 0]} rotation={[0.62, -Math.PI / 2, 0]}>
          <mesh
            onPointerDown={(e) => startSpin(spinRef.current, e)}
            onPointerOver={(e) => {
              e.stopPropagation();
              setWorldHover(true, 'grab');
              worldTip.set(globeTip);
              globeHover.current.on = true;
            }}
            onPointerOut={() => {
              setWorldHover(false);
              if (worldTip.get() === globeTip) worldTip.set(null);
              globeHover.current.on = false;
            }}
          >
            <sphereGeometry args={[radius * 0.985, 64, 48]} />
            <meshBasicMaterial color={theme === 'dark' ? '#070916' : '#dfe3f3'} />
          </mesh>
          <mesh material={materials.atmosphere} scale={1.005}>
            <sphereGeometry args={[radius, 64, 48]} />
          </mesh>
          <mesh material={materials.aura} scale={1.22}>
            <sphereGeometry args={[radius, 48, 32]} />
          </mesh>
          <points material={materials.dots}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
              <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
            </bufferGeometry>
          </points>
          {arcs.map((geometry, i) => (
            <mesh key={i} geometry={geometry} material={materials.arc} />
          ))}
          <group position={beaconPosition} quaternion={beaconQuaternion}>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.012, 0.03, 0.7, 8]} />
              <meshBasicMaterial color={palette.pink} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.72, 0]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshBasicMaterial color={palette.pink} toneMapped={false} />
            </mesh>
            <group ref={beaconRef}>
              {[materials.beacon0, materials.beacon1, materials.beacon2].map((material, i) => (
                <mesh key={i} rotation={[Math.PI / 2, 0, 0]} material={material}>
                  <torusGeometry args={[0.32, 0.01, 6, 64]} />
                </mesh>
              ))}
            </group>
          </group>
        </group>

        {/* The deep-space comms array, dish turned towards the globe */}
        {/* It sweeps a little either side, as if tracking the signal */}
        <group ref={arrayRef} position={arrayPosition}>
          <group rotation={[0.08, -2.3, 0.05]}>
            <StationHull station="contact" height={2.5} theme={theme} />
          </group>
          <NavLights lights={arrayLights} />
        </group>
        <mesh material={materials.link} position={link.position} quaternion={link.quaternion}>
          <cylinderGeometry args={[0.025, 0.025, link.length, 8, 1, true]} />
        </mesh>
        <points ref={packetsRef} material={materials.packets} visible={false} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[packetBuffers.positions, 3]} />
            <bufferAttribute attach="attributes-aAlong" args={[packetBuffers.along, 1]} />
            <bufferAttribute attach="attributes-aFade" args={[packetBuffers.fade, 1]} />
          </bufferGeometry>
        </points>
        <points ref={courierRef} material={materials.courier} visible={false} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[courierBuffers.position, 3]} />
            <bufferAttribute attach="attributes-aAlong" args={[courierBuffers.along, 1]} />
            <bufferAttribute attach="attributes-aFade" args={[courierBuffers.fade, 1]} />
          </bufferGeometry>
        </points>

        <group
          ref={rocketRef}
          position={[rocketBase.x, rocketBase.y, rocketBase.z]}
          rotation={[0, 0, 0.12]}
        >
          <group {...revHandlers}>
            <Model url={stationModels.contact!} height={wide ? 2.1 : 1.5} theme={theme} />
          </group>
          <points
            material={materials.exhaust}
            position={[0, wide ? -1 : -0.72, 0]}
            frustumCulled={false}
          >
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[exhaustPositions, 3]} />
              <bufferAttribute attach="attributes-aSeed" args={[exhaustSeeds, 1]} />
            </bufferGeometry>
          </points>
          <Billboard position={[0, wide ? -1.15 : -0.85, 0]}>
            <mesh material={materials.flare} scale={wide ? 2.6 : 1.9}>
              <planeGeometry />
            </mesh>
          </Billboard>
        </group>
        <RocketSmoke theme={theme} source={nozzle} burning={burning} />
      </group>
    </StationScope>
  );
}
