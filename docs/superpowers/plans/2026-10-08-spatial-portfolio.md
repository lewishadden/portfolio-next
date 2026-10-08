# Spatial portfolio implementation plan

> **For agentic workers:** Execute the approved review using coordinated parallel tasks and a final independent review. Read [the source review](../specs/2026-10-08-spatial-portfolio.md) and AGENTS.md.

**Goal:** Bring portfolio content into the persistent world through stable, accessible inspection, meaningful evidence, physical station interfaces, spatial navigation, discoverable controls, and calm travel.

**Architecture:** Keep existing page/tour/explore modes and add orthogonal inspection with one selected entity. Reuse real semantic HTML outside the aria-hidden canvas, anchored to scene objects and a stable inspection camera. Preserve canonical routes, browser history, no-WebGL content, and reduced-motion preferences.

**Tech Stack:** Next.js 16, React 19, TypeScript, R3F/three/drei, SCSS, Playwright.

**Spec:** [Spatial portfolio source review](../specs/2026-10-08-spatial-portfolio.md) (user explicitly requested implementation of every suggestion and a new branch from main).

## Global constraints

- Branch feat/spatial-portfolio-inspection from main at 4de05ad4328d1867d2cc4fcb8bfdc9860921c41f; PR targets main as explicitly requested.
- No new dependencies; follow existing import order, camelCase, BEM, dark/light themes.
- Do not invent metrics, career claims, architectural facts, or alter verbatim recommendations.
- Keep direct project routes, normal modified links, semantic reading and forms.
- Only render one detailed inspector; coordinate focus, input, camera and occlusion.

## Review focus

- Back/forward/deep links and closing restore the expected selection, page, camera and focus.
- Enter/Space on focused controls never leaks into docking or flight.
- Mobile form keyboard, narrow screens and reduced motion remain usable.
- Hidden or occluded controls do not remain tabbable.
- World off, loading and WebGL failure expose usable semantic content.

## Shared interfaces

New components/World/inspectionTypes.ts owns InspectionSelection and InspectionCatalog.
inspection.ts exports inspectEntity(selection), closeInspection(), useInspection(): InspectionSelection|null, inspection.get(), inspection.subscribe(), isInspecting().
SpatialInspector renders {catalog: InspectionCatalog}; WorldContent gains inspection: InspectionCatalog, assembled in app/layout.tsx with buildInspectionCatalog(content).
WorldUtilities renders with the published CV metadata; supplies Sector chart and preferences. Inspector and WorldUtilities are mounted outside World's aria-hidden subtree.
travelPreference.ts exports getTravelPreference(): 'cinematic'|'calm', useTravelPreference(), setTravelPreference(value). Calm disables involuntary motion and shortens route transitions.
All input layers use document.querySelector('[data-world-input-owner]') and focused-control semantics to defer to active interface.

## Tasks

- [x] 1. Inspection core: shared store/history, camera ownership and return pose, projected anchor, physical frame and readable inspector integration. Files inspection.ts, InspectionRig.tsx, World.tsx, WorldCanvas.tsx, CameraRig.tsx. Test open/close/back, stable camera, off-route selection.
- [x] 2. Content and inspector: build catalog from existing content, authored project briefs/technical sequences, role/skill evidence, about dossier and contact console. Files inspectionContent.ts, SpatialInspector.tsx/.scss, app/layout.tsx, types.ts. Test content selection, evidence links, contact input, history, focus.
- [x] 3. Station/page entry points: in-world clicks inspect entities, keyboard-visible matching actions, named project selector, skill evidence UI, object-anchored prompts. Files stations/\*.tsx, Projects, Skills, Experience, About/Home/Contact and WorldTooltip as needed. Test accessible entity opening, no-WebGL parity.
- [x] 4. Navigation/discovery: interactive sector chart, utilities, Hold/Resume/Previous and resumable tour, persistent discovery log. Files WorldUtilities/SectorChart, TourOverlay, worldMode, SignalsHud/signalStore. Test keyboard chart travel, tour controls, reopen discovered messages.
- [x] 5. Input/comfort: focused controls own keys; pointer-lock denial fallback; no invisible tabbable waypoints; calm travel preference. ExploreControls, ExploreHud, pointerLock, Waypoints, travelPreference. Test docking key conflict, unavailable lock, focus and preference persistence. Core task applies continuous demand invalidation during explicit reduced-motion exploration.
- [ ] 6. Integrate and verify: meaningful regression tests first where runnable; npm verify/build/e2e in available environment or CI. Independent review, fix findings, publish commits, ready PR with evidence.

## Execution ledger

- Main base confirmed through GitHub. Remote feature branch created.
- User implementation instruction authorizes execution and PR without another approval gate. Main branching explicitly overrides AGENTS develop convention.
- Scope divided into bounded file ownership across agents, root owns integration/verification/publishing.
