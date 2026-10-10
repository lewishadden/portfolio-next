# World Immersion Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 46 production bugs and build the 65 improvements chosen from the Orbit World Review (8 Oct 2026), so the 3D world is more immersive, more of the site lives in 3D, and everything stays fast, readable and accessible.

**Architecture:** A shared foundation lands first, in order. It covers the motion-preference system, every new DOM-safe store field, event and helper, empty mounted placeholders for every new 3D component, and the high-impact fixes everything else builds on. Twelve lanes then work in parallel git worktrees. Each owns a set of files and consumes the foundation's interfaces, so lanes never need each other's code. Lanes are merged in a fixed order, then the whole branch is verified, reviewed and documented, and shipped as one PR.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, SCSS (BEM), three.js via @react-three/fiber 9 / drei 10 / postprocessing, Framer Motion, Lenis, Playwright e2e.

**How tasks are specified:** 111 items make full inline code impractical. Each task gives the behaviour to build, exact files, the interfaces it consumes or produces, how to verify it, and the test to add where one is practical. Implementers read the referenced code (CLAUDE.md and AGENTS.md map it) before changing it.

## Global Constraints

- Read CLAUDE.md before starting. AGENTS.md has the per-feature history; never contradict a documented rule without fixing its cause.
- Imports go in groups (external, internal, `import type`, styles), separated by blank lines. Every identifier is camelCase, constants included. BEM classes. One folder per component.
- Modules that are DOM-safe (`routes.ts`, `worldStore.ts`, `worldMode.ts`, `pointerLock.ts`, `pageInputs.ts`, `boot.ts`, `bootMemory.ts`, `signalStore.ts`, `ride.ts`, `skillsOrbit.ts`, `utils/motion.ts`, the DOM overlays) must never gain a runtime three.js import.
- **Warm-up:**
  - Every new shader or material compiles before it is first drawn: mount it with the initial scene or inside `<Precompiled>`. For things shown later (free roam, docking), mount them always and hidden (`visible={false}`), or with zero opacity, rather than conditionally.
  - New textures upload through `queueUpload()`. Async GPU work registers with `useWarmupTask()`.
- **Post-processing:** keep the same passes on every quality tier. A new effect goes inside an existing pass (`Effects.tsx`) and is precompiled by `precompileComposer`.
- **React Compiler lint rules:** never mutate hook return values in components. Mutate uniforms per frame through module-level helpers (`setUniform`) and keep per-frame state in plain objects.
- **Materials:** build station materials through a module-level factory plus `useThemedMaterials(factory, theme, station)`. Tag additive glow materials with `asGlow()`.
- **Motion levels**, after Task 0.2: `full`, `calm`, `still`.
  - `still` is today's reduced-motion behaviour: on-demand rendering, camera snaps, nothing ambient moves.
  - `calm` reduces page CSS/JS motion and camera motion (snap, no shake, no lightspeed) but the world keeps rendering and ambient life runs.
  - Every new animation must be correct at all three levels.
- **World off** (`html[data-world='off']`), **no JavaScript** (`tests/e2e/no-js.spec.ts`) and **lite devices** (`liteQuery`) keep working. Lite devices get smaller counts, and new lights are never shadow casters.
- **Accessibility:**
  - Content stays in the DOM.
  - The canvas stays `aria-hidden`.
  - New controls are keyboard-operable with visible focus.
  - Text over the world must reach 4.5:1.
  - No flashes over 3 per second.
- **Performance:** no new post passes, and no full-screen transparent geometry around the camera (it is a fill-rate trap on SwiftShader CI). Count instanced draws, and check the stats overlay (⌥⇧S) before and after: draw calls on a settled page must not rise by more than ~5.
- **Copy:** British spelling, no em-dashes in user-facing text, sentence case.
- **Commits:** one per item, with a plain-English title about the visible effect followed by the item IDs in brackets, e.g. `Sector map hides once the page arrives (FX04)`. The body says what was wrong or missing and what changed. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Verification per item:**
  - `npm run typecheck` and `npm run lint`.
  - Check behaviour visually on a production build (`next build` behind the shared build lock, then `next start -p <lane port>`), using your own headless Playwright with `--use-angle=metal`. Never use the shared in-app browser.
  - Run the e2e specs your files touch against your server (`PLAYWRIGHT_BASE_URL=http://localhost:<port> npx playwright test <spec>`).
- **Build lock:** at most two `next build`s run on the machine at once. Wrap builds:
  `until mkdir /tmp/wi-build-1 2>/dev/null || mkdir /tmp/wi-build-2 2>/dev/null; do sleep 5; done`
  Remove the lock you took when the build ends, including on failure.
- **Lanes:**
  - Do not edit another lane's files except where a task says so.
  - Do not edit AGENTS.md or CLAUDE.md: put doc notes in your lane report (Task 99 writes the docs).

---

## Interface contract (produced by Task 0.3; every lane consumes it)

```ts
// components/World/worldStore.ts (DOM-safe)
worldStore.flight.duration: number            // planned flight length in seconds (0 when none); CameraRig.startFlight writes it
worldStore.targetHover: string                // '' | 'skill:<name>' | 'role:<i>' | 'contact:<name>' | 'project:<i>' | 'globe:home' | 'about:portrait'
worldStore.readingRects: Float32Array         // length 24: up to 6 rects [x0, y0, x1, y1], viewport fractions 0..1, y down
worldStore.readingLarge: Uint8Array           // length 6: 1 when that rect's text is large (≥24px, or ≥18.66px bold)
worldStore.readingCount: number               // 0..6
worldStore.clearRight: number                 // NDC x (-1..1) of the right edge of the widest '#main-content .glass' crossing the reading line; -1 when none
worldStore.skillFocus: number                 // fractional index among [data-world-category] at the reading line; -1 off /skills
worldStore.worldWindow: { top: number; height: number }   // CSS px of the [data-world-window] nearest the reading line; top -1 when none
worldStore.screenRect: { left: number; top: number; right: number; bottom: number; on: boolean } // CSS px, front helix screen
worldStore.projectShot: { project: number; image: number }  // gallery slide shown (content indexes); -1 / -1 when no gallery
worldStore.screenShown: Int8Array             // length 16: content image index each helix screen shows (-1 unknown)
worldStore.tipBox: { x0: number; y0: number; x1: number; y1: number; on: boolean } // CSS px of the hovered 3D object's projected box
worldStore.heroRole: string                   // the hero role line as currently displayed (decoding included)
worldStore.composing: number                  // contact form message length / limit, 0..1
worldStore.commsFocus: boolean                // a contact form field has focus
worldStore.autopilotPath: Float32Array        // x,y,z triples of the autopilot's course; length 0 when none
worldStore.edge: number                       // free roam: 0..1 closeness to the world's edge
worldStore.charge: Partial<Record<StationKey, number>>   // stations mid power-on (absent = fully powered)
worldStore.intent: StationKey | ''            // the station the visitor is about to fly to (pointerdown on its link, its page-nav in view)

export const chrome: { menuOpen: boolean; modalCover: boolean };
export function setChrome(next: Partial<{ menuOpen: boolean; modalCover: boolean }>): void;
export function onChrome(listener: () => void): () => void;

export type ShowcaseReason = 'tour' | 'hail';
export function showcase(station: StationKey, reason: ShowcaseReason): void;
export function onShowcase(listener: (station: StationKey, reason: ShowcaseReason) => void): () => void;

export interface CueDetail { at?: readonly [number, number, number]; strength?: number }
export function emitCue(cue: Cue, detail?: CueDetail): void;
export function onCue(listener: (cue: Cue, detail?: CueDetail) => void): () => void;
// Cue gains: 'tick' | 'pod' | 'sonar' | 'scan' | 'arrive' | 'edge' | 'hail'

// components/World/worldMode.ts
export function navigateFromMode(path: string): void; // page mode: snapshot + navigate; tour/explore: navigate, leave the mode on arrival
export function arrivedAt(pathname: string): void;     // World.tsx calls it on every pathname change

// components/World/routes.ts
export function rangeBetween(a: StationKey, b: StationKey): number; // whole world units ("km"), centre to centre

// components/World/ride.ts (new, DOM-safe)
export function settleFocus(focus: number): number;   // moved from stations.ts, which re-exports it

// components/World/skillsOrbit.ts (new, DOM-safe)
export const orbitTilts: [number, number][];          // moved from SkillsStation.tsx

// components/World/signalStore.ts
export function reportNearest(distance: number, at?: readonly [number, number, number]): void;
export function nearestAt(): readonly [number, number, number] | null;

// utils/motion.ts (new, DOM-safe) + hooks/useMotion.ts
export type MotionPref = 'system' | 'full' | 'calm' | 'still';
export type MotionLevel = 'full' | 'calm' | 'still';
export function motionPref(): MotionPref;
export function motionLevel(): MotionLevel;           // 'system' → OS reduce ? 'still' : 'full'
export function setMotionPref(pref: MotionPref): void; // persists (localStorage 'motion', try/catch), sets html[data-motion], notifies
export function subscribeMotion(listener: () => void): () => void;
export function useMotionLevel(): MotionLevel;        // SSR snapshot 'full'
// hooks/useReducedMotion.ts keeps its name and returns useMotionLevel() !== 'full'

// components/World/types.ts WorldContent additions
about: { portrait: string };
roles[]: + { initials: string; mission: number };
skills[]: + { level: number };                        // 0..100 from content.json (a string there)
projects[].images[]: + { index: number };             // position in content.json's images

// Mounted placeholder components (each returns null until its lane fills it)
components/World/CourseLine.tsx       export function CourseLine({ theme }: { theme: WorldTheme })
components/World/Traffic.tsx          export function Traffic({ theme, count, tier }: { theme: WorldTheme; count: number; tier: QualityTier })
components/World/HeadingProjector.tsx export function HeadingProjector({ theme, station }: { theme: WorldTheme; station: StationKey })
components/World/DockingBeam.tsx      export function DockingBeam({ theme }: { theme: WorldTheme })
components/World/Sparks.tsx           export function Sparks({ theme }: { theme: WorldTheme })
components/World/Cockpit.tsx          export function Cockpit({ theme }: { theme: WorldTheme })
components/World/TipProbe.tsx         export function TipProbe()
components/World/EdgeShimmer.tsx      export function EdgeShimmer({ theme }: { theme: WorldTheme })

// Markup contract (pages ↔ world)
[data-reading] / [data-reading='large']  // text blocks the readability guard protects (≤6 measured, nearest the viewport first)
[data-world-window]                     // phone "window" spacer where the camera reframes the station (Task L12)
[data-world-project='<i>']              // anything naming project i (index links, pager cards)
[data-world-target='contact:<name>'] / [data-world-target='globe:home']
html[data-world-expected]               // ThemeScript: the world will run (not off, WebGL, no Save-Data), whatever the boot memory says
html[data-motion='full'|'calm'|'still'] // ThemeScript, before first paint
html[data-flight='cruise']              // World.tsx during flights longer than 1.6s, until approach (Task L2)
```

