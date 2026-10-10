'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { navigableStations, stationPositions } from './routes';
import { sunDirection } from './sky';
import { skyTime } from './Starfield';
import { palettes, setUniform, seededRandom } from './utils';

import type { QualityTier } from './quality';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Traffic: small shuttles plying the lanes between the stations, so the
   world reads as a place people work in, not a row of monuments. Each
   flies a lane beside one of the station-to-station routes the gas
   clouds line, 12-20 units off it, with the stretch of it within 24
   units of any station cut out (no shuttle crosses a station's own
   framing). A shuttle drops in at one end of its stretch, flies it at
   6-10 units a second, drops out at the other and waits a few seconds
   before its next run. Everything is worked out in the vertex shader
   from each shuttle's lane and the sky's time: one instanced draw, and
   the CPU never touches the instances. Frozen at the still level
   (skyTime).
   ------------------------------------------------------------------ */

/** Lanes run this far beside the route between two stations */
const laneOffset = [12, 20];
/** No lane comes this close to a station's centre */
const clearance = 24;
/** A stretch shorter than this isn't worth a run */
const shortest = 14;

/** Parts of the shuttle, so one shader lights the hull and glows the lights */
const parts = { hull: 0, port: 1, starboard: 2, strobe: 3, engine: 4 } as const;

/** A box, moved into place and tagged with the part it is */
function piece(
  size: [number, number, number],
  at: [number, number, number],
  part: number,
  roll = 0
) {
  const box = new BoxGeometry(...size);
  box.deleteAttribute('uv');
  if (roll) box.rotateZ(roll);
  box.translate(...at);
  const count = box.getAttribute('position').count;
  box.setAttribute('aPart', new Float32BufferAttribute(new Array(count).fill(part), 1));
  return box;
}

/**
 * The shuttle, nose towards +z and port (its left) towards +x: a hull,
 * two fins swept down at the back, a light at each fin tip (red to port,
 * green to starboard), a strobe on the tail and the engine's glow behind.
 * One geometry
 */
function shuttleGeometry() {
  const pieces = [
    piece([0.42, 0.26, 1.3], [0, 0, 0], parts.hull),
    piece([0.5, 0.04, 0.42], [-0.42, -0.05, -0.32], parts.hull, -0.3),
    piece([0.5, 0.04, 0.42], [0.42, -0.05, -0.32], parts.hull, 0.3),
    piece([0.08, 0.08, 0.08], [0.68, -0.13, -0.32], parts.port),
    piece([0.08, 0.08, 0.08], [-0.68, -0.13, -0.32], parts.starboard),
    piece([0.06, 0.06, 0.06], [0, 0.16, -0.6], parts.strobe),
    piece([0.3, 0.16, 0.04], [0, 0, -0.67], parts.engine),
  ];
  const merged = mergeGeometries(pieces)!;
  pieces.forEach((p) => p.dispose());
  return {
    index: merged.index!.array as Uint16Array,
    position: merged.getAttribute('position').array as Float32Array,
    normal: merged.getAttribute('normal').array as Float32Array,
    part: merged.getAttribute('aPart').array as Float32Array,
  };
}

const up = new Vector3(0, 1, 0);
const stationPoints = Object.values(stationPositions).map((p) => new Vector3(...p));

