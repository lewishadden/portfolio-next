import type { ThreeElements } from '@react-three/fiber';

export type GroupProps = ThreeElements['group'];

/** Content the world needs from content.json (serialisable, passed from the root layout) */
export interface WorldContent {
  projects: {
    title: string;
    slug: string;
    /** Up to four screenshots; `tall` marks full-page captures, which scroll on screen */
    images: { url: string; tall: boolean }[];
  }[];
  skills: { name: string; icon: string; category: string }[];
  categories: string[];
  /** Roles from the top of the timeline down (one tether pod each) */
  roles: { title: string; company: string }[];
  /** Guided tour captions, one per stop */
  tour: { station: string; title: string; text: string }[];
  /** The CV, which one of free roam's hidden signals carries */
  cv: { url: string; name: string };
}