---

## Wave 0: Foundation (sequential, on `claude/world-immersion`)

### Task 0.1: High-impact fixes that everything sits on (PF1, FX01, DV1)

**Files:** Modify `components/World/WorldCanvas.tsx` (QualityGovernor), `contexts/ThemeContext.tsx`, `components/PageTransition/PageTransition.tsx`. Create `app/global-error.tsx`. Test: `tests/e2e/world.spec.ts`, `tests/e2e/header.spec.ts` (or a new `tests/e2e/resilience.spec.ts`).

- [x] **PF1:** in QualityGovernor, remove `flipflops` / `onFallback`. Ignore `onIncline` when already at the ceiling. Keep `PerformanceMonitor` mounted for the canvas's life, ignoring its callbacks while flying or warming (a ref) instead of unmounting it, so its history survives. Verify: on a prod build at 1440×900 (M3), `html[data-world-tier]` stays `high` for 60s idle and after three flights.
- [x] **FX01:** guard both `localStorage` accesses in ThemeContext with try/catch. Keep an in-memory override that `getThemeSnapshot` prefers (as `useWorldPreference` does). Add `app/global-error.tsx`: minimal, styled with inline tokens, a "Reload" button. Test: an init script makes `Storage.prototype.getItem` / `setItem` throw; `/` renders its h1 and the theme toggle still switches theme.
- [x] **DV1:** make PageTransition's reveal declarative (`shown` state per routeKey; `animate={shown ? 'visible' : 'hidden'}`) so a StrictMode remount can't leave the page hidden. Test: world off, click a header link, and the new page's h1 is visible within 3s. This needs `next dev` to reproduce, so also check by hand on `next dev`.
- [x] Commit each separately.

### Task 0.2: Motion preference system (N4 core)

**Files:**

- Create `utils/motion.ts`, `hooks/useMotion.ts` and an SCSS mixin partial (e.g. `app/_motion.scss`).
- Modify `hooks/useReducedMotion.ts`, `components/ThemeScript/ThemeScript.tsx`, `components/ClientProviders/ClientProviders.tsx` (MotionConfig) and `app/globals.scss`.
- Modify every `@media (prefers-reduced-motion…)` rule. They are in MobileMenu, Projects, BootScreen, World (2), SplitText, Marquee, Recommendations, RoamButton, CommandPalette, Header, globals and ThemeScript's failsafe CSS.
- Modify every direct `matchMedia('(prefers-reduced-motion: reduce)')`. They are in ProjectBody, Projects (2), NavRadar, ExploreControls, BrandMark, Sound/spatial, pageSnapshot, usePointerGlow and useWorldFocus.
- Modify `components/World/World.tsx` and `WorldCanvas.tsx` (pass `motion` instead of the boolean), and `CameraRig.tsx` (snap when `motion !== 'full'`).

**Interfaces:** produces `utils/motion.ts` and `useMotionLevel` as in the contract.

- [x] `ThemeScript` sets `html[data-motion]` before first paint:
  - from localStorage `motion` when it is `full`, `calm` or `still`;
  - otherwise (`system`) `still` if the OS prefers reduced motion, else `full`.
- [x] `subscribeMotion` also listens to the OS media query. `setMotionPref` updates `html[data-motion]`.
- [x] SCSS: a mixin applies a block when the level is calm or still. Without JavaScript (no `data-motion` attribute) it falls back to the OS media query. Replace every reduced-motion media query with it, and the `no-preference` ones with the inverse.
- [x] MotionConfig: `reducedMotion={level === 'full' ? 'never' : 'always'}`. Direct matchMedia checks become `motionLevel() !== 'full'`.
- [x] World:
  - `still` keeps today's behaviour exactly (`frameloop='demand'`, DemandDriver, Spin held still, etc.).
  - `calm` renders `'always'`, the camera snaps, and there are no shake, lightspeed streaks or tricks triggered by tours. Ambient animation (twinkle, nav lights, slow spins, screens cycling, idle bobbing) runs.
  - Under `still`, free roam renders `'always'` while in explore mode (fixes **FX11**).
- [x] Spatial sound's `still` uses `motionLevel() === 'still'`.
- [x] Verify:
  - OS reduce with no preference behaves exactly as before (diff a screenshot and the CSS animation count).
  - `localStorage motion='full'` with OS reduce gives full flights.
  - `calm` keeps the canvas changing frame to frame while the camera snaps on navigation.
  - e2e: add a spec covering the three levels via localStorage (check `html[data-motion]` and that a CSS entrance animation runs only at `full`).
- [x] Commit.

### Task 0.3: Shared stores, events, helpers, content and placeholders

**Files:**

- Modify:
  - World: `components/World/worldStore.ts`, `worldMode.ts`, `routes.ts`, `stations.ts`, `signalStore.ts`, `types.ts`, `pageInputs.ts`, `World.tsx`, `WorldCanvas.tsx`, `CameraRig.tsx` (one line: `flight.duration`) and `stations/SkillsStation.tsx` (import orbitTilts).
  - Elsewhere: `app/layout.tsx` (WorldContent), `components/Header/Header.tsx` (setChrome on menu open) and `components/Sound/sound.ts` (onCue listener signature only).
- Create: `components/World/ride.ts`, `components/World/skillsOrbit.ts` and the 8 placeholder components.

- [x] Add every field, function and type in the interface contract with the doc comment given. `emitCue` and `onCue` stay backward compatible.
- [x] pageInputs measuring, inside `usePageReading`'s existing once-a-frame measure:
  - `readingRects` / `readingLarge` / `readingCount` from `#main-content [data-reading]` visible in the viewport (nearest first, at most 6);
  - `clearRight`;
  - `skillFocus` (`focusAmong` over `[data-world-category]`);
  - `worldWindow`.
- [x] Generalise `useSkillHover` into `useTargetHover` writing `targetHover` for any `[data-world-target]` or `[data-world-project]` (as `project:<i>`). Keep `skillHover` derived, so SkillsStation is unchanged. Scope lookups to `#main-content`.
- [x] Clean up every new field on route change and unmount.
- [x] `navigateFromMode`:
  - in page mode, `snapshotPage(path)` then `navigateTo(path)`;
  - on the current path, `worldMode.exit()`;
  - otherwise remember `pending = path` and `navigateTo(path)`.