/** Each shuttle's lane (from, to) and run (speed, the wait after it, phase, strobe phase) */
function placeLanes(count: number) {
  const random = seededRandom(83);
  const routes = navigableStations.slice(1).map((key, i) => [navigableStations[i], key] as const);
  const from = new Float32Array(count * 3);
  const to = new Float32Array(count * 3);
  const run = new Float32Array(count * 4);
  const a = new Vector3();
  const b = new Vector3();
  const along = new Vector3();
  const side = new Vector3();
  const lift = new Vector3();
  const offset = new Vector3();
  const point = new Vector3();
  /** The lane already flown beside each route: a second keeps to the other side, the other way */
  const flown = new Map<number, { turn: number; forwards: boolean }>();
  let placed = 0;
  for (let attempt = 0; placed < count && attempt < count * 20; attempt++) {
    // The routes in turn, so the first half (all the low tier draws) covers them too
    const route = attempt % routes.length;
    const [start, end] = routes[route];
    const before = flown.get(route);
    a.fromArray(stationPositions[start]);
    b.fromArray(stationPositions[end]);
    along.subVectors(b, a).normalize();
    side.crossVectors(along, up).normalize();
    lift.crossVectors(side, along);
    const turn = before ? before.turn + Math.PI + (random() - 0.5) : random() * Math.PI * 2;
    offset
      .copy(side)
      .multiplyScalar(Math.cos(turn))
      .addScaledVector(lift, Math.sin(turn))
      .multiplyScalar(laneOffset[0] + random() * (laneOffset[1] - laneOffset[0]));
    a.add(offset);
    b.add(offset);
    // The longest stretch of the lane clear of every station
    const length = a.distanceTo(b);
    const steps = Math.ceil(length / 0.5);
    let best = [0, 0];
    let first = -1;
    for (let i = 0; i <= steps + 1; i++) {
      const clear =
        i <= steps &&
        stationPoints.every((p) => point.lerpVectors(a, b, i / steps).distanceTo(p) >= clearance);
      if (clear && first < 0) first = i;
      if (!clear && first >= 0) {
        if (i - 1 - first > best[1] - best[0]) best = [first, i - 1];
        first = -1;
      }
    }
    const stretch = ((best[1] - best[0]) / steps) * length;
    if (stretch < shortest) continue;
    // Either way along it
    const forwards = before ? !before.forwards : random() < 0.5;
    flown.set(route, { turn, forwards });
    const [head, tail] = forwards ? [best[0], best[1]] : [best[1], best[0]];
    point.lerpVectors(a, b, head / steps).toArray(from, placed * 3);
    point.lerpVectors(a, b, tail / steps).toArray(to, placed * 3);
    const speed = 6 + random() * 4;
    const wait = 2 + random() * 6;
    run.set([speed, wait, random() * (stretch / speed + wait), random() * 1.6], placed * 4);
    placed++;
  }
  return { from, to, run, placed };
}

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  attribute float aPart;
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec4 aRun;
  varying vec3 vNormal;
  varying float vPart;
  varying float vBlink;
  void main() {
    vec3 lane = aTo - aFrom;
    float span = max(length(lane), 1e-3);
    vec3 forward = lane / span;
    // A rotation (left, up, forward), never a mirror: a mirrored frame turns
    // every face inside out, so FrontSide culls the faces towards the camera
    vec3 left = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, left);
    // How far along its run it is: 0..1 along the lane, beyond 1 waiting for the next
    float flying = span / aRun.x;
    float s = mod(uTime + aRun.z, flying + aRun.y) / flying;
    // It drops in and out at the ends rather than popping, and is gone between runs
    float size = smoothstep(0.0, 0.12, s) * (1.0 - smoothstep(0.88, 1.0, s));
    vec3 local = position * size;
    vec3 world = aFrom + lane * min(s, 1.0) + left * local.x + up * local.y + forward * local.z;
    vNormal = left * normal.x + up * normal.y + forward * normal.z;
    vPart = aPart;
    // The tail strobe flashes every 1.6s (under 1 Hz); port and starboard burn steadily
    vBlink = step(fract((uTime + aRun.w) / 1.6), 0.05);
    vec4 mvPosition = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uHull;
  uniform vec3 uSun;
  uniform float uAmbient;
  uniform vec3 uPort;
  uniform vec3 uStarboard;
  uniform vec3 uStrobe;
  uniform vec3 uEngine;
  varying vec3 vNormal;
  varying float vPart;
  varying float vBlink;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 colour = uHull * (uAmbient + (1.0 - uAmbient) * max(dot(n, uSun), 0.0));
    float glow = 0.0;
    if (vPart > 0.5) {
      glow = 1.0;
      if (vPart < 1.5) colour = uPort;
      else if (vPart < 2.5) colour = uStarboard;
      else if (vPart < 3.5) colour = uStrobe * mix(0.04, 1.0, vBlink);
      else colour = uEngine;
    }
    gl_FragColor = vec4(colour, 1.0);
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      // Lights carry further through the haze than the hull
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor * (1.0 - 0.5 * glow));
    #endif
  }
