'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { easing } from 'maath';
import {
  CanvasTexture,
  DataTexture,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three';

import { ambientTime, pastStamp } from '../clock';
import { setProjectorEmitter } from '../HeadingProjector';
import { createBeamMaterial, createHaloMaterial, createRingMaterial } from '../materials';
import { Model } from '../Model';
import { Antenna, NavLights, SolarArray, Spin } from '../parts';
import { drawPatchAtlas, patchColumns } from '../patches';
import { spawnPing } from '../Pings';
import { StationScope, stationPower } from '../power';
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
import {
  experienceDepth,
  framedHeight,
  isWideViewport,
  stationModels,
  stationPositions,
} from '../stations';
import { palettes, setUniform } from '../utils';
import { queueUpload, useWarmupTask } from '../warmup';
import { emitCue, focusOnPage, setWorldHover, worldStore, worldTip } from '../worldStore';

import type { ThreeEvent } from '@react-three/fiber';
import type { Object3D, Texture } from 'three';
import type { NavLight } from '../parts';
import type { WorldTip } from '../worldStore';
import type { WorldContent } from '../types';
import type { WorldPalette, WorldTheme } from '../utils';

const satelliteTip = { label: 'Survey satellite', sub: 'Click to ping the beam' };
/** Seconds the satellite's roll takes, and its ping's run down the beam */
const rollTime = 1.4;
const pingTime = 1.8;

const tetherLights: NavLight[] = [
  // Wing tips, mast strobe and the beam's anchor under the hull
  { position: [-5.4, 0.3, 0], kind: 'red' },
  { position: [5.4, 0.3, 0], kind: 'green' },
  { position: [0.2, 3.1, 0], kind: 'white' },
  { position: [0, -1.85, 0], kind: 'cyan' },
  { position: [0.9, 0.6, 0.9], kind: 'violet', phase: 0.6 },
];

/** Which pod the pointer is over (-1 for none): it lights as if it were being read */
type Hovered = { current: number };

/** Page targets this station answers: a role's card lights its pod */
const answersRole = (target: string) => target.startsWith('role:');

/** The role whose card on the page is pointed at or focused (worldStore.targetHover), -1 for none */
function pageRole(count: number) {
  const target = worldStore.targetHover;
  if (!target.startsWith('role:')) return -1;
  const index = Number(target.slice('role:'.length));
  return Number.isInteger(index) && index >= 0 && index < count ? index : -1;
}

/**
 * The satellite's ping running along the beam: down past every pod after
 * its trick, or to one pod when that role's card is pointed at on the
 * page. Clock times in seconds; `to` is the height it runs to
 */
interface BeamPing {
  at: number;
  to: number;
  duration: number;
  /** The trick that started the last full run, so a new one is noticed */
  trickAt: number;
  /** The role pointed at on the page, -1 for none */
  role: number;
  /** When the ping cue last sounded, so a sweep across the cards doesn't chatter */
  cueAt: number;
}

const createBeamPing = (): BeamPing => ({
  at: -Infinity,
  to: 0,
  duration: 1,
  trickAt: -Infinity,
  role: -1,
  cueAt: -Infinity,
});

/** The ping cue sounds at most this often (s) */
const cueGap = 0.15;
const podPoint: [number, number, number] = [0, 0, 0];

/**
 * Starts the beam's ping for a new trick (the whole beam) or a newly
 * pointed-at role (its pod only, with the ping cue from the pod); returns
 * how far through its run it is, or -1 when none is running
 */
function stepBeamPing(
  ping: BeamPing,
  trickAt: number,
  role: number,
  t: number,
  fromY: number,
  nodeYs: number[],
  origin: { x: number; y: number; z: number },
  still: boolean
) {
  ping.at = pastStamp(ping.at, t);
  ping.cueAt = pastStamp(ping.cueAt, t);
  if (trickAt !== ping.trickAt) {
    ping.trickAt = trickAt;
    ping.at = trickAt;
    ping.to = -experienceDepth - 2;
    ping.duration = pingTime;
  }
  if (role !== ping.role) {
    ping.role = role;
    if (role >= 0) {
      // Nothing runs along the beam at the still level: the pod just lights
      if (!still) {
        ping.at = t;
        ping.to = nodeYs[role];
        ping.duration = MathUtils.clamp(0.35 + Math.abs(fromY - nodeYs[role]) * 0.05, 0.35, 1.2);
      }
      if (t - ping.cueAt >= cueGap) {
        ping.cueAt = t;
        podPoint[0] = origin.x;
        podPoint[1] = origin.y + nodeYs[role];
        podPoint[2] = origin.z;
        emitCue('ping', { at: podPoint });
      }
    }
  }
  const since = t - ping.at;
  return since >= 0 && since < ping.duration ? since / ping.duration : -1;
}

function hoverNode(
  e: ThreeEvent<PointerEvent>,
  tip: WorldTip,
  on: boolean,
  hovered: Hovered,
  index: number
) {
  if (on) {
    e.stopPropagation();
    setWorldHover(true);
    worldTip.set(tip);
    hovered.current = index;
  } else {
    setWorldHover(false);
    if (worldTip.get() === tip) worldTip.set(null);
    if (hovered.current === index) hovered.current = -1;
  }
}

/** Stands in for the patch atlas until it is drawn (nothing shows: patches wait for it) */
const noPatches = new DataTexture(new Uint8Array(4), 1, 1);
noPatches.needsUpdate = true;

/**
 * A role's mission patch beside its pod: a cell of the patch atlas
 * (patches.ts, one texture for every role, drawn after the page's fonts
 * load). Not a glow: it follows the station's power like one, though
 */
function createPatchMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: noPatches },
      uCharge: { value: 1 },
      uLight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uCharge, uLight;
      varying vec2 vUv;
      void main() {
        // (not "patch": a reserved word in GLSL ES 3.00)
        vec4 badge = texture2D(uMap, vUv);
        if (badge.a < 0.01) discard;
        gl_FragColor = vec4(
          badge.rgb * mix(0.9, 1.0, uLight) * max(uCharge, 1.0),
          badge.a * min(uCharge, 1.0)
        );
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/** A plane showing role `index`'s cell of the patch atlas */
function patchGeometry(index: number, rows: number) {
  const geometry = new PlaneGeometry(1, 1);
  const column = index % patchColumns;
  const row = Math.floor(index / patchColumns);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    // The atlas's first row is at its top, where the texture's v is 1
    uv.setXY(i, (column + uv.getX(i)) / patchColumns, 1 - (row + 1 - uv.getY(i)) / rows);
  }
  return geometry;
}

