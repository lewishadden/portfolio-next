'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import {
  AdditiveBlending,
  Color,
  DataTexture,
  FrontSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
} from 'three';

import { bloomMaskLayer, maskBloom } from '../bloomMask';
import { decodeImage } from '../imageDecoder';
import { asGlow, createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { HabitatRing, NavLights, SolarArray, Spin } from '../parts';
import { StationScope } from '../power';
import {
  createReaction,
  easeInOut,
  stepReaction,
  trickProgress,
  useReactionHandlers,
  useRedrawOnTargetHover,
  useShowcase,
} from '../reaction';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { StationHull } from '../StationHull';
import { stationModels, stationPositions } from '../stations';
import { seededRandom, setUniform } from '../utils';
import { queueUpload } from '../warmup';
import { worldStore } from '../worldStore';

import type { ThreeEvent } from '@react-three/fiber';
import type { BufferGeometry } from 'three';
import type { NavLight } from '../parts';
import type { WorldPalette, WorldTheme } from '../utils';

const helmetTip = { label: 'Helmet cam online', sub: 'Click to spin it' };

const habitatLights: NavLight[] = [
  { position: [-4.3, 0.1, 0], kind: 'white' },
  { position: [4.2, 0.1, 0], kind: 'white', phase: 0.8 },
  { position: [0.6, 5.65, 0], kind: 'red' },
  { position: [0.6, -5.65, 0], kind: 'green' },
  { position: [0, 1.65, 0.8], kind: 'cyan' },
  { position: [0, -1.6, 0.8], kind: 'violet' },
];

/** Seconds the helmet's spin takes */
const spinTime = 1.3;

/**
 * The motes drifting up round the helmet, one instanced draw: cyan or
 * violet each (`aTone`), and like the station's other glows they follow its
 * power (`uCharge`)
 */
function createMoteMaterial(p: WorldPalette) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uColorA: { value: new Color(p.cyan) },
        uColorB: { value: new Color(p.violet) },
        uCharge: { value: 1 },
        uLight: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aTone;
        varying float vTone;
        void main() {
          vTone = aTone;
          vec4 local = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            local = instanceMatrix * local;
          #endif
          gl_Position = projectionMatrix * modelViewMatrix * local;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA, uColorB;
        uniform float uCharge, uLight;
        varying float vTone;
        void main() {
          gl_FragColor = vec4(mix(uColorA, uColorB, vTone) * max(uCharge, 1.0), 0.85 * min(uCharge, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );
}

interface Mote {
  angle: number;
  radius: number;
  speed: number;
  offset: number;
  size: number;
}

const moteCount = 26;
const moteDummy = new Object3D();

/** Places every mote for clock time `t`: each rises through the rings and starts again below */
function placeMotes(mesh: InstancedMesh | null, motes: Mote[], t: number) {
  if (!mesh) return;
  motes.forEach((m, i) => {
    const y = ((t * m.speed + m.offset) % 5) - 2.5;
    moteDummy.position.set(Math.cos(m.angle + t * 0.1) * m.radius, y, Math.sin(m.angle) * m.radius);
    moteDummy.scale.setScalar(m.size);
    moteDummy.updateMatrix();
    mesh.setMatrixAt(i, moteDummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/* ------------------------------------------------------------------
   The helmet cam: the visor shows the portrait from the About page, as
   if seen from inside the helmet. A shell just over the visor's glass
   (a sphere segment fitted once to the GLB) carries it: scanlines, a
   fresnel edge, and a scan that sweeps it in from the top. It shows for
   a moment after a click on the helmet, and while the portrait on the
   page is pointed at or focused. Kept out of bloom, so the photo shows
   at its own brightness.
   ------------------------------------------------------------------ */

/**
 * The visor's sphere in the helmet's frame (the model is 2.8 high, and its
 * visor looks along `facing`: nearly -X, towards the page's copy), and the
 * patch of it the glass covers, fitted by eye against the GLB
 */
const visor = {
  centre: [-0.177, 0, 0.031] as [number, number, number],
  radius: [1.11, 1.055, 1.11] as [number, number, number],
  /** Which way it looks: the angle about Y from -X (SphereGeometry's phi) */
  facing: 0.17,
  /** Half its width and height on the sphere (radians), and how far above the equator it is centred */
  halfWidth: 0.82,
  halfHeight: 0.42,
  lift: 0,
};

/** Seconds the scan takes to sweep in, how long a click holds it, and how fast it goes */
const scanIn = 0.4;
const scanHold = 2;
const scanOut = 0.5;

/** Stands in for the portrait until it is decoded (the shell isn't drawn till then) */
const noPortrait = new DataTexture(new Uint8Array(4), 1, 1);
noPortrait.needsUpdate = true;

function visorGeometry() {
  return new SphereGeometry(
    1,
    48,
    24,
    visor.facing - visor.halfWidth,
    visor.halfWidth * 2,
    Math.PI / 2 - visor.lift - visor.halfHeight,
    visor.halfHeight * 2
  );
}

function createVisorMaterial(p: WorldPalette) {
  return asGlow(
    new ShaderMaterial({
      uniforms: {
        uMap: { value: noPortrait },
        /** Width over height of the portrait, cropped to fill the visor */
        uAspect: { value: 1 },
        uShow: { value: 0 },
        uTime: { value: 0 },
        uCharge: { value: 1 },
        uLight: { value: 0 },
        uTint: { value: new Color(p.cyan) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uAspect, uShow, uTime, uCharge, uLight;
        uniform vec3 uTint;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          // The scan sweeps down from the top as it comes in, and back up as it goes
          float line = 1.0 - vUv.y;
          float reveal = 1.0 - smoothstep(uShow * 1.15 - 0.15, uShow * 1.15, line);
          if (reveal <= 0.0) discard;
          // The glass is about twice as wide as high: a window on the face and
          // shoulders, as wide as the portrait allows
          vec2 uv = vec2(
            0.5 + (vUv.x - 0.5) * min(0.96, 0.64 / max(uAspect, 0.1)),
            0.56 + (vUv.y - 0.5) * 0.32
          );
          vec3 photo = texture2D(uMap, uv).rgb;
          float lines = 0.8 + 0.2 * sin(vUv.y * 240.0 - uTime * 3.0);
          float facing = abs(dot(normalize(vNormal), normalize(vView)));
          float rim = pow(clamp(1.0 - facing, 0.0, 1.0), 2.0);
          // A bright band at the scan's leading edge, the glass's edge soft
          float band = smoothstep(0.06, 0.0, abs(line - uShow * 1.15 + 0.07)) * (1.0 - uShow * uShow);
          float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x)
            * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
          vec3 col = photo * lines * mix(0.85, 1.0, uLight) + uTint * (rim * 0.6 + band * 1.2);
          float alpha = reveal * edge * mix(0.9, 0.8, uLight) * min(uCharge, 1.0);
          gl_FragColor = vec4(col * max(uCharge, 1.0), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: FrontSide,
      toneMapped: false,
    })
  );
}

/** Page targets this station answers: the portrait scans onto the visor */
const answersPortrait = (target: string) => target === 'about:portrait';

/** What the visor is doing: the last click (clock time) and how far shown, 0..1 */
interface VisorState {
  clickAt: number;
  show: number;
}

/**
 * Eases the visor towards shown (a click's hold, or the portrait pointed at
 * on the page) or hidden; at the still level it jumps straight there
 */
function stepVisor(state: VisorState, t: number, dt: number, still: boolean) {
  const wanted =
    worldStore.targetHover === 'about:portrait' || t - state.clickAt < scanIn + scanHold ? 1 : 0;
  if (still) state.show = wanted;
  else if (wanted > state.show) state.show = Math.min(1, state.show + dt / scanIn);
  else state.show = Math.max(0, state.show - dt / scanOut);
  return state.show;
}

/** Keeps the photo on the visor out of bloom while it shows */
function VisorMask({ geometry, shown }: { geometry: BufferGeometry; shown: boolean }) {
  const ref = useRef<Mesh>(null);
  useEffect(() => (ref.current ? maskBloom(ref.current) : undefined), []);
  return <mesh ref={ref} geometry={geometry} layers={bloomMaskLayer} visible={shown} />;
}

const buildMaterials = (p: WorldPalette) => ({
  ringA: createRingMaterial({
    colorA: p.cyan,
    colorB: p.violet,
    intensity: 2,
    dashes: 90,
    speed: 0.02,
    opacity: 0.8,
  }),
  ringB: createRingMaterial({ colorA: p.violet, colorB: p.pink, intensity: 2.2, speed: 0.05 }),
  ringC: createRingMaterial({
    colorA: p.cyan,
    colorB: p.cyan,
    intensity: 1.4,
    dashes: 24,
    speed: -0.04,
    opacity: 0.6,
  }),
  scan: createRingMaterial({ colorA: p.cyan, colorB: p.cyan, intensity: 3, speed: 0.2 }),
  scanDisc: createHaloMaterial({ color: p.cyan, intensity: 1.2, opacity: 0.4 }),
  halo: createHaloMaterial({ color: p.violet, intensity: 1.2, opacity: 0.55 }),
  motes: createMoteMaterial(p),
  visor: createVisorMaterial(p),
});

/** `/about` — the helmet, circled by holographic data rings and a scanning plane */
export function AboutStation({ theme, portrait }: { theme: WorldTheme; portrait: string }) {
  const groupRef = useRef<Group>(null);
  const helmetRef = useRef<Group>(null);
  const ringsRef = useRef<Group>(null);
  const scanRef = useRef<Group>(null);
  const motesRef = useRef<InstancedMesh>(null);
  const materials = useThemedMaterials(buildMaterials, theme, 'about');
  const reaction = useRef(createReaction());
  const baseHandlers = useReactionHandlers(reaction, helmetTip, spinTime);
  useShowcase('about', helmetRef, reaction, spinTime);
  const visorRef = useRef<Mesh>(null);
  const visorState = useRef<VisorState>({ clickAt: -Infinity, show: 0 });
  const [visorShown, setVisorShown] = useState(false);
  const still = useThree((s) => s.frameloop === 'demand');
  const invalidate = useThree((s) => s.invalidate);
  useRedrawOnTargetHover(answersPortrait);
  // A click spins the helmet and scans the portrait onto its visor
  const handlers = useMemo(
    () => ({
      ...baseHandlers,
      onClick(e: ThreeEvent<MouseEvent>) {
        baseHandlers.onClick(e);
        visorState.current.clickAt = reaction.current.now;
        // On demand, one more frame takes it down again after the hold
        if (still) window.setTimeout(invalidate, (scanIn + scanHold) * 1000 + 50);
      },
    }),
    [baseHandlers, still, invalidate]
  );

  // The portrait, decoded off the main thread at 512 wide and uploaded on a frame of its own
  const gl = useThree((s) => s.gl);
  const [photo, setPhoto] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true;
    const url = `/_next/image?url=${encodeURIComponent(portrait)}&w=640&q=75`;
    decodeImage(url, {
      imageOrientation: 'flipY',
      premultiplyAlpha: 'none',
      resizeWidth: 512,
      resizeQuality: 'high',
    })
      .then(async (bitmap) => {
        if (!alive) return;
        const texture = new Texture(bitmap);
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
        texture.userData.aspect = bitmap.width / bitmap.height;
        texture.needsUpdate = true;
        await queueUpload(gl, texture);
        if (alive) setPhoto(texture);
        else texture.dispose();
      })
      // No portrait, no helmet cam: the visor stays as it is
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [gl, portrait]);
  useEffect(() => () => photo?.dispose(), [photo]);
  useEffect(() => {
    setUniform(materials.visor, 'uMap', photo ?? noPortrait);
    setUniform(materials.visor, 'uAspect', photo?.userData.aspect ?? 1);
  }, [materials, photo]);
  const shellGeometry = useMemo(() => visorGeometry(), []);
  useEffect(() => () => shellGeometry.dispose(), [shellGeometry]);

  const motes = useMemo<Mote[]>(() => {
    const random = seededRandom(41);
    return Array.from({ length: moteCount }, () => ({
      angle: random() * Math.PI * 2,
      radius: 1.8 + random() * 1.6,
      speed: 0.25 + random() * 0.5,
      offset: random() * 6,
      size: 0.025 + random() * 0.04,
    }));
  }, []);
  // Every third mote is violet, the rest cyan
  const moteGeometry = useMemo(() => {
    const geometry = new SphereGeometry(1, 8, 8);
    const tones = Float32Array.from({ length: moteCount }, (_, i) => (i % 3 ? 0 : 1));
    geometry.setAttribute('aTone', new InstancedBufferAttribute(tones, 1));
    return geometry;
  }, []);
  useEffect(() => () => moteGeometry.dispose(), [moteGeometry]);

  useFrame(({ camera, clock }, delta) => {
    if (!stationInRange(groupRef.current, camera, 'about')) return;
    const t = clock.elapsedTime;
    const r = reaction.current;
    stepReaction(r, t, Math.min(delta, 0.05));
    for (const material of [materials.ringA, materials.ringB, materials.ringC, materials.scan]) {
      setUniform(material, 'uTime', t);
    }

    const helmet = helmetRef.current;
    if (helmet) {
      // The visor follows the pointer, turns to face you on hover, spins on click
      const spin = trickProgress(r, spinTime);
      helmet.position.y = 0.35 + Math.sin(t * 0.8) * 0.14 + r.amount * 0.1;
      helmet.rotation.y =
        (0.15 + Math.sin(t * 0.3) * 0.3) * (1 - r.amount * 0.8) +
        r.yaw * 0.75 +
        (spin >= 0 ? easeInOut(spin) * Math.PI * 2 : 0);
      helmet.rotation.x = -r.pitch * 0.35;
      helmet.scale.setScalar(1 + r.amount * 0.06);
    }

    const rings = ringsRef.current;
    if (rings) {
      rings.children[0].rotation.z = t * 0.12;
      rings.children[1].rotation.z = -t * 0.08;
      rings.children[2].rotation.z = t * 0.2;
    }

    const scan = scanRef.current;
    if (scan) scan.position.y = Math.sin(t * 0.7) * 1.35;

    placeMotes(motesRef.current, motes, t);

    // The helmet cam: nothing to draw until the portrait is in and asked for
    const shown = stepVisor(visorState.current, t, Math.min(delta, 0.05), still) > 0;
    const shell = visorRef.current;
    if (shell) shell.visible = shown && photo !== null;
    if (shown !== visorShown) setVisorShown(shown);
    setUniform(materials.visor, 'uShow', visorState.current.show);
    // Scanlines hold still at the still level
    if (!still) setUniform(materials.visor, 'uTime', t);
  });

  return (
    <StationScope station="about">
      <group ref={groupRef} position={stationPositions.about}>
        {/* The crew habitat, cupola turned towards the visitor */}
        <group position={[-3.4, 3.7, -15]} rotation={[0.2, 0.55, 0.08]}>
          <Spin>
            <StationHull station="about" height={3.2} theme={theme} />
            {/* Its habitat ring, turning about the module for gravity */}
            <Spin speed={0.32}>
              <HabitatRing rotation={[Math.PI / 2, 0, 0]} radius={2.9} tube={0.16} spokes={4} />
            </Spin>
            {/* Wings above and below the module, panels turned to face out */}
            <group position={[0.6, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
              <SolarArray rotation={[Math.PI / 2, 0, 0]} length={4.4} width={1.3} panels={3} />
            </group>
            <group position={[0.6, -1.2, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <SolarArray rotation={[-Math.PI / 2, 0, 0]} length={4.4} width={1.3} panels={3} />
            </group>
            <NavLights lights={habitatLights} />
          </Spin>
        </group>

        <Billboard position={[0, 0, -3]}>
          <mesh material={materials.halo} scale={9}>
            <planeGeometry />
          </mesh>
        </Billboard>

        <group ref={ringsRef}>
          <mesh material={materials.ringA} rotation={[Math.PI / 2.3, 0.2, 0]}>
            <torusGeometry args={[2.35, 0.012, 8, 240]} />
          </mesh>
          <mesh material={materials.ringB} rotation={[Math.PI / 2.6, -0.5, 0]}>
            <torusGeometry args={[2.75, 0.02, 12, 240]} />
          </mesh>
          <mesh material={materials.ringC} rotation={[1.9, 0.6, 0]}>
            <torusGeometry args={[3.15, 0.012, 8, 240]} />
          </mesh>
        </group>

        <group ref={scanRef}>
          <mesh material={materials.scan} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.85, 0.01, 8, 180]} />
          </mesh>
          <mesh material={materials.scanDisc} rotation={[-Math.PI / 2, 0, 0]} scale={3.6}>
            <planeGeometry />
          </mesh>
        </group>

        <instancedMesh
          ref={motesRef}
          args={[moteGeometry, materials.motes, moteCount]}
          frustumCulled={false}
          onUpdate={(mesh) => placeMotes(mesh, motes, 0)}
        />

        <group ref={helmetRef}>
          <Model url={stationModels.about!} height={2.8} theme={theme} />
          {/* The helmet cam, just over the visor's glass */}
          <group position={visor.centre} scale={visor.radius}>
            <mesh
              ref={visorRef}
              geometry={shellGeometry}
              material={materials.visor}
              scale={1.002}
              visible={false}
            />
            <VisorMask geometry={shellGeometry} shown={visorShown && photo !== null} />
          </group>
          {/* Never drawn: the helmet's target for the pointer (a sphere, not its triangles) */}
          <mesh visible={false} {...handlers}>
            <sphereGeometry args={[1.35, 16, 12]} />
          </mesh>
        </group>
      </group>
    </StationScope>
  );
}
