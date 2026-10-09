'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderGeometry, MathUtils, Vector3 } from 'three';

import { applyGlowTheme, createBeamMaterial } from './materials';
import { stationPower } from './power';
import { stationForPath, stationPositions } from './routes';
import { palettes, setUniform } from './utils';
import { onDocking, worldStore } from './worldStore';

import type { Mesh, ShaderMaterial } from 'three';
import type { StationKey } from './routes';
import type { WorldTheme } from './utils';

/* ------------------------------------------------------------------
   Free roam's docking sequence, in the world: as the clamps close in on
   the HUD (ExploreHud's DockingOverlay, which keeps the role=status
   text), a beam reaches out from the station's docking port to the ship,
   charging up over 0.4s, its energy flowing in towards the station, and
   the station answers: its power-on plays again as an acknowledgement
   (two false starts, a surge, its windows flicking back on) while its
   nav lights chase on one after another (power.tsx). Mounted always and
   hidden, so its shader compiles with the rest of the world; one draw
   while it shows.
   ------------------------------------------------------------------ */

/** Where a station's docking port is, from its centre (the side the pages frame) */
const port = new Vector3(0, 1.5, 6);
/** The beam stops this far short of the ship (world units) */
const shortOf = 4;
/** Seconds the beam takes to charge, and how fast it fades once docking is over (1/s) */
const chargeTime = 0.4;
const fadeRate = 10;
/** The beam's radius at the port; it narrows towards the ship */
const radius = 0.34;

const from = new Vector3();
const toward = new Vector3();
const up = new Vector3(0, 1, 0);

function buildBeam() {
  return createBeamMaterial({
    color: palettes.dark.cyan,
    intensity: 1.9,
    opacity: 0.85,
    speed: 1.2,
  });
}

/**
 * A theme change sets the colour and blending in place: a material rebuilt
 * per theme is disposed before the new one has drawn, so its program would
 * be deleted and linked again mid-switch
 */
function applyBeamTheme(material: ShaderMaterial, theme: WorldTheme) {
  setUniform(material, 'uColor', palettes[theme].cyan);
  applyGlowTheme(material, theme);
}

interface BeamState {
  /** The station being docked at ('' for none) */
  station: StationKey | '';
  /** Docking has begun: the next frame stamps when */
  begun: boolean;
  /** Clock time the beam started */
  at: number;
  /** How charged the beam is, 0..1 */
  charge: number;
}

export function DockingBeam({ theme }: { theme: WorldTheme }) {
  const meshRef = useRef<Mesh>(null);
  const state = useRef<BeamState>({ station: '', begun: false, at: 0, charge: 0 });
  const material = useMemo(() => buildBeam(), []);
  const geometry = useMemo(() => {
    // Along +Y from its base (the port), one unit long: scaled to the gap each frame
    const cylinder = new CylinderGeometry(radius * 0.55, radius, 1, 16, 1, true);
    cylinder.translate(0, 0.5, 0);
    return cylinder;
  }, []);

  useEffect(() => applyBeamTheme(material, theme), [material, theme]);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry]
  );

  useEffect(() => {
    const beam = state.current;
    return onDocking(() => {
      const path = worldStore.docking;
      if (!path) return;
      const station = stationForPath(path);
      beam.station = station === 'lost' ? '' : station;
      beam.begun = !!beam.station;
    });
  }, []);

  useFrame(({ camera, clock }, delta) => {
    const mesh = meshRef.current;
    const beam = state.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    if (beam.begun && beam.station) {
      beam.begun = false;
      beam.at = t;
      beam.charge = 0;
      // The station acknowledges: its power-on plays again, nav lights chasing on
      stationPower[beam.station].onAt = t;
    }
    if (worldStore.docking && beam.station) {
      beam.charge = MathUtils.clamp((t - beam.at) / chargeTime, 0, 1);
    } else {
      beam.charge = MathUtils.damp(beam.charge, 0, fadeRate, Math.min(delta, 0.05));
      if (beam.charge < 0.01) {
        beam.charge = 0;
        beam.station = '';
      }
    }
    if (!beam.station || !beam.charge) {
      mesh.visible = false;
      return;
    }
    from.fromArray(stationPositions[beam.station]).add(port);
    toward.subVectors(camera.position, from);
    const length = toward.length() - shortOf;
    if (length < 0.5) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(up, toward.normalize());
    mesh.scale.set(1, length, 1);
    // Eased in, so it reaches out rather than switching on
    setUniform(material, 'uCharge', beam.charge * beam.charge * (3 - 2 * beam.charge));
    setUniform(material, 'uTime', t);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      visible={false}
      frustumCulled={false}
      renderOrder={4}
    />
  );
}
