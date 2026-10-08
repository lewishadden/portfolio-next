'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, CanvasTexture, Group, SRGBColorSpace, Vector3 } from 'three';

import { inspectEntity, useInspection } from '../inspection';
import { setWorldHover, worldTip } from '../worldStore';

import type { RefObject } from 'react';
import type { InspectionCatalog, InspectionSelection } from '../inspectionTypes';
import type { WorldTheme } from '../utils';
import type { WorldTip } from '../worldStore';

type Evidence = { title: string; label: string; selection: InspectionSelection };

function EvidenceNode({ item, index, theme }: { item: Evidence; index: number; theme: WorldTheme }) {
  const position = useMemo<[number, number, number]>(() => [-2.1, 1.3 - index * 1.3, 0], [index]);
  const tip = useMemo<WorldTip>(() => ({ label: item.title, sub: `Inspect ${item.label.toLowerCase()}` }), [item.title, item.label]);
  const line = useMemo(() => new BufferGeometry().setFromPoints([new Vector3(), new Vector3(...position)]), [position]);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 192;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = theme === 'light' ? '#e9edf4' : '#111726';
      context.fillRect(0, 0, 640, 192);
      context.fillStyle = theme === 'light' ? '#0e7490' : '#67e8f9';
      context.font = '22px monospace';
      context.fillText(item.label.toUpperCase(), 25, 48);
      context.fillStyle = theme === 'light' ? '#182236' : '#f1f5ff';
      context.font = 'bold 32px sans-serif';
      context.fillText(item.title, 25, 112, 590);
      context.font = '22px sans-serif';
      context.fillText('Inspect linked work →', 25, 164);
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, [item.title, item.label, theme]);
  useEffect(() => () => line.dispose(), [line]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <>
      <lineSegments geometry={line}>
        <lineBasicMaterial color={theme === 'light' ? '#0e7490' : '#67e8f9'} transparent opacity={0.6} />
      </lineSegments>
      <group position={position}>
        <mesh>
          <boxGeometry args={[2.3, 0.76, 0.1]} />
          <meshStandardMaterial color={theme === 'light' ? '#8795ad' : '#343d57'} metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh
          position={[0, 0, 0.06]}
          onPointerOver={(event) => { event.stopPropagation(); tip.anchor = event.point.toArray(); setWorldHover(true); worldTip.set(tip); }}
          onPointerOut={() => { setWorldHover(false); if (worldTip.get() === tip) worldTip.set(null); }}
          onClick={(event) => { event.stopPropagation(); inspectEntity(item.selection); }}
        >
          <planeGeometry args={[2.18, 0.65]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

/** Only the selected skill grows evidence branches; the rest of the orbit stays quiet. */
export function SkillEvidenceCluster({ catalog, orbitsRef, theme }: { catalog: InspectionCatalog; orbitsRef: RefObject<Group | null>; theme: WorldTheme }) {
  const selection = useInspection();
  const groupRef = useRef<Group>(null);
  const point = useMemo(() => new Vector3(), []);
  const skill = selection?.kind === 'skill' ? catalog.skills.find(({ id }) => id === selection.id) : null;
  const evidence: Evidence[] = skill ? [
    ...skill.projects.slice(0, 2).flatMap((id) => {
      const project = catalog.projects.find((item) => item.id === id);
      return project ? [{ title: project.title, label: 'Project', selection: { kind: 'project' as const, id, station: 'projects' as const } }] : [];
    }),
    ...skill.roles.slice(0, 1).flatMap((id) => {
      const role = catalog.roles.find((item) => item.id === id);
      return role ? [{ title: role.company, label: 'Mission log', selection: { kind: 'role' as const, id, station: 'experience' as const } }] : [];
    }),
  ] : [];

  useFrame(({ camera }) => {
    const group = groupRef.current;
    const badge = skill && orbitsRef.current?.getObjectByName(skill.name);
    if (!group || !badge || !group.parent) return;
    badge.getWorldPosition(point);
    group.parent.worldToLocal(point);
    group.position.copy(point);
    group.lookAt(camera.position);
  });

  if (!skill || !evidence.length) return null;
  return <group ref={groupRef}>{evidence.map((item, index) => <EvidenceNode key={`${item.selection.kind}:${item.selection.id}`} item={item} index={index} theme={theme} />)}</group>;
}