/** World units across a patch at full size, and the pod light it shows from */
const patchWidth = 0.9;
const patchFrom = 0.15;

/**
 * A pod's patch tilts upright and grows as the pod lights (eased with the
 * pod's own swell), sewn on crooked as the page's are until it is lit; it
 * isn't drawn below `patchFrom`. `patch` is a drei Billboard: the group
 * inside it is turned to face the camera every frame, so the tilt goes on
 * the plane within that (two levels down), relative to the camera
 */
function showPatch(patch: Object3D | undefined, lit: number, ready: boolean) {
  const plane = patch?.children[0]?.children[0];
  if (!patch || !plane) return;
  patch.visible = ready && lit >= patchFrom;
  if (!patch.visible) return;
  const a = MathUtils.smoothstep(lit, patchFrom, 1);
  plane.scale.setScalar(MathUtils.lerp(0.45, 1, a) * patchWidth);
  plane.rotation.set(MathUtils.lerp(-1.05, 0, a), 0, MathUtils.lerp(-0.16, 0, a));
}

const buildMaterials = (p: WorldPalette) => ({
  core: createBeamMaterial({ color: p.cyan, intensity: 3, speed: 0.6 }),
  glow: createBeamMaterial({ color: p.violet, intensity: 1.3, opacity: 0.24, speed: 0.25 }),
  nodeRing: createRingMaterial({
    colorA: p.violet,
    colorB: p.cyan,
    intensity: 2.2,
    dashes: 36,
    speed: 0.05,
  }),
  halo: createHaloMaterial({ color: p.cyan, intensity: 1.2, opacity: 0.5 }),
  topHalo: createHaloMaterial({ color: p.violet, intensity: 1.2, opacity: 0.5 }),
  patch: createPatchMaterial(),
});

