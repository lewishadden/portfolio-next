'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  NormalBlending,
  Path,
  PlaneGeometry,
  PMREMGenerator,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  Vector2,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { setUniform } from 'components/World/utils';

import { setInvalidate } from './glassState';

import type {
  Blending,
  Group,
  Mesh,
  Points,
  PointLight,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three';
import type { GlassState } from './glassState';

/* ------------------------------------------------------------------
   The header bar as a holographic glass slab (3D effects on): a
   bevelled slab of dark glass drawn with three.js behind the bar's real
   links and buttons, over the frosted blur of whatever is behind the
   bar (CSS, on the bar itself). Its bevel and clear coat catch the light
   of the room and of two lights, violet and cyan, that follow the
   pointer along the bar (and drift slowly while it's elsewhere): a sheen
   pass brightens the bevel where it turns away from you, glints where it
   faces the lights and slides a faint glare across the face. Its edge is
   lit violet to cyan. The current page sits on a pill of moving
   plasma that slides and stretches to whatever link you point at,
   throwing sparks. The bar itself never moves.

   Pixel units: an orthographic camera with 1 unit to 1 CSS pixel, its
   origin at the bar's centre. It draws on demand: on pointer and layout
   changes, at about 12 fps while the lights drift, and every frame while
   the plasma or its sparks are moving. Reduced motion holds the lights
   still, moves the plasma at once and throws no sparks.
   ------------------------------------------------------------------ */

type Theme = 'dark' | 'light';

const violet = new Color('#8b5cf6');
const cyan = new Color('#22d3ee');

/** The slab: depth and bevel (px), and a slight look down onto it so its top edge shows */
const depth = 8;
const bevel = 4;
const lookDown = 0.24;

const looks: Record<
  Theme,
  { glass: string; opacity: number; env: number; lights: number; blending: Blending }
> = {
  dark: { glass: '#1a1744', opacity: 0.42, env: 1.3, lights: 3.2, blending: AdditiveBlending },
  light: { glass: '#ffffff', opacity: 0.55, env: 1.1, lights: 1.6, blending: NormalBlending },
};

function roundedRect<T extends Shape | Path>(w: number, h: number, r: number, path: T): T {
  const radius = Math.min(r, w / 2, h / 2);
  path.moveTo(-w / 2 + radius, -h / 2);
  path.lineTo(w / 2 - radius, -h / 2);
  path.absarc(w / 2 - radius, -h / 2 + radius, radius, -Math.PI / 2, 0, false);
  path.lineTo(w / 2, h / 2 - radius);
  path.absarc(w / 2 - radius, h / 2 - radius, radius, 0, Math.PI / 2, false);
  path.lineTo(-w / 2 + radius, h / 2);
  path.absarc(-w / 2 + radius, h / 2 - radius, radius, Math.PI / 2, Math.PI, false);
  path.lineTo(-w / 2, -h / 2 + radius);
  path.absarc(-w / 2 + radius, -h / 2 + radius, radius, Math.PI, Math.PI * 1.5, false);
  return path;
}

/** The slab: the bar's pill, extruded and bevelled, its front face at z = 0 */
function slabGeometry(w: number, h: number) {
  const geometry = new ExtrudeGeometry(roundedRect(w, h, h / 2, new Shape()), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelOffset: -bevel * 0.85,
    bevelSegments: 5,
    curveSegments: 28,
  });
  geometry.computeBoundingBox();
  geometry.translate(0, 0, -(geometry.boundingBox?.max.z ?? 0));
  return geometry;
}

/** A thin outline of the bar's pill, for its lit edge */
function edgeGeometry(w: number, h: number, width: number) {
  const shape = roundedRect(w, h, h / 2, new Shape());
  shape.holes.push(roundedRect(w - width * 2, h - width * 2, h / 2 - width, new Path()));
  return new ShapeGeometry(shape, 28);
}

const plainVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sheenVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * How glass catches the light, drawn over the slab: its bevel bright where
 * it turns away from you (violet to cyan along the bar), a glint where it
 * faces the lights, and a faint glare sliding across its face
 */
const sheenFragment = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec2 uSize;
  uniform float uLight;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 n = normalize(vNormal);
    float x = clamp(vPos.x / uSize.x + 0.5, 0.0, 1.0);
    float edge = pow(1.0 - abs(n.z), 2.2);
    // The two lights sit either side of uLight, above and in front
    vec3 toA = normalize(vec3((uLight - 170.0) - vPos.x, 60.0 - vPos.y, 140.0));
    vec3 toB = normalize(vec3((uLight + 170.0) - vPos.x, -40.0 - vPos.y, 140.0));
    vec3 view = vec3(0.0, 0.0, 1.0);
    float glintA = pow(max(dot(reflect(-toA, n), view), 0.0), 40.0);
    float glintB = pow(max(dot(reflect(-toB, n), view), 0.0), 40.0);
    float face = smoothstep(0.98, 1.0, n.z);
    float glare = exp(-pow((vPos.x * 0.35 + vPos.y * 1.6 - uLight * 0.35) / 22.0, 2.0)) * 0.07 * face;
    float top = smoothstep(-0.2, 0.9, n.y) * (1.0 - face) * 0.35;
    vec3 colour = mix(uA, uB, x) * (edge * 0.9 + top) + vec3(0.85, 0.75, 1.0) * glintA + vec3(0.7, 0.95, 1.0) * glintB + vec3(glare);
    float a = clamp(edge * 0.8 + top + glintA + glintB + glare, 0.0, 1.0);
    gl_FragColor = vec4(colour * uStrength, a * uStrength);
    #include <colorspace_fragment>
  }
`;

/** The lit edge: violet to cyan along the bar, brightest under the lights */
const edgeFragment = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uWidth;
  uniform float uX;
  uniform float uTime;
  varying vec3 vPos;
  void main() {
    float x = vPos.x / uWidth + 0.5;
    vec3 colour = mix(uA, uB, x);
    float lit = exp(-pow((x - uX) * 5.0, 2.0));
    float run = 0.5 + 0.5 * sin(x * 18.0 - uTime * 2.0);
    gl_FragColor = vec4(colour * (0.75 + lit * 1.5 + run * 0.12), 0.65 + lit * 0.35);
    #include <colorspace_fragment>
  }
`;

/** A pill of flowing plasma, with a soft glow round it */
const plasmaFragment = /* glsl */ `
  uniform vec2 uSize;
  uniform float uTime;
  uniform float uEnergy;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 b = uSize * 0.5 - 10.0;
    float r = b.y;
    vec2 q = abs(p) - b + r;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    float body = smoothstep(1.0, -1.0, d);
    float glow = exp(-max(d, 0.0) * 0.22);
    vec2 s = vUv * vec2(uSize.x / uSize.y, 1.0) * 2.2;
    float n = fbm(s + vec2(uTime * 0.7, uTime * 0.25)) + 0.35 * fbm(s * 2.3 - vec2(uTime * 1.1, 0.0));
    vec3 colour = mix(uA, uB, smoothstep(0.25, 0.85, n));
    colour = mix(colour, uC, smoothstep(0.75, 1.05, n) * 0.55);
    float a = body * 0.92 + glow * (1.0 - body) * 0.5;
    gl_FragColor = vec4(colour * (1.0 + uEnergy * 0.6), a);
    #include <colorspace_fragment>
  }
`;

const sparkVertex = /* glsl */ `
  attribute float aLife;
  varying float vLife;
  uniform float uDpr;
  void main() {
    vLife = aLife;
    gl_PointSize = (2.0 + aLife * 3.0) * uDpr;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sparkFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    gl_FragColor = vec4(uColor, smoothstep(1.0, 0.0, d) * vLife);
    #include <colorspace_fragment>
  }
`;