`;

/**
 * The shuttles' one material: a hull lit from the sun's side, nav lights
 * in the stations' colours (NavLights), a cyan engine. Built once, the
 * same shader for both themes: a theme change only sets its colours
 * (applyTrafficTheme), so the program is never deleted and relinked
 * mid-switch
 */
function buildShuttle() {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSun: { value: sunDirection.clone() },
        uHull: { value: new Color() },
        uAmbient: { value: 0.3 },
        uPort: { value: new Color() },
        uStarboard: { value: new Color() },
        uStrobe: { value: new Color() },
        uEngine: { value: new Color() },
      },
    ]),
    vertexShader,
    fragmentShader,
    fog: true,
  });
}

/** Sets a uniform's colour, scaled (setUniform would drop the scale) */
function setScaledColour(material: ShaderMaterial, name: string, colour: string, scale: number) {
  (material.uniforms[name].value as Color).set(colour).multiplyScalar(scale);
}

/** Lights glow (and bloom) on the dark sky; on the light one they are plain colours */
function applyTrafficTheme(material: ShaderMaterial, theme: WorldTheme) {
  const palette = palettes[theme];
  const glow = palette.additive;
  setUniform(material, 'uHull', glow ? '#8a92a8' : '#5b6478');
  setUniform(material, 'uAmbient', glow ? 0.3 : 0.55);
  setScaledColour(material, 'uPort', '#ff3b4e', glow ? 4 : 1);
  setScaledColour(material, 'uStarboard', '#3dff8a', glow ? 3.4 : 1);
  setScaledColour(material, 'uStrobe', '#ffffff', glow ? 6 : 1);
  setScaledColour(material, 'uEngine', palette.cyan, glow ? 2.2 : 1);
}

/**
 * Shuttles plying the lanes between stations: `count` of them (8, 3 on
 * lite devices), half of those on the low tier
 */
export function Traffic({
  theme,
  count,
  tier,
}: {
  theme: WorldTheme;
  count: number;
  tier: QualityTier;
}) {
  const shape = useMemo(() => shuttleGeometry(), []);
  const { from, to, run, placed } = useMemo(() => placeLanes(count), [count]);
  const shuttle = useMemo(() => buildShuttle(), []);

  useEffect(() => applyTrafficTheme(shuttle, theme), [shuttle, theme]);

  useEffect(() => () => shuttle.dispose(), [shuttle]);

  useFrame(({ clock }) => {
    setUniform(shuttle, 'uTime', skyTime(clock));
  });

  return (
    <mesh material={shuttle} frustumCulled={false}>
      {/* New per count: three caps an instanced geometry at the attribute size it first drew */}
      <instancedBufferGeometry
        key={count}
        instanceCount={tier === 'low' ? Math.ceil(placed / 2) : placed}
      >
        <bufferAttribute attach="index" args={[shape.index, 1]} />
        <bufferAttribute attach="attributes-position" args={[shape.position, 3]} />
        <bufferAttribute attach="attributes-normal" args={[shape.normal, 3]} />
        <bufferAttribute attach="attributes-aPart" args={[shape.part, 1]} />
        <instancedBufferAttribute attach="attributes-aFrom" args={[from, 3]} />
        <instancedBufferAttribute attach="attributes-aTo" args={[to, 3]} />
        <instancedBufferAttribute attach="attributes-aRun" args={[run, 4]} />
      </instancedBufferGeometry>
    </mesh>
  );
}