/**
 * Lights a pod by how strongly it is read, pointed at or pinged; its glow
 * follows the station's power. Its children: core, ring, halo, the
 * pointer's target, then its patch. At the still level (frames on demand)
 * it lights at once and its ring holds still
 */
function lightNode(
  node: Group,
  activation: number,
  charge: number,
  patches: boolean,
  dt: number,
  still: boolean
) {
  const [core, ring, halo] = node.children as Mesh[];
  const size = 0.8 + activation * 0.5;
  if (still) node.scale.x = size;
  else easing.damp(node.scale, 'x', size, 0.25, dt);
  node.scale.y = node.scale.z = node.scale.x;
  const material = core.material as MeshStandardMaterial;
  material.emissiveIntensity = (0.4 + activation * 3.2) * charge;
  if (!still) ring.rotation.z += dt * (0.3 + activation * 1.4);
  halo.visible = activation > 0.05;
  halo.scale.setScalar(2.4 + activation * 2.4);
  showPatch(node.children[4], (node.scale.x - 0.8) / 0.5, patches);
}

/**
 * `/experience`: a satellite escorts the camera down a pulsing beam that
 * hangs from the station's hull; one glowing node per role. On the page the
 * camera rides down to the role being read and its node lights (a mission
 * log); elsewhere nodes light as the camera passes them. Hover for the role,
 * click to jump to it on the page.
 */