function createEdgeMaterial(theme: Theme) {
  return new ShaderMaterial({
    uniforms: {
      uA: { value: violet.clone() },
      uB: { value: theme === 'dark' ? cyan.clone() : new Color('#0e7490') },
      uWidth: { value: 1 },
      uX: { value: 0.5 },
      uTime: { value: 0 },
    },
    vertexShader: plainVertex,
    fragmentShader: edgeFragment,
    transparent: true,
    depthWrite: false,
    blending: looks[theme].blending,
  });
}

function createPlasmaMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uSize: { value: new Vector2(100, 40) },
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uA: { value: new Color('#7c3aed') },
      uB: { value: new Color('#06b6d4') },
      uC: { value: new Color('#f0abfc') },
    },
    vertexShader: plainVertex,
    fragmentShader: plasmaFragment,
    transparent: true,
    depthWrite: false,
  });
}

function createSheenMaterial(theme: Theme) {
  return new ShaderMaterial({
    uniforms: {
      uA: { value: theme === 'dark' ? new Color('#a78bfa') : new Color('#6d28d9') },
      uB: { value: theme === 'dark' ? new Color('#67e8f9') : new Color('#0e7490') },
      uSize: { value: new Vector2(1, 1) },
      uLight: { value: 0 },
      uStrength: { value: theme === 'dark' ? 1 : 0.7 },
    },
    vertexShader: sheenVertex,
    fragmentShader: sheenFragment,
    transparent: true,
    depthWrite: false,
    blending: looks[theme].blending,
  });
}

function createGlassMaterial(theme: Theme) {
  const look = looks[theme];
  return new MeshPhysicalMaterial({
    color: look.glass,
    metalness: 0.05,
    roughness: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: look.env,
    transparent: true,
    opacity: look.opacity,
    depthWrite: false,
  });
}

/** Room light for the glass to reflect (no downloads) */
function lightScene(gl: WebGLRenderer, scene: Scene) {
  const pmrem = new PMREMGenerator(gl);
  const texture: Texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = texture;
  return () => {
    if (scene.environment === texture) scene.environment = null;
    texture.dispose();
  };
}

/* ---------- Sparks thrown off the plasma ---------- */

class Sparks {
  readonly geometry = new BufferGeometry();
  private positions: Float32Array;
  private life: Float32Array;
  private velocity: Float32Array;
  private next = 0;
  alive = 0;

  constructor(private count: number) {
    this.positions = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.velocity = new Float32Array(count * 2);
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aLife', new BufferAttribute(this.life, 1));
  }

  emit(x: number, y: number, w: number, h: number, n: number) {
    for (let i = 0; i < n; i++) {
      const k = this.next++ % this.count;
      const side = Math.random() < 0.5 ? 1 : -1;
      this.positions[k * 3] = x + (Math.random() - 0.5) * w;
      this.positions[k * 3 + 1] = y + side * h * 0.5;
      this.positions[k * 3 + 2] = 4;
      this.velocity[k * 2] = (Math.random() - 0.5) * 60;
      this.velocity[k * 2 + 1] = side * (30 + Math.random() * 70);
      this.life[k] = 1;
    }
    this.alive = n;
  }

  /** Moves them on; returns whether any are still alive */
  update(dt: number) {
    let alive = 0;
    for (let k = 0; k < this.count; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] = Math.max(this.life[k] - dt * 1.4, 0);
      this.positions[k * 3] += this.velocity[k * 2] * dt;
      this.positions[k * 3 + 1] += this.velocity[k * 2 + 1] * dt;
      this.velocity[k * 2 + 1] *= 0.94;
      if (this.life[k] > 0) alive++;
    }
    this.alive = alive;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLife.needsUpdate = true;
    return alive > 0;
  }
}

/* ---------- The plasma's spring ---------- */

interface Pill {
  ready: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vw: number;
  target: number;
}

