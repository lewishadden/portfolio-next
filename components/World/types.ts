import type { ThreeElements } from '@react-three/fiber';

export type GroupProps = ThreeElements['group'];

/** Content the world needs from content.json (serialisable, passed from the root layout) */
export interface WorldContent {
  projects: { title: string; image?: string }[];
  skills: { name: string; icon: string; category: string }[];
  categories: string[];
  experienceCount: number;
}