export function ExperienceStation({
  theme,
  roles,
}: {
  theme: WorldTheme;
  roles: WorldContent['roles'];
}) {
  const count = roles.length;
  const tips = useMemo(
    () =>
      roles.map((role) => ({
        label: `${role.title} · ${role.company}`,
        sub: 'Click to read more',
      })),
    [roles]
  );
  const groupRef = useRef<Group>(null);
  const satelliteRef = useRef<Group>(null);
  const nodesRef = useRef<Group>(null);
  const pingRef = useRef<Group>(null);
  const hovered = useRef(-1);
  const beamPing = useRef(createBeamPing());
  const reaction = useRef(createReaction());
  const handlers = useReactionHandlers(reaction, satelliteTip, rollTime);
  useShowcase('experience', satelliteRef, reaction, rollTime);
  const materials = useThemedMaterials(buildMaterials, theme, 'experience');
  const palette = palettes[theme];
  const beamLength = experienceDepth + 10;
  const still = useThree((s) => s.frameloop === 'demand');
  useRedrawOnTargetHover(answersRole);

  // Every role's mission patch in one texture, drawn once the page's fonts
  // are in, then uploaded on a frame of its own. Redrawn for a new theme;
  // the old one stays on until the new one is up
  const gl = useThree((s) => s.gl);
  const track = useWarmupTask();
  const [patchAtlas, setPatchAtlas] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true;
    const task = drawPatchAtlas(roles, theme).then(async ({ canvas }) => {
      if (!alive) return;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      await queueUpload(gl, texture);
      if (alive) setPatchAtlas(texture);
      else texture.dispose();
    });
    track(task);
    return () => {
      alive = false;
    };
  }, [gl, roles, theme, track]);
  useEffect(() => () => patchAtlas?.dispose(), [patchAtlas]);
  useEffect(
    () => setUniform(materials.patch, 'uMap', patchAtlas ?? noPatches),
    [materials, patchAtlas]
  );
  const patchGeometries = useMemo(() => {
    const rows = Math.max(1, Math.ceil(count / patchColumns));
    return Array.from({ length: count }, (_, i) => patchGeometry(i, rows));
  }, [count]);
  useEffect(
    () => () => patchGeometries.forEach((geometry) => geometry.dispose()),
    [patchGeometries]
  );

  const nodeYs = useMemo(
    () => Array.from({ length: count }, (_, i) => -((i + 0.6) / count) * experienceDepth),
    [count]
  );

  useFrame((state, delta) => {
    const { camera, size } = state;
    const group = groupRef.current;
    if (!stationInRange(group, camera, 'experience') || !group) return;
    // Clicks and hovers are timed by the clock, idle motion by ambient time
    const t = state.clock.elapsedTime;
    const ambient = ambientTime(state);
    const dt = Math.min(delta, 1 / 20);
    setUniform(materials.core, 'uTime', ambient);
    setUniform(materials.glow, 'uTime', ambient);
    setUniform(materials.nodeRing, 'uTime', ambient);

    const localCameraY = camera.position.y - group.position.y;
    const r = reaction.current;
    stepReaction(r, t, dt);

    const satellite = satelliteRef.current;
    if (satellite) {
      const angle = ambient * 0.35;
      // Wide: up beside the copy. Narrow: centred in the stage slot above it
      const framedY = framedHeight('experience', localCameraY, size.width, size.height);
      const targetY = isWideViewport(size.width, size.height)
        ? Math.min(1.6, framedY + 1.8)
        : framedY;
      easing.damp(satellite.position, 'y', targetY, 0.4, dt);
      satellite.position.x = Math.cos(angle) * 2.3;
      satellite.position.z = Math.sin(angle) * 2.3;
      // Keep the sensor eye turned towards the camera as it circles the beam;
      // hovered it turns a little more to you, clicked it rolls
      const roll = trickProgress(r, rollTime);
      satellite.rotation.y = Math.sin(ambient * 0.3) * 0.4 + r.yaw * 0.3 * r.amount;
      satellite.rotation.z =
        Math.sin(ambient * 0.5) * 0.15 + (roll >= 0 ? easeInOut(roll) * Math.PI * 2 : 0);
      satellite.scale.setScalar(1 + r.amount * 0.08);
      // The page heading is projected from the satellite as the camera arrives
      setProjectorEmitter(
        'experience',
        group.position.x + satellite.position.x,
        group.position.y + satellite.position.y,
        group.position.z + satellite.position.z
      );
    }

    // The satellite's ping runs down the beam past every pod after its
    // trick, or to the pod of the role pointed at on the page
    const ping = pingRef.current;
    const role = pageRole(count);
    const fromY = satellite?.position.y ?? 1.6;
    const run = stepBeamPing(
      beamPing.current,
      r.trickAt,
      role,
      t,
      fromY,
      nodeYs,
      group.position,
      still
    );
    if (ping) {
      ping.visible = run >= 0;
      if (run >= 0) {
        ping.position.y = MathUtils.lerp(fromY, beamPing.current.to, run * run);
        ping.scale.setScalar(0.9 + Math.sin(run * Math.PI) * 0.6);
      }
    }

    // The pod of the role being read on the page lights; elsewhere (the
    // tour, free roam) whichever pods the camera passes
    const reading = worldStore.roleFocus;
    const pingY = ping?.visible ? ping.position.y : Infinity;
    const charge = stationPower.experience.charge.value;
    const patches = patchAtlas !== null;
    nodesRef.current?.children.forEach((node, i) => {
      const activation =
        reading > -0.99
          ? Math.max(0, 1 - Math.abs(i - reading) * 1.4)
          : Math.max(0, 1 - Math.abs(localCameraY - nodeYs[i]) / 5);
      // Pointed at (here, or its card on the page), or passed by the satellite's ping
      const noticed = hovered.current === i || role === i ? 0.75 : 0;
      const pinged = Math.max(0, 1 - Math.abs(pingY - nodeYs[i]) / 1.6);
      lightNode(node as Group, Math.max(activation, noticed, pinged), charge, patches, dt, still);
    });
  });

  return (
    <StationScope station="experience">
      <group ref={groupRef} position={stationPositions.experience}>
        <Billboard position={[0, 1, -2.5]}>
          <mesh material={materials.topHalo} scale={9}>
            <planeGeometry />
          </mesh>
        </Billboard>

        {/* The station the beam hangs from, behind it and off to the side */}
        <Spin position={[-4.6, 4.6, -13]}>
          <StationHull station="experience" height={3.4} theme={theme} />
          {/* Wings out to either side, a mast above and the beam's anchor below */}
          <SolarArray
            position={[1.1, 0.3, 0]}
            rotation={[0.9, 0, 0]}
            length={4.3}
            width={1.2}
            panels={3}
          />
          <group position={[-1.1, 0.3, 0]} rotation={[0, Math.PI, 0]}>
            <SolarArray rotation={[-0.9, 0, 0]} length={4.3} width={1.2} panels={3} />
          </group>
          <Antenna position={[0.2, 1.5, 0]} height={1.6} dish={0.45} />
          <NavLights lights={tetherLights} />
        </Spin>

        <group position={[0, 4 - beamLength / 2, 0]}>
          <mesh material={materials.core}>
            <cylinderGeometry args={[0.045, 0.045, beamLength, 12, 1, true]} />
          </mesh>
          <mesh material={materials.glow}>
            <cylinderGeometry args={[0.38, 0.38, beamLength, 24, 1, true]} />
          </mesh>
        </group>

        <group ref={nodesRef}>
          {nodeYs.map((y, i) => (
            <group key={y} position={[0, y, 0]}>
              <mesh>
                <sphereGeometry args={[0.24, 32, 16]} />
                <meshStandardMaterial
                  color={palette.cyan}
                  emissive={palette.cyan}
                  emissiveIntensity={0.4}
                  roughness={0.2}
                  metalness={0.1}
                  toneMapped={false}
                />
              </mesh>
              <mesh material={materials.nodeRing} rotation={[Math.PI / 2.4, 0, 0]}>
                <torusGeometry args={[0.72, 0.016, 8, 120]} />
              </mesh>
              <Billboard visible={false}>
                <mesh material={materials.halo}>
                  <planeGeometry />
                </mesh>
              </Billboard>
              {/* Never drawn: a comfortable target for the pointer */}
              <mesh
                visible={false}
                onPointerOver={(e) => hoverNode(e, tips[i], true, hovered, i)}
                onPointerOut={(e) => hoverNode(e, tips[i], false, hovered, i)}
                onClick={(e) => {
                  e.stopPropagation();
                  spawnPing(e.point);
                  focusOnPage(`role:${i}`);
                }}
              >
                <sphereGeometry args={[0.8, 12, 8]} />
              </mesh>
              {/* Its mission patch, on the copy's side; shown as it lights */}
              <Billboard position={[-1.25, 0.15, 0.3]} visible={false}>
                <mesh geometry={patchGeometries[i]} material={materials.patch} />
              </Billboard>
            </group>
          ))}
        </group>

        <group ref={satelliteRef} position={[2.3, 1.6, 0]}>
          <Model url={stationModels.experience!} height={1.6} theme={theme} />
          {/* Never drawn: the satellite's target for the pointer, along its length */}
          <mesh visible={false} rotation={[Math.PI / 2, 0, 0]} {...handlers}>
            <capsuleGeometry args={[0.8, 1.6, 4, 12]} />
          </mesh>
        </group>

        {/* The satellite's ping, running down the beam */}
        <Billboard ref={pingRef} visible={false}>
          <mesh material={materials.halo} scale={1.6}>
            <planeGeometry />
          </mesh>
        </Billboard>
      </group>
    </StationScope>
  );
}
