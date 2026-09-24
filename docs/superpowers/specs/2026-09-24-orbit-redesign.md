# Redesign — "Orbit" (Dark Sci‑Fi Glow + Persistent WebGL World)

**Date:** 2026-09-24
**Goal:** Complete visual redesign: modern, fresh, animation-heavy, with real-time 3D
throughout. Replaces the "Ember Atelier" warm-editorial look.

## Decisions (agreed with Lewis)

| Question       | Decision                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------- |
| Direction      | Dark sci-fi glow — near-black space, electric violet / cyan accents, glass surfaces       |
| 3D             | WebGL everywhere — one continuous scene behind the whole site; camera flies between pages |
| Assets         | AI-generated with Higgsfield (source renders → image-to-3D GLB models)                    |
| Kept           | Separate routes per section (SEO), light + dark themes                                    |
| Free to change | Microcopy, the Leaflet map (replaced by a 3D globe)                                       |

## Design language

- **Type:** Unbounded (display, wide geometric), Geist (body), Geist Mono (labels, data).
- **Palette (dark):** space `#05060d`, glass panels `rgba(14,16,34,.55)` + hairline borders,
  text `#eef0ff` / `#a6abcc`, accents violet `#a78bfa`, cyan `#22d3ee`, lime `#bef264`
  (status), pink `#f472b6` (sparks). Signature gradient violet → cyan.
- **Palette (light):** "daylight lab" — `#eef0f8` canvas, white glass, deep violet `#6d28d9`
  and teal `#0e7490` accents (AA contrast), softer bloom in 3D.
- **Surfaces:** glass cards with backdrop blur, animated conic-gradient borders on focus/hover,
  mouse-follow spotlight, 3D tilt.

## The world (`components/World`)

A single `<Canvas>` mounted in the root layout (persists across navigations), lazy-loaded
after first paint. Each route is a **station** placed somewhere in space; changing route
flies the camera to the next station (FOV kick, chromatic aberration and star stretch scale
with camera velocity). Page scroll drives the camera within a station.

| Route         | Station                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/`           | Floating astronaut with laptop, energy portal rings, orbiting crystal shards                                         |
| `/about`      | Astronaut helmet, holographic scan rings                                                                             |
| `/experience` | Satellite above a light beam; one glowing node per role, camera descends on scroll                                   |
| `/projects`   | Retro-futuristic terminal inside a helix of floating project screens                                                 |
| `/skills`     | Procedural gas-giant planet with an orbiting constellation of skill icons                                            |
| `/contact`    | Dotted holographic globe (Peterborough beacon + arcs to EU cities) and a rocket that launches when a message is sent |
| 404           | Astronaut tumbling, lost in space                                                                                    |

Global layers: twinkling starfield, procedural nebula backdrop, camera-relative space dust,
bloom / vignette / grain post-processing.

### Performance & accessibility

- Canvas loads on `requestIdleCallback`, never blocks LCP; DPR capped, adaptive on low FPS.
- GLBs are meshopt-compressed with WebP textures, loaded per station on demand.
- `prefers-reduced-motion`: render on demand, camera snaps (no flight), no auto-rotation.
- No WebGL / Save-Data: CSS gradient backdrop plus 2D renders of the same models.
- Canvas is `aria-hidden`; all content stays semantic HTML above it.

## Motion (DOM)

Letter-split hero name, text-decode role rotator, scroll-reveal with blur, magnetic
buttons, spotlight + tilt cards, count-up stats, timeline beam that fills on scroll, marquee
rows, trailing cursor glow, page transitions synced to the camera flight. All gated by
`prefers-reduced-motion` (framer `MotionConfig reducedMotion="user"` + global CSS rules).

## Removed

Doodles/Stamp illustration library, grain overlay, canvas particle background,
Leaflet map (`leaflet`, `react-leaflet` dependencies).
