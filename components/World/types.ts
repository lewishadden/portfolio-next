import type { ThreeElements } from '@react-three/fiber';

export type GroupProps = ThreeElements['group'];

/** `window`, where requestIdleCallback may be missing (Safari) */
export type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Content the world needs from content.json (serialisable, passed from the root layout) */
export interface WorldContent {
  projects: {
    title: string;
    slug: string;
    /** Iconify name of the project's icon: its screen's art when it has no screenshots */
    icon: string;
    /**
     * Up to four screenshots; `tall` marks full-page captures, which scroll on
     * screen, `width` is the source's width in pixels and `index` its
     * position in the project's images in content.json (the gallery's order)
     */
    images: { url: string; tall: boolean; width: number; index: number }[];
  }[];
  /** `level` is how well it is known, 0..100 */
  skills: { name: string; icon: string; category: string; level: number }[];
  categories: string[];
  /**
   * Roles from the top of the timeline down (one tether pod each), with the
   * company's monogram and the mission number its card's patch wears
   */
  roles: { title: string; company: string; initials: string; mission: number }[];
  /** The About page's portrait */
  about: { portrait: string };
  /** Guided tour captions, one per stop */
  tour: { station: string; title: string; text: string }[];
  /** The CV, which one of free roam's hidden signals carries */
  cv: { url: string; name: string };
}
