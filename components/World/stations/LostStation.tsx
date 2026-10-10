'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { Group, MathUtils, Quaternion, Vector3 } from 'three';

import { ambientTime } from '../clock';
import { createBeamMaterial, createHaloMaterial } from '../materials';
import { Model } from '../Model';
import { NavLights } from '../parts';
import { StationScope } from '../power';
import {
  createReaction,
  easeInOut,
  stepReaction,
  trickProgress,
  useReactionHandlers,
  useShowcase,
} from '../reaction';
import { spawnPing } from '../Pings';
import { Shards } from '../Shards';
import { isFound, markFound } from '../signalStore';
import { StationHull } from '../StationHull';
import { stationInRange, useThemedMaterials } from '../stationHooks';
import { stationModels, stationPositions } from '../stations';
import { setUniform } from '../utils';
import { worldMode } from '../worldMode';
import { emitCue, navigateTo, worldTip } from '../worldStore';

import type { ThreeEvent } from '@react-three/fiber';
import type { Object3D } from 'three';
import type { WorldPalette, WorldTheme } from '../utils';

const buildMaterials = (p: WorldPalette) => ({
  halo: createHaloMaterial({ color: p.pink, intensity: 1, opacity: 0.35 }),
  tractor: createBeamMaterial({ color: p.cyan, intensity: 2.4, opacity: 0.85, speed: -0.9 }),
  tractorGlow: createBeamMaterial({ color: p.violet, intensity: 1.2, opacity: 0.22, speed: -0.4 }),
});

const lostTip = { label: 'Lost in space', sub: 'Click to give them a nudge' };
/** Once the wreck has the astronaut: the next click heads home (or, in free roam, logs the find) */
const lockedTip = { label: 'Signal locked', sub: 'Click to plot a course home' };
const loggedTip = { label: 'Signal locked', sub: 'Click to log the derelict' };
/** Seconds the astronaut flails after a nudge */
const flailTime = 1.6;
/** Nudges before the wreck locks a tractor beam on, and the seconds the beam takes to reach */
const nudgesToLock = 3;
const beamReach = 0.6;
/** Where the wreck sits, from the station's centre */
const wreckAt = new Vector3(-3.2, 1.2, -6);

/** Nudges so far, and when the tractor beam locked on (clock time, -Infinity while it hasn't) */
interface Rescue {
  nudges: number;
  lockedAt: number;
}

const isLocked = (rescue: Rescue) => rescue.lockedAt > -Infinity;

const tipFor = () => (worldMode.get().mode === 'explore' ? loggedTip : lockedTip);

/**
 * Locked on: the click plots a course home (or, in free roam, logs the
 * derelict, as flying close to it does: Signals plays the find out, its
 * ping, burst, nameplate and sound), and the rescue starts over
 */
function answerLocked(rescue: Rescue) {
  rescue.nudges = 0;
  rescue.lockedAt = -Infinity;
  const tip = worldTip.get();
  if (tip === lockedTip || tip === loggedTip) worldTip.set(lostTip);
  if (worldMode.get().mode === 'explore') {
    markFound('derelict');
    return;
  }
  navigateTo('/');
}

const beamUp = new Vector3(0, 1, 0);
const beamDir = new Vector3();
const beamTurn = new Quaternion();

/** Stretches the tractor beam (a unit cylinder along Y) from the wreck towards the astronaut */
function placeBeam(beam: Object3D, to: Vector3, reach: number) {
  beamDir.subVectors(to, wreckAt);
  const length = beamDir.length() * reach;
  beamDir.normalize();
  beam.quaternion.copy(beamTurn.setFromUnitVectors(beamUp, beamDir));
  beam.position.copy(wreckAt).addScaledVector(beamDir, length / 2);
  beam.scale.set(1, Math.max(length, 1e-3), 1);
}