/** Slides the pill towards a box (scene units); returns whether it's still moving */
function stepPill(
  pill: Pill,
  x: number,
  y: number,
  w: number,
  h: number,
  dt: number,
  still: boolean
) {
  if (!pill.ready || still) {
    Object.assign(pill, { ready: true, x, y, w, h, vx: 0, vw: 0 });
    return false;
  }
  // A spring, so it overshoots a little and stretches as it moves
  pill.vx += ((x - pill.x) * 140 - pill.vx * 16) * dt;
  pill.vw += ((w - pill.w) * 140 - pill.vw * 16) * dt;
  pill.x += pill.vx * dt;
  pill.w += pill.vw * dt;
  pill.y = y;
  pill.h = h;
  const moving = Math.abs(x - pill.x) > 0.05 || Math.abs(pill.vx) > 0.5 || Math.abs(pill.vw) > 0.5;
  if (!moving) Object.assign(pill, { x, w, vx: 0, vw: 0 });
  return moving;
}

function Slab({
  state,
  theme,
  still,
}: {
  state: { current: GlassState };
  theme: Theme;
  still: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const dpr = useThree((s) => s.viewport.dpr);
  const pivotRef = useRef<Group>(null);
  const slabRef = useRef<Mesh>(null);
  const sheenRef = useRef<Mesh>(null);
  const edgeRef = useRef<Mesh>(null);
  const plasmaRef = useRef<Mesh>(null);
  const sparksRef = useRef<Points>(null);
  const lightA = useRef<PointLight>(null);
  const lightB = useRef<PointLight>(null);
  const glass = useMemo(() => createGlassMaterial(theme), [theme]);
  const edge = useMemo(() => createEdgeMaterial(theme), [theme]);
  const sheen = useMemo(() => createSheenMaterial(theme), [theme]);
  const plasma = useMemo(() => createPlasmaMaterial(), []);
  const plasmaGeometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const sparks = useMemo(() => new Sparks(160), []);
  const sparkMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uDpr: { value: 1 }, uColor: { value: new Color('#a5f3fc') } },
        vertexShader: sparkVertex,
        fragmentShader: sparkFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    []
  );
  const live = useRef({
    version: -1,
    pill: { ready: false, x: 0, y: 0, w: 0, h: 0, vx: 0, vw: 0, target: -2 } as Pill,
    last: 0,
  });

  useEffect(() => lightScene(gl, scene), [gl, scene]);

  // DOM events ask for frames through the shared state
  useEffect(() => {
    const shared = state.current;
    setInvalidate(shared, invalidate);
    return () => setInvalidate(shared, () => {});
  }, [state, invalidate]);

  // The lights drift slowly while the pointer is elsewhere: about 12 fps is
  // plenty for that (software WebGL in CI pays for every frame)
  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => {
      if (!state.current.away && !state.current.pointer.over) invalidate();
    }, 80);
    return () => window.clearInterval(id);
  }, [still, state, invalidate]);

  useEffect(() => {
    setUniform(sparkMaterial, 'uDpr', dpr);
  }, [sparkMaterial, dpr]);

  useFrame(() => {
    const s = state.current;
    const own = live.current;
    const now = performance.now();
    const dt = own.last ? Math.min((now - own.last) / 1000, 0.1) : 0;
    own.last = now;
    const t = still ? 0 : now / 1000;
    const pivot = pivotRef.current;
    const slab = slabRef.current;
    const rim = edgeRef.current;
    if (!pivot || !slab || !rim || !s.width) return;

    // Rebuild the slab when the bar's size changes
    if (own.version !== s.version) {
      own.version = s.version;
      slab.geometry.dispose();
      slab.geometry = slabGeometry(s.width, s.height);
      if (sheenRef.current) sheenRef.current.geometry = slab.geometry;
      setUniform(sheen, 'uSize', new Vector2(s.width, s.height));
      rim.geometry.dispose();
      rim.geometry = edgeGeometry(s.width + 1, s.height + 1, 1.4);
      setUniform(edge, 'uWidth', s.width);
      own.pill.ready = false;
    }
    pivot.rotation.x = lookDown;

    // The lights: under the pointer, or drifting slowly along the bar
    const lx = s.pointer.over
      ? s.pointer.x - s.width / 2
      : still
        ? s.width * 0.15
        : Math.sin(t * 0.35) * s.width * 0.38;
    lightA.current?.position.set(lx - 170, 60, 140);
    lightB.current?.position.set(lx + 170, -40, 140);
    setUniform(edge, 'uX', Math.min(Math.max(lx / s.width + 0.5, 0), 1));
    setUniform(sheen, 'uLight', lx);
    setUniform(edge, 'uTime', t);

    // The plasma: on the link pointed at, else on the current page
    const target = s.hover >= 0 && s.hover < s.links ? s.hover : s.active;
    const box = target >= 0 && target < s.links ? s.boxes[target] : null;
    const pill = own.pill;
    const mesh = plasmaRef.current;
    let moving = false;
    if (box && mesh) {
      const [bx, by, bw, bh] = box;
      const x = bx + bw / 2 - s.width / 2;
      const y = -(by + bh / 2 - s.height / 2);
      moving = stepPill(pill, x, y, bw + 8, bh + 2, dt, still);
      if (target !== pill.target && pill.target !== -2 && !still) sparks.emit(x, y, bw, bh + 2, 18);
      pill.target = target;
      const stretch = Math.min(Math.abs(pill.vx) * 0.12, 60);
      const w = pill.w + stretch + 20;
      const h = pill.h + 20;
      mesh.visible = true;
      mesh.position.set(pill.x, pill.y, 3);
      mesh.scale.set(w, h, 1);
      setUniform(plasma, 'uSize', new Vector2(w, h));
      setUniform(plasma, 'uEnergy', Math.min(Math.abs(pill.vx) / 900, 1));
    } else if (mesh) {
      mesh.visible = false;
      pill.target = target;
    }
    setUniform(plasma, 'uTime', t);
    const sparking = sparks.alive > 0 && sparks.update(dt);
    // Keep drawing while anything is moving
    if ((moving || sparking) && !s.away) invalidate();
  });

  const look = looks[theme];
  return (
    <group ref={pivotRef}>
      <ambientLight intensity={theme === 'dark' ? 0.2 : 0.8} />
      <pointLight ref={lightA} color={violet} intensity={look.lights} distance={0} decay={0} />
      <pointLight ref={lightB} color={cyan} intensity={look.lights * 0.85} distance={0} decay={0} />
      <mesh ref={slabRef} material={glass} renderOrder={1}>
        <bufferGeometry />
      </mesh>
      <mesh ref={sheenRef} material={sheen} renderOrder={1.5}>
        <bufferGeometry />
      </mesh>
      <mesh ref={edgeRef} material={edge} position={[0, 0, 1]} renderOrder={2}>
        <bufferGeometry />
      </mesh>
      <mesh
        ref={plasmaRef}
        material={plasma}
        geometry={plasmaGeometry}
        renderOrder={3}
        visible={false}
      />
      <points
        ref={sparksRef}
        geometry={sparks.geometry}
        material={sparkMaterial}
        renderOrder={4}
        frustumCulled={false}
      />
    </group>
  );
}

/**
 * The slab's canvas, behind the bar's links (HeaderGlass places it and
 * feeds it the bar's layout). Shares three.js and R3F with the world's chunk
 */
export default function GlassSlab({
  state,
  theme,
  still,
  onReady,
}: {
  state: { current: GlassState };
  theme: Theme;
  still: boolean;
  onReady: () => void;
}) {
  return (
    <Canvas
      orthographic
      flat
      dpr={[1, 1.5]}
      frameloop="demand"
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 600], near: 1, far: 2000, zoom: 1 }}
      onCreated={onReady}
      style={{ pointerEvents: 'none' }}
    >
      <Slab state={state} theme={theme} still={still} />
    </Canvas>
  );
}