- [x] `arrivedAt(pathname)` exits when `pending === pathname`. World.tsx calls it in its pathname effect, and the existing `pendingDock` logic moves onto it.
- [x] `rangeBetween` uses `stationPositions`, rounded.
- [x] Move `settleFocus` into `ride.ts` (plain math, no three) and `orbitTilts` into `skillsOrbit.ts`; re-export and import them where they were used.
- [x] `reportNearest` keeps its behaviour and also stores `at`; `nearestAt()` returns it, or null when no signal is in range.
- [x] WorldContent additions in `app/layout.tsx`:
  - `about.portrait` = `content.about.image.url`;
  - roles' `initials` (`companyInitials` from `components/Experience/timeline.ts`) and `mission` (the number Experience.tsx gives MissionPatch);
  - skills' `level` = `Number(level)`;
  - images' `index`.
- [x] Mount the 8 placeholders in WorldCanvas:
  - `TipProbe` after `CameraRig`;
  - `Cockpit` and `Sparks` after `MotionProbe`;
  - `Traffic` after `GasClouds`;
  - `CourseLine`, `HeadingProjector`, `DockingBeam` and `EdgeShimmer` after `Beacons`.
- [x] Frameloop:
  - `'never'` while `chrome.menuOpen || chrome.modalCover` (read through `useSyncExternalStore(onChrome…)`);
  - `'demand'` for `still` except in explore mode;
  - otherwise `'always'`.
  - Invalidate once on resume.
- [x] Header.tsx calls `setChrome({ menuOpen })` where it toggles `html.menu-open`.
- [x] ThemeScript sets `html[data-world-expected]` when the world will run.
- [x] **N1:** add `worldStore.intent: StationKey | ''` (the station the visitor is about to fly to).
  - Set it, and call `prefetchStationModel`, from World.tsx:
    - on `pointerdown` / `touchstart` of an internal link to another station;
    - when a `#main-content .page-nav` link to another station scrolls into view (IntersectionObserver).
  - WorldCanvas adds `intent` to `wanted` after an idle callback, so the station mounts and warms (`Precompiled`) before the click lands.
  - Clear it on route change.
  - Verify: on a 390×844 touch profile, the first flight to `/about` has no frame over 50ms where the same run without this change had one.
- [x] Verify: typecheck, lint, build and the full e2e suite (`npm run build && npm run test:e2e`), with no behaviour change except the menu pause. Check the menu pause on a phone-sized prod page: the stats overlay's frame counter stops while the menu is open and resumes after.
- [x] Commit.

---

## Wave 1: Lanes (parallel worktrees off the foundation)

Each lane: `git switch -c claude/wi-<lane>` in its worktree, `cp -c -R /Users/lewis/Workspace/portfolio-next/node_modules .` (APFS clone), port = 3300 + lane number. Work through the items in order, verify each and commit each. End with typecheck, lint and a build, the e2e specs for your area, and a lane report.

### L1 CAM: camera, framing and the course line

**Owns:** `stations.ts`, `CameraRig.tsx`, `flight.ts`, `stationHooks.ts`, `Lighting.tsx`, `CourseLine.tsx`. It may append rules to the end of `World.scss` for D10.

- [x] **FX12:** apply pointer parallax along the pose's right and up axes:
  - `fwd = normalize(look - target)`, `side = normalize(cross(fwd, worldUp))`, `upCam = cross(side, fwd)`;
  - keep the 0.45 / 0.28 magnitudes.
  - Verify on the projects ride at screen 3: a horizontal mouse sweep moves the camera sideways, not closer.
- [x] **FX02:** the About pose follows scroll at page speed (`look.y = -screens * 2 * distance * tanHalfFov * zoom`) and the companion pose swings the station clear before the bio's reading line. Verify at 1440×900 and 1100×800, both themes: no hull, truss or ring pixels inside `.about__copy` text rects (pixel-sample).
- [x] **C9 (camera half):** the station's sideways shift on wide layouts becomes `max(constant room, room derived from worldStore.clearRight)`, so the station clears the widest glass. Retune `companions` for home, about and contact against L12's left-column layout. Until L12 merges, `clearRight` stays -1 and nothing changes.
- [x] **B6 (camera half):** on wide /skills, look stays on the planet (a small descent only) and the eye blends between one pose per category, facing that category's orbit plane (`orbitTilts` from `skillsOrbit.ts`), driven by `worldStore.skillFocus`. Narrow layouts are unchanged. Snap at `motion !== 'full'`.
- [x] **B15 (camera half):** CameraRig keeps a ridden projects focus.
  - It eases towards `worldStore.projectFocus` with smootherstep over `clamp(0.8 + 0.12·|Δ|, 0.8, 2.2)`s, passing through directly when |Δ| < 0.5 (the runway stays as responsive).
  - `stationCamera('projects')` reads it through a module-level getter, so prev and next on project pages orbit the spiral instead of cutting a chord.
  - `emitCue('select')` at the start of a hop over one screen, and `'hud-lock'` when it settles. Snap at reduced motion.
- [x] **C11:** while `flight.active && !flight.approached` in page or tour mode:
  - ease `scene.fog.far` towards 280 (lite 180) and `near` towards 60;
  - give `stationInRange` a per-key range, so `flight.to` draws out to 320;
  - ease back after `'end'`.
  - Verify a mid-flight frame shows the destination's hull and running lights.