/** 404 — the astronaut has drifted off the map */
export function LostStation({ theme }: { theme: WorldTheme }) {
  const groupRef = useRef<Group>(null);
  const driftRef = useRef<Group>(null);
  const wreckRef = useRef<Group>(null);
  const materials = useThemedMaterials(buildMaterials, theme, 'lost');
  const reaction = useRef(createReaction());
  const baseHandlers = useReactionHandlers(reaction, lostTip, flailTime);
  useShowcase('lost', driftRef, reaction, flailTime);
  const beamRef = useRef<Group>(null);
  const rescue = useRef<Rescue>({ nudges: 0, lockedAt: -Infinity });
  const invalidate = useThree((s) => s.invalidate);

  // Three nudges and the wreck locks a tractor beam on; the click after that heads home
  const handlers = useMemo(
    () => ({
      onPointerOver(e: ThreeEvent<PointerEvent>) {
        baseHandlers.onPointerOver(e);
        if (isLocked(rescue.current)) worldTip.set(tipFor());
      },
      onPointerOut(e: ThreeEvent<PointerEvent>) {
        baseHandlers.onPointerOut(e);
        const tip = worldTip.get();
        if (tip === lockedTip || tip === loggedTip) worldTip.set(null);
      },
      onClick(e: ThreeEvent<MouseEvent>) {
        const state = rescue.current;
        if (isLocked(state)) {
          e.stopPropagation();
          // A click that logs the derelict sounds as its find (Signals), not a ping too
          const logs = worldMode.get().mode === 'explore' && !isFound('derelict');
          spawnPing(e.point, { cue: !logs });
          answerLocked(state);
          invalidate();
          return;
        }
        baseHandlers.onClick(e);
        state.nudges += 1;
        if (state.nudges < nudgesToLock) return;
        state.lockedAt = reaction.current.now;
        emitCue('hud-lock', { at: [e.point.x, e.point.y, e.point.z] });
        if (reaction.current.hovered) worldTip.set(tipFor());
        invalidate();
      },
    }),
    [baseHandlers, invalidate]
  );

  useFrame((state, delta) => {
    const { camera, clock } = state;
    // Clicks are timed by the clock, idle motion by ambient time. The click
    // and lock stamps are stepped even out of range (see stepReaction): a
    // lock from before R3F restarted its clock (so stamped ahead of it)
    // stays locked, restamped as having already reached
    const t = clock.elapsedTime;
    const r = reaction.current;
    stepReaction(r, t, Math.min(delta, 0.05));
    if (rescue.current.lockedAt > t) rescue.current.lockedAt = t - beamReach;
    if (!stationInRange(groupRef.current, camera, 'lost')) return;
    const ambient = ambientTime(state);
    const drift = driftRef.current;
    if (!drift) return;
    // A nudge sends it tumbling faster, limbs flailing, until it slows again
    const flail = trickProgress(r, flailTime);
    const tumble = flail >= 0 ? easeInOut(flail) * Math.PI * 3 : 0;
    const shake = flail >= 0 ? Math.sin(flail * Math.PI) * Math.sin(ambient * 28) * 0.12 : 0;
    drift.rotation.set(
      ambient * 0.21 + tumble,
      ambient * 0.13 + shake,
      ambient * 0.17 + tumble * 0.4
    );
    drift.scale.setScalar(1 + r.amount * 0.05);
    drift.position.set(
      Math.sin(ambient * 0.2) * 0.6,
      Math.cos(ambient * 0.17) * 0.4,
      Math.sin(ambient * 0.1) * 0.8
    );
    const wreck = wreckRef.current;
    if (wreck) wreck.rotation.set(0.4 + ambient * 0.03, ambient * 0.05, 0.3 + ambient * 0.02);

    // The tractor beam reaches out from the wreck once locked (at once at the
    // still level)
    const beam = beamRef.current;
    const locked = isLocked(rescue.current);
    if (beam) beam.visible = locked;
    if (beam && locked) {
      const still = state.frameloop === 'demand';
      const since = t - rescue.current.lockedAt;
      const reach = still ? 1 : MathUtils.smootherstep(since, 0, beamReach);
      placeBeam(beam, drift.position, Math.max(reach, 0.02));
      setUniform(materials.tractor, 'uTime', ambient);
      setUniform(materials.tractorGlow, 'uTime', ambient);
    }
  });

  return (
    <StationScope station="lost">
      <group ref={groupRef} position={stationPositions.lost}>
        <Billboard position={[0, 0, -3]}>
          <mesh material={materials.halo} scale={9}>
            <planeGeometry />
          </mesh>
        </Billboard>
        {/* What's left of the module it drifted from */}
        <group position={[-3.2, 1.2, -6]}>
          <group ref={wreckRef}>
            <StationHull station="lost" height={2.3} theme={theme} />
            <NavLights lights={[{ position: [0.3, 1.05, 0.4], kind: 'white', phase: 0.3 }]} />
          </group>
        </group>
        <Shards count={22} radius={4} seed={17} theme={theme} tumble />
        {/* The wreck's tractor beam, once it has the astronaut */}
        <group ref={beamRef} visible={false}>
          <mesh material={materials.tractor}>
            <cylinderGeometry args={[0.06, 0.06, 1, 12, 1, true]} />
          </mesh>
          <mesh material={materials.tractorGlow}>
            <cylinderGeometry args={[0.42, 0.42, 1, 20, 1, true]} />
          </mesh>
        </group>
        <group ref={driftRef}>
          <Model url={stationModels.lost!} height={3} theme={theme} />
          {/* Never drawn: the astronaut's target for the pointer (a capsule, not its triangles) */}
          <mesh visible={false} {...handlers}>
            <capsuleGeometry args={[0.95, 1.2, 4, 12]} />
          </mesh>
        </group>
      </group>
    </StationScope>
  );
}
