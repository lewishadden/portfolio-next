'use client';

import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';

import { CameraRig } from './CameraRig';
import { Dust } from './Dust';
import { Effects } from './Effects';
import { Nebula } from './Nebula';
import { Starfield } from './Starfield';
import { AboutStation } from './stations/AboutStation';
import { ContactStation } from './stations/ContactStation';
import { ExperienceStation } from './stations/ExperienceStation';
import { HomeStation } from './stations/HomeStation';
import { LostStation } from './stations/LostStation';
import { ProjectsStation } from './stations/ProjectsStation';
import { SkillsStation } from './stations/SkillsStation';
import { palettes } from './utils';

import type { StationKey } from './stations';
import type { WorldContent } from './types';
import type { WorldTheme } from './utils';

/** Local studio lighting for PBR reflections — no HDR download needed */
function StudioEnvironment() {
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer
        form="rect"
        intensity={3}
        color="#ffffff"
        position={[0, 5, 6]}
        scale={[10, 4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={5}
        color="#8b5cf6"
        position={[-6, 1, -2]}
        scale={[3, 10, 1]}
      />
      <Lightformer
        form="rect"
        intensity={5}
        color="#22d3ee"
        position={[6, -1, -2]}
        scale={[3, 10, 1]}
      />
      <Lightformer form="ring" intensity={2} color="#f472b6" position={[0, -6, 3]} scale={4} />
    </Environment>
  );
}

/** With frameloop="demand" (reduced motion), repaint on scroll, resize and route changes */
function DemandDriver({ station, theme }: { station: StationKey; theme: WorldTheme }) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    invalidate();
    const repaint = () => invalidate();
    window.addEventListener('scroll', repaint, { passive: true });
    window.addEventListener('resize', repaint);
    // Models stream in after the first paint
    const timers = [400, 1200, 3000].map((ms) => setTimeout(repaint, ms));
    return () => {
      window.removeEventListener('scroll', repaint);
      window.removeEventListener('resize', repaint);
      timers.forEach(clearTimeout);
    };
  }, [invalidate, station, theme]);

  return null;
}

export interface WorldCanvasProps {
  station: StationKey;
  theme: WorldTheme;
  reducedMotion: boolean;
  lite: boolean;
  content: WorldContent;
  onReady: () => void;
}

export default function WorldCanvas({
  station,
  theme,
  reducedMotion,
  lite,
  content,
  onReady,
}: WorldCanvasProps) {
  // Stations mount the first time they are visited and stay mounted so flights
  // back to them are seamless; unvisited stations cost nothing.
  const [visited, setVisited] = useState<StationKey[]>([station]);
  if (!visited.includes(station)) setVisited([...visited, station]);

  const [dpr, setDpr] = useState(lite ? 1.25 : 1.5);
  const palette = palettes[theme];
  const has = (key: StationKey) => visited.includes(key);

  return (
    <Canvas
      className="world__canvas"
      dpr={[1, dpr]}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 42, near: 0.1, far: 2000, position: [0, 0, 60] }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      onCreated={() => requestAnimationFrame(() => onReady())}
    >
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, palette.fog[0], palette.fog[1]]} />
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      {reducedMotion && <DemandDriver station={station} theme={theme} />}

      <CameraRig station={station} reducedMotion={reducedMotion} />

      <ambientLight intensity={palette.ambient} />
      <hemisphereLight args={['#c4b5fd', '#0e7490', theme === 'dark' ? 0.55 : 0.8]} />
      <directionalLight position={[6, 10, 8]} intensity={palette.key} />
      <Suspense fallback={null}>
        <StudioEnvironment />
      </Suspense>

      <Nebula theme={theme} octaves={lite ? 4 : 5} size={lite ? 1024 : 2048} />
      <Starfield count={lite ? 1800 : 4200} theme={theme} />
      <Dust count={lite ? 260 : 600} theme={theme} />

      {has('home') && <HomeStation theme={theme} />}
      {has('about') && <AboutStation theme={theme} />}
      {has('experience') && <ExperienceStation theme={theme} count={content.experienceCount} />}
      {has('projects') && <ProjectsStation theme={theme} projects={content.projects} />}
      {has('skills') && (
        <SkillsStation theme={theme} skills={content.skills} categories={content.categories} />
      )}
      {has('contact') && <ContactStation theme={theme} />}
      {has('lost') && <LostStation theme={theme} />}

      <Effects theme={theme} lite={lite} />
    </Canvas>
  );
}