- [x] **C8 (camera half):** `stationFraming` takes an optional slot rect. On narrow layouts, when `worldStore.worldWindow.top >= 0`, blend the pose (weight from the window's distance to the reading line) so the station is framed inside that window's rect: a gentle swing of at most 0.4 rad, rig-damped. With no windows (until L12 merges) nothing changes.
- [x] **FX21:** under reduced motion, a station change that snaps emits `emitFlight('end', station)` after the snap (no `'start'`, so power doesn't drop).
- [x] **FX30 (camera half):** cap the scroll-follow catch-up so a scroll jump (End/Home) moves the camera at most ~35 units/s, while flights are unaffected.
- [x] **D10:** at `still`/`calm`, a station change sets `html[data-world-cut='out']`, holds 160ms, snaps, then sets `'in'` and removes it after 300ms. Append the canvas opacity rules to `World.scss` and invalidate at 170ms and 480ms.
- [x] **FX04 (camera half):** the boot warp-in emits `emitFlight('approach', station)` at its approach point and `'end'` on arrival, like a flight. _(No change needed: the warp in already flies through `startFlight`, which emits approach (at 0.6) and end like any flight.)_
- [x] **N8:** in explore mode, `Lighting` centres the shadow box on the nearest station to the camera, when within 40 units.
- [x] **A1:** `CourseLine.tsx` is one camera-facing ribbon (preallocated 64 segments; `aCentre`, `aTangent`, `aSide`, `aAlong`; the vertex shader expands it; width `max(0.05, dist·0.0018)`).
  - Rebuild it only when the path changes: `onPreview` (pink), `onFlight('start')` (cyan, using `flight.path`) and `worldStore.autopilotPath` changes (cyan).
  - CatmullRom through the samples. Dashes march towards the destination; the part already flown fades.
  - Mask fragments inside `worldStore.copy`. Hide at `still`, show a static line at `calm`.
  - Mounted always, so it compiles in warm-up.
  - Verify: hover a header link and a pink dashed line runs from in front of the camera to the station; click and it turns cyan and shortens as you fly.

### L2 TRN: transitions, modes, the tour and page chrome around the canvas

**Owns:** `PageTransition.tsx`, `pageSnapshot.ts`, `World.tsx`, `World.scss`, `worldMode.ts` (tour and focus parts), `TourOverlay.tsx`, `RoamButton/*`, `StationFallback.tsx`, the `.station-fallback` and world-off rules in `app/page.scss`.

- [x] **C5 + FX09:**
  - TourOverlay's Visit uses `navigateFromMode`.
  - World.tsx's mode effect sets `html[data-world-mode='returning']` when tour or explore returns to page with motion allowed. The page stays hidden and inert until `onFlight('approach' | 'end')` for the page's station, a 6.5s cap, no `'start'` within 2 frames (already there), or immediately at reduced motion.
  - `snapshotPage` bails unless `data-world-mode === 'page'`.
  - Test (`@webgl`): Visit from a tour stop shows no `.page-ghost` with text from the hidden page.
- [x] **E6:**
  - `worldMode.startTour(from?)` starts at the current station; the counter still reads `01` for the first stop visited.
  - `backTour()`, and a Pause/Play button with `aria-pressed`.
  - Keys: Space on the panel toggles pause, ←/→ go to the previous/next stop.
  - Dwell = `clamp(3500 + 45·captionChars, 5500, 10000)` ms, driving `--tour-dwell`.
  - After the last stop a final card offers Open Contact, Fly freely from here (`worldMode.startExplore()` in place) and Back to <page>.
  - Touch-aware caption copy (tap/swipe instead of click/hover where captions mention them).
  - **FX21 (tour half):** land immediately under reduced motion.
  - Test: the tour keyboard controls in `world.spec.ts` (`@webgl`).
- [x] **E5 (trigger):** `TourOverlay.land()` calls `showcase(station, 'tour')` 600ms after landing, unless `motion !== 'full'`.
- [x] **G1 + FX16:**
  - `worldMode` remembers `document.activeElement` when the tour or explore starts. On return to page it restores focus in a rAF after `inert` lifts (`preventScroll`), falling back to `.roam-fab`, then `#main-content`.
  - After `arrivedAt` exits a mode (docking, Visit), focus `#main-content` (tabIndex -1).
  - Test: Esc out of free roam restores focus to the Free roam button.
- [x] **FX35:**
  - Add `.skip-link` to World.tsx's inert selector in tour and explore.
  - In `app/layout.tsx`, move `<RoamButton />` right after `<Header>` (it is fixed-position, so it doesn't move visually).
  - Test: Free roam is reached within the first 15 tab stops on `/`.
- [x] **C3:**
  - At `'approach'`, PageTransition picks the arrival from the flight. After an about-turn the copy swings in from the side the camera rounds: `x ±8vw`, `rotateY ∓7deg`, `transformPerspective 1400`. After an ahead flight it rushes in (`scale 0.94`, `y 16`).
  - Always end at `transform: none` and `filter: none`.
- [x] **C4:** World.tsx sets `html[data-flight='cruise']` on `'start'` in page mode when `flight.duration > 1.6`, and clears it on `'approach'`/`'end'`/mode change. `World.scss` fades `.world__veil` to 0 then.
- [x] **FX03:** strengthen and widen `.world__veil` in dark theme over the copy column (e.g. 70% at 0, 45% at 45%, 0 at 70% of the width on wide layouts), plus a soft `--bg-primary` text-shadow on `.page-sub` and `.hero__tag`. Verify the worst 10% of contrast is ≥4.5:1 on `/`, `/about`, `/experience`, `/contact` and `/projects`, both themes.
- [x] **N7:**
  - With the world off, `.world__backdrop` gains the loading screen's CSS star tiles and a static nebula gradient per theme.
  - `/skills` and project pages get a fallback render: reuse an `app/_og/renders` PNG or capture one. Add it to StationFallback.
  - RoamButton's label reads "Turn on 3D" when `html[data-world='off']`.

### L3 PRJ: projects

**Owns:** `stations/ProjectsStation.tsx`, `imageDecoder.ts`, `components/Projects/**`, and in `routes.ts` only `prefetch()`'s request headers.

- [x] **FX25:** helix screens are keyed by `slug`.
- [x] **FX37:** send `Accept: image/webp,image/*;q=0.8` from the decoder's fetches and from `prefetch()` for images. Verify the responses are `image/webp`.
- [x] **DV2:** dedupe in-flight shot loads per URL (a shared promise cache), so StrictMode's double mount or a remount never fetches twice. Check on dev that flying into `/projects` shows shots.
- [x] **PF4:** sharp full-page copies upload in row bands across frames: allocate once (`texStorage2D` via `gl.texStorage2D` on the texture's WebGL handle, or upload a blank of full size and then `texSubImage2D` bands of 256 rows per frame through `queueUpload`), or skip mipmaps. Verify there is no frame over 34ms during the first `/projects` visit at 1440×900.
- [ ] **FX39:** instrument the projects hub hull's load, compile and reveal timings with `performance.mark` (dev only). Find why it sometimes appears 8–19s late and fix it, or report the evidence if it doesn't reproduce in 10 tries. _(Partial: dev-only `projects:*` marks and measures are in, and the sharp-copy prefetches now wait for the hub hull (6s at most) as a mitigation. The 8-19s delay did not reproduce as such: the GLB downloads in about 2s, and the rest was compile and per-frame uploads under software GL.)_
- [x] **B9:**
  - The gallery writes `worldStore.projectShot` on slide change and clears it on unmount.
  - The screen writes `worldStore.screenShown[i]` when a fade completes.
  - The gallery's initial slide (modal and project page) comes from `screenShown[selected]` when known.
  - `ScreenShots.pin(i, contentIndex)` loads (on demand) and fades the screen to the gallery's slide, invalidating at `still`.
- [x] **B8 + PF3 (modal half):**
  - Each frame while `projectFocus >= 0`, project the front screen's 4 corners into `worldStore.screenRect`.
  - ProjectDetailsModal's gallery stage is an `m.div` animating from that rect (a FLIP transform, `transformOrigin 0 0`) to its measured rect, ending at `transform: none`. Close reverses it.
  - Replace both backdrop blurs with a plain scrim (`color-mix` of the background at ~0.8).
  - On narrow screens, `setChrome({ modalCover: true })` while open.
  - Reduced motion and world off keep today's entrance.
  - The existing `@webgl` modal test must stay green.
- [x] **B14 + FX22:**
  - A click on a non-front screen in page mode on `/projects` dispatches `world:project` (detail: index); Projects.tsx answers with `goTo(i)` (the runway scroll).
  - A click on the front screen opens the modal.
  - Outside page mode, a click only pings.
  - Tips: "Ride to this project" vs "Open project" (stable tip objects).
  - Closing a modal whose project isn't the active one rides to it and focuses that project's View details link.
- [x] **B15 (page half):** index links and pager cards carry `data-world-project="<i>"`. The hovered project's screen lights and goes live; non-front screens behind the copy column dim on project pages (`worldStore.copy`).
- [x] **B10:** Projects.tsx writes `--ride` (`settleFocus(focus) - Math.round(focus)`) and `--hud-o` (`clamp(1 - |ride|·2.2, 0, 1)`, computed in JS) on the stage. The HUD's head, tech, description and actions translate by `var(--ride) * -2.5rem` and fade by `--hud-o`, snapping to exactly `none`/`1` when |ride| < 0.02.
- [x] **B12:** two InstancedMeshes (6-segment cylinder arms and small joints) from the spine to each screen, using the truss material, matrices computed once.
- [x] **B13:**
  - The screen shader wipes downwards between shots with a thin bright seam (`smoothstep` on `uMix` against `1 - vUv.y`).
  - A `uPower` per screen follows `power.tsx`'s charge curve, compressed to 0.6s, in the edge band only, when a screen becomes the front one. `uPower = 1` at `still`.
- [x] **FX13:** the runway snaps in the direction of the gesture once it passes ~60px from where it started; the first swipe from the top always docks. Test (world off): a 150px wheel/touch scroll advances one project.
- [x] **FX14:** add a short-landscape layout (`max-height: 520px and orientation: landscape`): screen left, copy right, summary clamped to 2 lines, actions beside the title, index visible. Update `stationFraming`'s slot only via a CSS variable if needed, and coordinate in the lane report. Verify at 844×390 that View details is reachable. _(The world-on framing of the screen in its cell came with the L1 follow-up (aae07d5, 69a17a7).)_
- [x] **FX23:** while the modal is open, `document.title` = `<Project> | Projects | Lewis Hadden` (shared helper in `utils/seo.ts`), restored on close.
- [x] **FX24:** hide back-to-top while the projects stage is docked in the stacked layout. Give the index 44px tap targets on coarse pointers.
- [x] **F4 (ride half):** `emitCue('tick', { at: <front screen world position> })` when `active` settles on a new project.

### L4 STN-A: Home, About, Experience, Lost, shared station machinery

**Owns:**

- Stations: `stations/HomeStation.tsx`, `AboutStation.tsx`, `ExperienceStation.tsx`, `LostStation.tsx`.
- Shared machinery: `parts.tsx`, `power.tsx`, `reaction.ts`, `Pings.tsx`, `Model.tsx`, `materials.ts`, `Shards.tsx`.
- New: `HeadingProjector.tsx`, `patches.ts`.

- [x] **PF5:** render one HoloCore placeholder: `<Suspense fallback={null}>`, with GltfModel showing the placeholder until prepared. Alternatively, share HoloCore's materials per theme, refcounted. Verify that no program is deleted and relinked on the first flight to `/about` (log `gl.deleteProgram`).
- [x] **FX20 + F3 (charge half):**
  - `PowerDriver` sets every station's target to 1 whenever the mode isn't `page`.
  - It writes `worldStore.charge[key] = charge` while a power-on runs, and deletes the entry when back at 1.
- [x] **B21:**
  - `createFresnelMaterial` gains `uCharge` (alpha × min(c, 1), colour × max(c, 1)).
  - ExperienceStation pods' emissive × charge.
  - About motes become one InstancedMesh with a charged material (26 draws to 1).
- [x] **C7 (arrival ring):** on `onFlight('approach')` for flights longer than 2s, one expanding ring at the destination, through the Pings pool at a larger scale, timed with the power surge. No flash.
- [x] **N2:**
  - Characters (astronaut, helmet, satellite, rocket, lost astronaut) get invisible proxy capsule or sphere meshes as their raycast targets.
  - Hover no longer raycasts the GLB triangles.
  - Pass `e.point` through to `trick()` for F1.
- [x] **E5 + G2 (listeners):** Home, About, Experience and Lost subscribe to `onShowcase` and replay their existing trick, plus `spawnPing` at the character's world position. Respect the reason: a tour showcase is skipped below `full`; at `still`, a hail is a ping and a nav-light flash only.
- [x] **B2 (experience half):**
  - `worldStore.targetHover === 'role:<i>'` lights pod i (noticed 0.75).
  - On change, run the satellite's ping halo from the satellite down to pod i only (a plain-object animation, as `trickProgress` works).
  - `emitCue('ping')` at most every 150ms.
- [x] **B1:** _(Drawn with the canvas 2D API into one atlas rather than from an SVG string (SVG images can't use web fonts), one patch per idle callback once the warm-up is over.)_
  - `patches.ts` `drawPatch(role, tone, theme)` builds the MissionPatch SVG string (number, company ring text, initials, `.xp__patch--N` palette inline). It rasterises to a 256² CanvasTexture after `document.fonts.ready`, through `queueUpload` and `useWarmupTask`.
  - One Billboard plane (~0.9 units) per pod on the copy side; it tilts upright and grows as the pod lights; it isn't drawn below activation 0.15.
  - The DOM `.xp__patch` stays.
- [x] **B4:**
  - A visor shell inside the helmet: a sphere segment tuned once against the GLB, scale ~1.002.
  - Shader: `uMap` × scanlines × fresnel edge, with `uShow`, `uTime` and `uCharge`. `asGlow`, `maskBloom()`.
  - Portrait (`content.about.portrait`) decoded at 512 in the worker and uploaded through `queueUpload`.
  - `uShow` is driven by a click (scan in 0.4s, hold 2s, out) and by `targetHover === 'about:portrait'` (add `data-world-target="about:portrait"` to the portrait frame in About.tsx).
  - Under 3 flashes/s. A still frame at `still`.
- [x] **A16:**
  - Home's portal dashed ring becomes ~72 instanced glyph quads (a Geist Mono caps glyph atlas plus the ScrambleText glyph set, uploaded once through `queueUpload`) spelling `worldStore.heroRole` clockwise.
  - The `aGlyph` attribute is rewritten only when the string changes.
  - Material via `useThemedMaterials` (so it powers on), `asGlow`. Wide layouts only.
  - Final text with no rotation at `still`.
- [x] **A3:**
  - `HeadingProjector`: on `onFlight('approach')` in page mode, a 1.4s envelope.
  - The emitter is `stationPositions[station]` plus a per-station offset (home hub antenna tip, about habitat mast, experience satellite, contact dish rim, skills ring edge, projects front-screen top).
  - The target is `worldStore.copy`'s 4 corners unprojected to 7 units in front of the camera.
  - LineSegments (plus, on the high tier only, a 4-triangle cone), materials per theme; `uCharge` follows `stationPower[station].charge` per frame while it plays, so it flickers with the power-on. Alpha falls from the emitter to ~15% at the heading.
  - None at `still`/`calm`.
- [x] **B20:**
  - LostStation counts nudges. After 3, a tractor beam (beam material) from the wreck to the astronaut, and the tip becomes "Signal locked / Click to plot a course home".
  - The next click calls `navigateTo('/')`.
  - In explore mode, `markFound('derelict')` instead.

### L5 STN-B: Skills and Contact stations

**Owns:** `stations/SkillsStation.tsx`, `stations/ContactStation.tsx`, `stations/RocketSmoke.tsx`, and in `components/Contact/ContactForm/ContactForm.tsx` only its focus, blur and change handlers.

- [x] **PF6:**
  - Badges draw into one atlas canvas (one texture), uploaded once through `queueUpload` after `Promise.all` of `image.decode()`.
  - Sprites (or an InstancedMesh) mount during the station's Precompiled pass with a 1×1 placeholder map.
  - Recolour by uniform on theme change.
  - Verify the sprite program isn't linked at draw on the first `/skills` visit.
- [x] **B6 (station half):**
  - Badge size and orbital lift encode `level`. Each category orbit carries a lit arc for its average level.
  - The orbit being read (`worldStore.skillCategory`) stays bright and centred for the camera's per-category pose (L1).
  - Badges keep clear of the copy as today.
- [x] **N2 (badges):** a per-orbit phase accumulator replaces `t·speed`; an orbit holds still while one of its badges is hovered.
- [x] **B21 (skills, contact):** the planet (bands, rim), ring, orbit lines, badges, globe dots, arcs and atmosphere take `uCharge` or `stationPower.<key>.charge`.
- [x] **B5:** _(Draft activity is `sqrt(composing) × 0.35`: the linear version was invisible for a typical draft.)_
  - ContactForm writes `worldStore.commsFocus` on focus/blur and `worldStore.composing = message.length / limit` on change (plain store writes).
  - ContactStation: while `commsFocus`, ease the dish sweep towards the globe and raise the data link's speed; packets idle-loop near the dish with activity `max(sending, composing·0.35)`.
  - `targetHover === 'contact:<name>'` arcs one packet from the Peterborough pin.
  - `'globe:home'` eases the globe's yaw so Peterborough faces the camera.
  - No flashing on errors.
- [x] **E5 + G2 (listeners):**
  - Skills: flare every constellation and ping the planet.
  - Contact: `setTransmitting(true)`, then false after 2s (the packet arc), plus a short rocket rev. Never `requestLaunch`.
- [x] **ContactStation globe click** pings, like every other 3D click. The globe drag gets `touch-action: none` handling so a touch drag isn't cancelled by scrolling (verify with CDP touch events). _(Instead of `touch-action: none`, a non-passive touchmove gate claims only clearly sideways swipes that start on the globe, so up and down swipes still scroll.)_

### L6 SKY-A: sky bake, theme, post effects, quality

**Owns:** `Nebula.tsx`, `sky.ts`, `Effects.tsx`, `optics.ts`, `quality.ts`, `Landmarks.tsx`, and in `WorldCanvas.tsx` only the QualityGovernor and ceiling.

- [x] **PF2 + A21:** _(Desktop switches peak at 17-33ms; on the 4× throttled phone profile the first switch after load still peaks at 67-100ms (a5f3346).)_
  - Effects builds its chain once: theme changes set `bloom.intensity`, `luminanceMaterial.threshold` and `vignette.darkness` in place; theme leaves the pass keys.
  - Nebula keeps one PMREMGenerator and one set of environment materials, compiled at warm-up. It disposes the old environment only after the new one is applied.
  - Bake the new theme into a second target. The dome shader gets `uMapA`, `uMapB` and `uMix`, crossfading over 0.9s after the bake, then applies the new environment. `skyMap` switches at the end.
  - Landmarks and station materials change theme through uniforms where they can, rather than rebuilding (coordinate: `useThemedMaterials` belongs to L4; if a change there is needed, report it).
  - Verify: max frame on a switch ≤50ms at 1440×900, and no frame where hulls lose reflections (luma sampling).
- [x] **D6:**
  - In the light branch of the bake: a broad gradient on galactic latitude, a warm sunward lobe (`pow(max(dot(dir, uSun), 0), 4)·0.12`) and the band as a soft darker wash.
  - optics: scale reach by ~0.55 in light.
  - The light-theme Starfield and Dust parts are L7's.
  - Re-run the contrast checks in light theme.
- [x] **D4:** add a backdrop direction to `sky.ts` (normalised (0.3, 0.12, 1)) and a distant tilted spiral galaxy in the bake: an exponential disc, two log-spiral arms modulated by `turbulence()`, a warm bulge and a dust lane. The core stays under `palettes.bloomThreshold`. In light theme, a soft ink wash.
- [x] **FX08:**
  - The dome dims the band and bulge by `mix(1, 0.45, warp)` and the grain by `1 - warp` (`warp` from `worldStore.velocity`, 40–140).
  - Phones get a sharper band: a 2048 bake if memory allows, otherwise more colour and dust in the bulge.
  - Verify at 390×844 that Contact→Home and About→Experience flights have no near-uniform grey frame (luma std-dev over a frame > threshold).
- [x] **G3 + FX06 (world half):**
  - A `ReadingGuardEffect` inside pass 2 (after `HighlightRolloffEffect`, before the vignette), present on every tier.
  - `uRects[6]`, `uLarge[6]`, `uCount` and a ~40px feather. Inside each rect, it limits the world's linear luminance to keep that rect's text ≥4.5:1 (3:1 when large), using the real text colours per theme. Scale RGB to keep the hue.
  - It relaxes to 0 while `flight.active && !approached`.
  - Verify with the pixel-sampled contrast script: every `[data-reading]` block ≥4.5:1 at p10, both themes, `/`, `/about`, `/experience`, `/projects`, `/skills`, `/contact`.
- [x] **D8:**
  - An `ultra` tier (`dpr 2`, bloom scale 0.6) above `high` on desktops with `devicePixelRatio >= 2` and ≤4.5M device pixels.
  - Start at `high` and reach `ultra` only by incline.
  - Once it drops out of `ultra`, cap the session at `high`.
- [x] **FX30 (optics half):** the radial streak blur follows flights and free-roam thrust only (`flight.active`, or explore mode), not scroll-driven camera moves.

### L7 SKY-B: stars, dust, rocks, beacons, traffic

**Owns:** `Starfield.tsx` (with BrightStars), `Dust.tsx`, `Asteroids.tsx`, `GasClouds.tsx`, `Beacons.tsx`, `Traffic.tsx`.

- [x] **C7 (stars):** BrightStars move onto the shared instanced streak quad (`streakQuad`/`streakShape`, `uStreak`/`uFocus`/`uResolution`), keeping the spike shape at rest. They are always mounted (`visible` toggled per theme), so their program compiles in warm-up.
- [x] **D6 + FX31 (light stars):** in light theme, `uOpacity = mix(0.55, 0.95, streakAmount)`, ink colours `#312e81`/`#0e7490`, no long-streak fade for non-additive, and Dust the same.
- [x] **FX30 (streak half):** star and dust streaks follow flights and free-roam thrust only.
- [x] **D9:** _(The belt turns by a `uBelt` matrix in the vertex shader rather than in a group, which would have split every detail bucket into two draws.)_
  - Bucket rocks by size into icosahedron detail 1/2/3 InstancedMeshes, sharing one material program (`customProgramCacheKey`), to roughly halve triangles.
  - Belt rocks (y −96..−56) go in a group rotating `t·0.004` about the belt centre; scatter rocks stay static.
  - Hold still at `still`.
- [x] **D2:** _(A mesh with `InstancedBufferGeometry` rather than `InstancedMesh`, as everything is placed in the vertex shader (one draw either way).)_
  - `Traffic.tsx`: 8 shuttles (3 on lite, half on the low tier).
  - One InstancedMesh of a tiny hull (a box plus two fins, one geometry). One shader via a module factory and `useThemedMaterials`, with `uTime` and `aLane` (from, to, phase, speed 6–10 u/s).
  - Lanes are offset 12–20 units from the GasClouds station pairs, with any stretch within 24 units of a station cut out.
  - Nav lights blink under 1 Hz in the same shader. Frozen at `still`.
  - Mounted before WarmupGate.
- [x] **FX07 + FX04 (names half):**
  - Beacon names show only after 0.7s of flight (or `flight.progress > 0.15`), and never during the boot warp-in before its approach.
  - On narrow or portrait viewports and at tour stops, label only the destination (or the current stop, without duplicating the caption).
  - Scale labels by `min(1, aspect / 1.2)`.
  - Project the labels each frame and hide any whose rect overlaps another's, or that falls outside the viewport by more than 10%.

### L8 FREE-A: free-roam interaction, the ship, the edge

**Owns:**

- Interaction: `interaction.ts`, `ExploreControls.tsx`, `pointerLock.ts`, `WorldTooltip.tsx`, `TipProbe.tsx`, new `tipTarget.ts`.
- Ship and edge: `Sparks.tsx`, `Cockpit.tsx`, `EdgeShimmer.tsx`.
- `ExploreHud.tsx`: the top bar, reticle, boost, keys/coach and Enter handling (leave the signal and docking regions to L9).

- [x] **FX17:** ExploreHud's window Enter handler returns early when the target is inside `button, a[href], input, textarea, select, [role=button], [contenteditable]`. Test (`@webgl`): Enter on a focused waypoint sets the autopilot, not docking.
- [x] **A2 + FX28:**
  - `tipTarget.ts` (canvas side) exports `setTipTarget(object | null)`. `reaction.ts` hover and the pod, badge, screen and globe handlers call it (coordinate edits to `reaction.ts` and station files through their lanes' reports: add the call where `worldTip.set` is called).
  - `TipProbe` takes a local Box3 once per target and projects its 8 corners each frame into `worldStore.tipBox`.
  - WorldTooltip drops the pointer follower. In a rAF it places 4 bracket spans round `tipBox` (springs at `full`, in place otherwise) and a tag beside the box, flipping near edges and avoiding `worldStore.copy`.
  - It re-raycasts once a frame while scrolling (`events.update`), so it never goes stale.
- [x] **E1:**
  - When the pointer is locked in explore mode, `interaction.ts`'s compute treats the screen centre as the pointer.
  - ExploreControls calls `events.update()` every 3rd frame, with `raycaster.far = 60`.
  - The tip sits under the reticle. `.explore-hud__reticle--target` is driven by `html[data-world-hover]`.
  - Key E clicks the target.
- [x] **G1 (pitch):** R/F and PageUp/PageDown drive `exploreInput.pitch` (`pitch += pitch·1.1·dt` before the clamp), added to the legend. _(R / V rather than R / F: F is the scan key (E3).)_
- [x] **A1 (autopilot half):** when `setAutopilot` fires, ExploreControls writes `worldStore.autopilotPath`: camera → rounding point → goal, following `flyTo`'s rule, 26 samples. Clear it when the autopilot ends.
- [x] **N3:** proxy colliders, reusing `bump()`:
  - a capsule for the experience beam (and its pods);
  - a cylinder for the projects helix;
  - spheres for the derelict and each signal craft.
- [x] **A6:**
  - **Phase 1:** `bump()` spawns a ping at the contact point. `Sparks.tsx` is a 24-instance streak pool (reusing `streakQuad`): velocity is the reflected camera velocity plus jitter, life 0.5s. None at `still`/`calm`.
  - **Phase 2:** `Cockpit.tsx` is a group copying `camera.matrixWorld` each frame, with two additive engine-glow sprites at the lower view corners and a heat-shimmer quad, driven by `exploreInput.boost` and `worldStore.velocity`. It replaces BoostJet's SVG; keep "Boost" as sr-only status. Visible only in explore mode, mounted always.
  - **Phase 3:** faint canopy struts entering from the screen corners in explore mode, never over the reticle.
- [x] **E8:** _(The Starfield clamp landed in L7 (a9a9e4c).)_
  - Beyond `worldRadius`, remove the outward velocity component and stiffen the spring (k ≈ 3).
  - `worldStore.edge = smoothstep(r - 60, r, fromCentre)`.
  - `EdgeShimmer` is one ~120-unit hex-shimmer quad at centre + n·r, facing the centre, alpha = edge (never a full sphere).
  - ExploreHud shows the status line "Sector edge · turning back" (`role=status`). `emitCue('edge')` once per approach.
  - Clamp Starfield's per-star pixel radius (coordinate with L7 in the report if a Starfield change is needed).
- [x] **E9:**
  - A coach in ExploreHud: three steps detected from input (look, thrust or boost, an autopilot set or a signal found), with copy per input type. `localStorage 'roam-trained'` (try/catch), plus a Skip button.
  - After that, the key legend collapses behind a Controls button (`aria-expanded`).
  - Mount `<SoundToggle />` in the top bar. Hide the Esc hint on touch.

### L9 FREE-B: signals, radar, docking

**Owns:** `Signals.tsx`, `SignalsHud.tsx`, `signalStore.ts` (beyond the foundation), `NavRadar.tsx`, `Waypoints.tsx`, `DockingBeam.tsx`, and the signal-card and docking-overlay regions of `ExploreHud.tsx`.

- [x] **FX27:** signal page actions no longer dock from afar. `setAutopilot(stationForPath(href))` with a "Course set for <craft>" status line; docking happens on arrival.
- [x] **FX04 (radar half):**
  - In page mode, NavRadar shows only while `flight.active && !flight.approached` (300ms linger), and not at all during the boot warp-in. _(Kept on purpose: a course preview still opens the map aside under the header with no flight under way, but only on wide layouts (`(min-width: 900px) and (min-aspect-ratio: 11 / 10)`). It comes from hovering or focusing a link to another station, or from the command palette's selected row. Stacked layouts keep it shut.)_
  - In the tour it moves top-left and is hidden below 760px.
  - It never sits over the focused element (check `document.activeElement`'s rect).
  - Replace `.glass` with an opaque surface and no backdrop-filter.
- [x] **E10:**
  - In explore mode the radar targets `worldStore.autopilot`, with its course (`worldStore.autopilotPath`) and distance.
  - It plots signals: found ones as hollow rings, scanned ones amber, the derelict once found, the comet via `cometAt()`, and the E8 boundary circle.
  - Clamp the camera marker to the map edge.
- [x] **E2:**
  - On `markFound`: `spawnPing` at the node, a glow burst (×3, 1.2s), then a precreated cyan "logged" ring texture at 0.3 opacity (explore only).
  - A canvas nameplate sprite blinks on for 4s and reappears within 40 units.
  - Move `cometOrbit` and a pure `cometAt(t)` into `signalStore.ts`.
  - Enter opens the latest signal's card actions.
- [x] **E3:**
  - `requestScan()` (8s cooldown), plus `scanAt`, `scanned` and `useScan()` in `signalStore.ts`.
  - Triggered by the F key (ExploreControls' key handler belongs to L8: add a `world:scan` window event that L8's handler dispatches, and note it in the report) and by a touch Scan button.
  - Signals pings each contact as `radius = (t - scanAt) / 1.8 · detectorRange` passes it.
  - Waypoints adds a "Contacts" list of amber markers; `setAutopilot('signal:<id>')` parks 6 units short.
  - A `role=status` line, e.g. "Scan: 2 contacts · nearest 84 km, above left". `emitCue('scan')`.
- [x] **E7:**
  - `DockingBeam.tsx`, subscribed to `onDocking`: a beam (beam material) from the station's port (`stationPositions[key] + (0, 1.5, 6)`) towards the camera, ending 4 units short, `uCharge` 0→1 over 0.4s.
  - Nav lights chase. Replay the power-on curve as an acknowledge flicker.
  - Mounted always (hidden). Keep the `role=status` text.
- [x] **F7 (source half):** `Signals.tsx` passes the nearest node's world position (the comet's live position included) to `reportNearest(distance, at)`.

### L10 CHR: site chrome

**Owns:**

- Header and HUD: `HeaderHud/*`, `Header/*` (except Task 0.3's setChrome line).
- Menus and overlays: `MobileMenu/*`, `BrandMark/*`, `BootScreen/*`, `CommandPalette/*`, `Cursor/*`, `ScrollProgress/*`.
- Footer and controls: `Footer/*`, `ThemeToggle/*`, `StationReadout/*`, `GoogleAnalyticsDeferred/*`.
- In `app/layout.tsx`, only `<main>` attributes.

- [x] **FX34:** `<main id="main-content" tabIndex={-1}>` with no focus outline. The skip link focuses it. ThemeToggle keeps `role=switch` with a static label ("Light theme") and `aria-checked`. Test: activating the skip link focuses main.
- [x] **FX38:** GoogleAnalyticsDeferred skips loading on `localhost`, `127.0.0.1`, `*.localhost` and when `navigator.webdriver` is set.
- [x] **DV3:** HeaderHud and MenuHolo re-read uniform locations whenever their program is created; no INVALID_OPERATION in dev.
- [x] **FX05:** `.header-scrim` stays solid to the bar's bottom plus the spring's trail (`calc(var(--header-h) + 4px)`), then fades over ~40px; `--scrim: 1` within the bar at every width.
- [x] **FX06:** HeaderHud's fill gets a floor along the row of links and actions (clear 0.35 inside each measured target box) so station parts behind the bar never hide controls. Verify the p5 contrast of header icons is ≥3:1 at the top of `/projects`, `/about` and `/experience`, light theme. _(Floors are 0.6 dark / 0.72 light rather than 0.35: at 0.35 the `/projects` 3D toggle measured 1.68:1 in the light theme and the `/experience` one 2.89:1 in the dark. With the new floors the light theme is at least 3.73:1 and the dark at least 5.17:1.)_
- [x] **A9 + FX30 (tear half):**
  - `stepSway` adds a jolt from `worldStore.shake`: ≤3px, ≤1° roll, a split/tear burst.
  - The velocity-driven tear and split are multiplied by `sway.flying`.
  - The calm branch is unchanged (`header.spec` asserts `.header__bar` transform `''`).
- [x] **A10:**
  - HeaderHud uniforms `uProgress`, `uTicks[6]`, `uTickCount`, `uReading` and `uFlight`.
  - A 1px fill along the frame's bottom edge with a bright head and section ticks, the section being read glowing.
  - In flight it shows the range to go, plus an aria-hidden span riding the travelling lock: "→ SKILLS · 84 KM" (via `rangeBetween`).
  - ScrollProgress hides its bar while the header is a HUD (kept for world off and the flat bar).
  - `useScrollProgress` stops setting React state on every scroll event.
- [x] **A11 + FX10 + FX15 + FX26:**
  - Palette rows carry their station. Selection changes call `setPreview` (debounced 140ms) and clear on close. Rows show craft and range (`rangeBetween`). The current page reads "Docked", and the first active row is the first non-current page.
  - Navigation goes through `navigateFromMode`.
  - Opening stops Lenis (`useLenis()?.stop()`/`start()`).
  - `sudo hire lewis` keeps its timer ids in a ref and clears them on close; it prints `^C` when cancelled.
  - After a palette navigation, focus the new page's h1 (tabIndex -1) once it shows.
  - Replace the two backdrop blurs with an opaque HUD-style panel (frame, corner brackets via CSS).
  - Tests:
    - wheel over the open palette doesn't change `scrollY`;
    - Esc during `sudo hire lewis` stays on the page after 5s;
    - choosing a page from free roam leaves explore mode (`@webgl`).
- [x] **N4 (UI):**
  - Palette commands "Motion: follow system / Full / Calm / Still" (`setMotionPref`, current one marked).
  - A Motion control in the footer console (A12).
  - The free-roam HUD shows nothing extra.
- [x] **A12:**
  - Under `html:has(.header--hud)`, `.footer__inner` drops its backdrop-filter for an 86% background mix, with a thin HUD frame, pseudo-element corner brackets and mono caps column titles.
  - The SVG `<BrandMark />` replaces the text logo.
  - Nav reads as a station manifest ("01 · ABOUT · CREW HABITAT", 00–05 numbering, "Docked" for the current page, range via `rangeBetween`).
  - All markup is server-rendered.
- [x] **A14 + PF7:**
  - At `leaving` with full motion, BootScreen measures `.header__logo-mark` and `.boot__mark` and animates the mark into the header slot over 0.8s (`--dock-x`/`--dock-y`/`--dock-scale`). The header mark stays hidden until it lands.
  - Below `full`, `clearBoot` runs immediately.
  - Remove the dead reduced-motion keyframes.
  - HeaderHud treats only `data-boot='loading'` as away.
- [x] **A15 + FX29:**
  - BrandMark3D renders on demand while `html[data-world-mode]` isn't `page`.
  - The mobile menu prefetches every row's station (`prefetchStationModel`) when it opens.
  - It numbers rows 00–05 and uses `rangeBetween`.
  - Test: menu numbers match the page eyebrows.
- [x] **N5 + FX29 (readout):**
  - StationReadout shows "En route to the <craft> · N km" (live closing distance) while `flight.active` for its station, then "Docked at the <craft> · N km from Home" with N = `rangeBetween(station, 'home')` everywhere (server HTML, world on, world off).
  - Its rAF loop runs only during flights.
- [x] **G2:** _(The projects station's answer (its screens lighting one after another down the helix) came later (73a7c42).)_
  - A small Hail button beside the readout (`aria-label` "Hail the <craft>"), shown only with the world on and `.world--ready`. It calls `showcase(station, 'hail')` and `emitCue('hail')`, announcing politely (`role=status`) what happens ("The astronaut does a barrel roll").
  - A palette command "Hail the station".
- [x] **N6:** a visually hidden one-line scene description per station in StationReadout, e.g. "An astronaut with a laptop floats before a swirling portal". Shown with the world on; world off keeps the 2D render's alt text.
- [x] **E9 (sound in HUD):** done by L8, which mounts SoundToggle. Nothing to do here. _(Skipped as planned: L8 mounts SoundToggle.)_

### L11 SND: sound and haptics

**Owns:** `components/Sound/*`, new `components/Sound/haptics.ts`. In `components/Experience/Experience.tsx`, only the pod cue emit.

- [x] **F1:**
  - Thread `CueDetail` through `onCue`.
  - `spatial.ts` gets a pool of 4 cue panners (HRTF on desktop, equalpower on lite) placed at `detail.at`. Interface cues (`hud-*`, `palette`, `theme`, `select`, `blip`) stay centred.
  - An optional procedural reverb send (a ConvolverNode with a 1.8s noise IR) on desktop near hulls.
  - Emitters already pass `at` from L4/L5/L8/L9 work; add `at` to `spawnPing` and `bump` callers if a lane didn't (note it in the report).
- [x] **F2:** `haptics.ts`, wired from World.tsx when `'vibrate' in navigator && matchMedia('(pointer: coarse)')`:
  - patterns: bump `[15+35·s]`, dock `[12,70,28]`, found `[10,40,10,40,30]`, complete `[20,40,20,40,20,40,80]`, launch `[70,30,70,30,140]`;
  - free roam only, plus launch; `localStorage 'haptics'` (default on) and a palette toggle (coordinate the palette entry with L10 via a `world:haptics` event, or add it yourself in a clearly separated block and note it);
  - gated on `navigator.userActivation.hasBeenActive`.
- [x] **F3:**
  - The derelict's voice is heard on the 404 page (`stationForPath === 'lost'`) and in free roam.
  - Voices follow `worldStore.charge`: `amp.gain` = `level·(0.2 + 0.8·min(c, 1.3))` for keys present.
- [x] **F4:**
  - Recipes for `tick` (a soft relay click plus a triangle at the projects voice's second note ×4) and `pod` (the experience notes stepping down per role, level 0.012).
  - Experience.tsx emits `pod` with strength = role index when `Math.round(worldStore.roleFocus)` changes.
- [x] **F7:**
  - A dedicated sonar panner. While exploring with bars > 0 and signals left, a 1.4 kHz → 1.3 kHz glide plus a 0.17s echo at `nearestAt()`, every `lerp(2.4, 0.35, (bars-1)/4)`s, level 0.02.
  - Haptic ticks at ≥4 bars.
- [x] **N9:** play `arrive` (a short chord from the destination's voice) on `onFlight('end')` when no `'start'` preceded it for that station (reduced motion and world off). With the world off there are no flight events: emit on route change from World.tsx's world-off path, or listen to pathname changes in the sound module.
- [x] Recipes for `sonar`, `scan`, `edge` and `hail`. Keep every level gentle.

### L12 PAGE: page content

**Owns:**

- Page components: `components/Home/*`, `About/*`, `Experience/*` (except L11's emit), `Skills/*`, `Contact/*` (except ContactForm handlers).
- Shared content components: `StatsStrip/*`, `Explore/*`, `Recommendations/*`, `Magnet/*`, `Motion/*`, `PageHead/*`.
- `app/page.scss` (except L2's world-off rules) and `hooks/useCountUp.ts`.

- [x] **C9 (layout half):** under `(min-width: 900px) and (min-aspect-ratio: 11/10)`:
  - StatsStrip and Explore become 2×2 grids at `max-width: min(46rem, 58vw)`.
  - Recommendations is capped the same way.
  - Contact stacks intro, cards and form in one left column, with the LocationMap under the form.
  - `.page-nav` aligns left.
  - About's bio column moves left of the station, or narrows so the station has the right side.
- [x] **B6 (layout half):** on wide screens `.skills__grid` becomes one column at `max-width: min(48rem, 58vw)` (the `--span` classes neutralised), tiles 4–5 per row.
- [x] **C8 (markup half):**
  - Spacers `<div className="world-window" data-world-window aria-hidden="true" />` on narrow layouts, sized `clamp(11rem, 32svh, 18rem)`: Home between stats and explore, About before the recommendations, Contact between cards and form.
  - Shown only under `html[data-world-expected]:not([data-world='off'])` and narrow widths.
- [x] **G3 (markup):** add `data-reading` to the hero copy, page heads, the About bio, the Recommendations quote and the contact intro. Use `data-reading="large"` on headings.
- [x] **B2 (markup):**
  - `data-world-target="contact:<name>"` on the contact cards.
  - `data-world-target="globe:home"` on the LocationMap.
  - Experience cards already carry `role:<i>`.
- [x] **A16 (page half):** ScrambleText gains an `onFrame(text)` callback; RoleRotator writes `worldStore.heroRole`.
- [x] **FX18:** StatsStrip renders the value in an sr-only span and marks the animated digits `aria-hidden`. useCountUp returns the target below `full` motion and never puts 0 in the DOM before counting starts. Test: `ariaSnapshot` of Key stats has no "0+".
- [x] **FX19:** RoleRotator stacks every title in one grid cell (inactive ones `visibility: hidden`, `aria-hidden`), so the row keeps the tallest height. Remove `-`, `/` and Greek glyphs from the scramble set. Test: at 375px, the CTA's top doesn't move over a 14s window.
- [x] **FX32:** Magnet adds a plain `magnet` class, skips its effect below `full` motion and on non-fine pointers, and uses mouse pointer events only.
- [x] **FX33:** the explore card icon's depth works: move the glass painting to an inner layer and set `preserve-3d` on the card. If that breaks the spotlight, remove the dead `translateZ` instead. Also remove StatsStrip's dead `preserve-3d`.
- [x] **FX36:** each skills category's tile list is a roving-tabindex group (one tab stop per category, arrows move between tiles, `aria-describedby` for the level), so `focusin` lights badges. Test: Tab then → moves focus between tiles.

---

## Wave 2: Integration, verification, review, docs

### Task 90: Merge lanes

- [x] Merge the lane branches into `claude/world-immersion` in this order: L12, L2, L1, L3, L4, L5, L6, L7, L8, L9, L10, L11. Resolve conflicts by keeping both intents. _(Merged into `claude/world-immersion-rpta9t` in dependency order instead: L12, L3, L2, L1, L6, L5, L4, L7, L8, L10, L9, L11.)_
- [x] After each merge, run `npm run typecheck` and `npm run lint`, and fix anything broken.
- [x] Apply the cross-lane follow-ups that lane reports flagged, e.g. `setTipTarget` calls in station files, `at` on cues and the scan key event.

### Task 91: Full verification

- [x] `npm run verify`, `npm run build`, `npm run test:e2e` (full suite, both projects). Fix failures in the app, not by loosening tests.
- [x] Visual QA on the prod build, both themes, at 1440×900, 1024×768, 390×844 and 844×390. Cover every route, a flight between every station pair, the tour, free roam (autopilot, dock, signals, scan), the project modal and project pages, and the theme switch. Check each motion level (full, calm, still) and the world off.
- [x] Perf check on the prod build (M3, then 4× CPU throttle at 390×844): _(Tier held high (medium on the phone profile) for 60s idle and after flights; settled draw calls rose by 3 at most and fell on `/about` and `/skills`. A theme switch misses 50ms only on the 4× throttled phone profile's first switch (see PF2 + A21). First-flight frames stay at 50ms or under on desktop (M3, 50ms max) and on the unthrottled phone (33ms max). On the 4× throttled phone profile every first flight to a new station except `/` has one frame of about 83-117ms, so that sub-target is not met there; the baseline misses it too (67-133ms). f0a1044 then moved the Experience patch atlas out of the first flight frame, but that change was not measured again. The probe follows links with a synthetic click, so N1's touch-intent warm-up is not exercised.)_
  - idle 60fps;
  - first-flight frames ≤50ms;
  - theme switch ≤50ms;
  - tier stays high for 60s;
  - draw calls on settled pages within +5 of before.
- [x] Contrast check: every `[data-reading]` block ≥4.5:1 at p10 on every route, both themes.

### Task 92: Review

- [x] Multi-dimension code review of the full diff:
  - correctness;
  - warm-up and perf rules;
  - React Compiler rules;
  - a11y;
  - world-off, no-JS and motion levels;
  - conventions.
- [x] Adversarially verify the findings, then fix the confirmed ones.

### Task 99: Docs

- [x] Update AGENTS.md and CLAUDE.md for every behaviour that changed, from the lane reports' doc notes: motion levels, new store fields, new components, the readability guard, the tour controls, the palette, docking, signals scan, sound bus and haptics.
- [x] Mark this plan's items done.
- [ ] Push and open the PR. _(Task 99 pushes the branch; the session that ran the workflow opens the PR.)_
