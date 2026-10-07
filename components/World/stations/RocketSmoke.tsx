'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, Color, MathUtils, NormalBlending, ShaderMaterial, Vector3 } from 'three';

import { sunDirection } from '../sky';
import { seededRandom, setUniform } from '../utils';

import type { PerspectiveCamera, Points } from 'three';
import type { WorldTheme } from '../utils';

/* ------------------------------------------------------------------
   The rocket's smoke: puffs left behind where the rocket was, so a
   launch draws a column that billows out, sinks a little and thins
   away. A pool of soft points (round, shaded as little spheres lit
   from the sun's side), reused round and round; only puffs emitted
   since the last frame are written.
   ------------------------------------------------------------------ */

const count = 160;
/** Seconds a puff lasts */
const life = 3.4;
/** Puffs a second while the engine burns */
const rate = 46;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  attribute vec3 aDrift;
  attribute float aBirth;
  varying float vLife;
  void main() {
    float age = uTime - aBirth;
    vLife = age / ${life.toFixed(1)};
    // Unborn or spent: off screen and nothing drawn
    if (vLife < 0.0 || vLife > 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec3 p = position + aDrift * sqrt(age) * 0.9 + vec3(0.0, -0.18 * age, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = 0.22 + vLife * 1.5;
    gl_PointSize = size * uScale / -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform vec3 uSun;
  uniform float uOpacity;
  varying float vLife;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    // Shaded as a small sphere: brighter on the sun's side
    vec3 normal = vec3(c.x, -c.y, sqrt(1.0 - r2));
    float light = 0.4 + 0.6 * max(dot(normal, uSun), 0.0);
    vec3 col = mix(uHot, uColor, smoothstep(0.0, 0.12, vLife)) * light;
    float alpha = pow(1.0 - r2, 1.5) * pow(1.0 - vLife, 1.4) * smoothstep(0.0, 0.05, vLife) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

interface Smoke {
  next: number;
  /** Clock time of the last frame, and puffs owed (fractions carry over) */
  last: number;
  owed: number;
}

const view = new Vector3();
const nozzle = new Vector3();

function emit(points: Points, smoke: Smoke, from: Vector3, t: number, burning: boolean) {
  const elapsed = smoke.last < 0 ? 0 : t - smoke.last;
  smoke.last = t;
  if (!burning) {
    smoke.owed = 0;
    return;
  }
  smoke.owed += elapsed * rate;
  const geometry = points.geometry;
  const origin = geometry.getAttribute('position') as BufferAttribute;
  const birth = geometry.getAttribute('aBirth') as BufferAttribute;
  let emitted = false;
  while (smoke.owed >= 1) {
    smoke.owed -= 1;
    const i = smoke.next;
    smoke.next = (i + 1) % count;
    // Spread along the stretch the rocket covered this frame
    const jitter = Math.random();
    origin.setXYZ(i, from.x, from.y - jitter * elapsed * 4, from.z);
    birth.setX(i, t - jitter * elapsed);
    emitted = true;
  }
  if (emitted) {
    origin.needsUpdate = true;
    birth.needsUpdate = true;
  }
}

export function RocketSmoke({
  theme,
  source,
  burning,
}: {
  theme: WorldTheme;
  /** Where the nozzle is, in the station's space, read every frame */
  source: { current: Vector3 };
  /** Whether the engine is burning, read every frame */
  burning: { current: boolean };
}) {
  const pointsRef = useRef<Points>(null);
  const smoke = useRef<Smoke>({ next: 0, last: -1, owed: 0 });

  const { origins, drifts, births } = useMemo(() => {
    const random = seededRandom(19);
    const drifts = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const out = 0.3 + random() * 0.7;
      drifts.set([Math.cos(angle) * out, (random() - 0.6) * 0.5, Math.sin(angle) * out], i * 3);
    }
    return {
      origins: new Float32Array(count * 3),
      drifts,
      births: new Float32Array(count).fill(-100),
    };
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 1 },
          uColor: { value: new Color() },
          uHot: { value: new Color('#ffd7a0') },
          uSun: { value: new Vector3() },
          uOpacity: { value: 0.5 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    setUniform(material, 'uColor', theme === 'dark' ? '#b9bdd6' : '#8d93b3');
    setUniform(material, 'uOpacity', theme === 'dark' ? 0.42 : 0.5);
  }, [material, theme]);

  useFrame(({ camera, clock, gl, size }) => {
    const points = pointsRef.current;
    if (!points) return;
    const t = clock.elapsedTime;
    nozzle.copy(source.current);
    emit(points, smoke.current, nozzle, t, burning.current);
    const lens = camera as PerspectiveCamera;
    const scale =
      (size.height * gl.getPixelRatio()) / (2 * Math.tan(MathUtils.degToRad(lens.fov) / 2));
    setUniform(material, 'uTime', t);
    setUniform(material, 'uScale', scale);
    // The sun's direction in view space, for the puffs' shading
    view.copy(sunDirection).transformDirection(camera.matrixWorldInverse);
    setUniform(material, 'uSun', view);
  });

  return (
    <points ref={pointsRef} material={material} frustumCulled={false} renderOrder={2}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[origins, 3]} />
        <bufferAttribute attach="attributes-aDrift" args={[drifts, 3]} />
        <bufferAttribute attach="attributes-aBirth" args={[births, 1]} />
      </bufferGeometry>
    </points>
  );
}
