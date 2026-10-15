# Portfolio Next: immersion and spatial UI review

Reviewed 8 October 2026 against main commit `4de05ad4328d1867d2cc4fcb8bfdc9860921c41f` (7 October 2026).

This is a source review of the scene, camera, input, content, sound, rendering, styles, and relevant tests. The local clone stalled; a source snapshot was retrieved through the GitHub connector instead. I did not run the site, tests, device benchmarks, or a visual usability session. Visual/UX outcomes below are design recommendations; potential defects are identified separately as source-level findings. No repository changes were made.

**Main recommendation**

Make the stations places where visitors can read and interact with the portfolio. The current world already has strong movement, atmosphere, and responsiveness. Its largest opportunity is the handoff between inspecting a 3D object and learning what that object represents.

A useful target is: every major visible interface has a physical location and purpose in the world. Screens, structural frames, labels, maps, and artifacts can be WebGL objects. Reading, links, text selection, and forms can remain semantic HTML anchored to those objects.

**How the application works**

- Next.js App Router serves the portfolio routes and project pages. The root layout renders one persistent World beside the semantic main content and passes it a compact slice of content.json: project screenshots, skill identities, roles, tour captions, and the CV. See [layout.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/app/layout.tsx#L58).
- World owns preference/fallback logic, lazy canvas loading, DOM inputs, navigation events, and tour/explore overlays. Its main scene is explicitly aria-hidden. See [World.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/World.tsx#L112).
- WorldCanvas contains the main React Three Fiber scene. Visited stations stay mounted, the next tour station warms ahead of time, and free roam mounts the remaining stations at 700 ms intervals. Distance checks suppress distant station rendering and frame work. See [WorldCanvas.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/WorldCanvas.tsx#L156) and [stationHooks.ts](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/stationHooks.ts#L63).
- Routes correspond to actual world coordinates. Home starts at the origin; Contact is approximately 226 units down the Z axis. The six main stations are Gateway hub, Crew habitat, Tether array, Fabrication yard, Research outpost, and Comms array, with a separate derelict/404. See [routes.ts](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/routes.ts#L21).
- CameraRig plans interstation flights, hands control to ExploreControls during free flight, and reads stationCamera for the pose within each station. Scroll and content focus drive the camera through the project helix and down the experience beam. See [CameraRig.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/CameraRig.tsx#L65) and [stations.ts](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/stations.ts#L254).
- worldStore is mutable shared state between the DOM and WebGL. Scroll, pointer, camera, selection-related focus, flight progress, and contact events do not require React rerenders on every frame. worldMode separately manages page, tour, and explore. See [worldStore.ts](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/worldStore.ts#L1).
- Pointer events originate on document.body, with custom filtering so a 3D object cannot steal clicks through page copy or dialogs. Pointer lock suppresses these ordinary 3D raycasts. See [interaction.ts](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/interaction.ts#L44).
- Scene readiness includes model downloads, asynchronous shader compilation, and staged texture uploads. Quality adjusts pixel ratio and effects; mobile/touch also selects lighter hulls, fewer particles, and no shadows. See [WorldCanvas.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/WorldCanvas.tsx#L185), warmup.tsx, and quality.ts.
- Sound already has synthesized ambience, station-specific spatial voices, camera-relative listening, flight/arrival cues, and interaction feedback. The header and mobile menu already use hologram shaders. These are established features to build upon.

**The most significant immersion breaks**

1. Skill and role selection primarily means “scroll the current HTML page.” SkillsStation and ExperienceStation call focusOnPage; useWorldFocus looks for a matching DOM element and returns if one is absent. A station encountered while roaming from another route therefore lacks a reliable content reveal at that object. [SkillsStation.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/stations/SkillsStation.tsx#L481), [ExperienceStation.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/stations/ExperienceStation.tsx#L266), [useWorldFocus.ts](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/hooks/useWorldFocus.ts#L17).
2. Selecting a project on the project route opens its modal. The modal intentionally covers the viewport with a dimmed, blurred backdrop and a strong dialog surface. This improves conventional reading but separates the case study from its physical screen. [ProjectsStation.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/stations/ProjectsStation.tsx#L617), [ProjectDetailsModal.scss](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/Projects/ProjectDetailsModal/ProjectDetailsModal.scss#L16).
3. Tour and explore modes hide and inert the page. Visitors have a rich way to travel, but detailed reading still routes them back to page mode. The missing capability is a focused, readable interaction at a world object. [World.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/World.tsx#L163).
4. Much of the surrounding interface remains tied to screen coordinates: cursor tooltip, tour caption card, signal card, docking prompt, and radar. Some screen-fixed controls are useful; contextual information would feel more connected when attached to its station or object.

**Priority 1: a shared inspection interaction**

Add a reusable inspection state for a selected station entity. It should work whether the visitor arrives through the page, tour, map, or free flight.

Suggested sequence:

1. Hover, tap, or keyboard focus identifies an object with the same restrained highlight and action label.
2. Activate it; release pointer lock, stop flight input, and move into a deliberately framed inspection pose.
3. Unfold one or two content panels from the object, keeping the station visible and maintaining readable size.
4. While a visitor reads, scrolls, selects text, or types, hold the camera and panel steady.
5. Close or press Escape to restore the previous pose, scroll position, and focused control. Browser Back should undo the appropriate content selection.

A selection record could identify station, entity type, stable entity ID, world anchor, route, and return pose. Keep discrete selection/focus in a subscribable store; keep frame-by-frame transforms in the existing mutable render state. Coordinate camera ownership explicitly between page navigation, free flight, and inspection.

This is the highest-leverage architectural addition because every station can use it.

**Priority 2: make Projects an inspection workbench**

The project helix already carries 15 real project screens, scroll-driven camera movement, screenshot cycling, and sharp image loading. Preserve that foundation.

On selection, keep the active screen in the world and unfold:

- a concise brief: problem, users, constraints;
- a solution panel: your role, architecture, important decisions;
- a result panel: outcomes, screenshots, and relevant links.

Render the frame and mounting hardware as geometry; anchor readable HTML to it. Let visitors choose screenshot pages directly and stop automatic screenshot motion while inspecting. Keep existing project URLs, browser history, and the full article view for direct links or extended reading.

Start with one case study. Sidenote is a strong candidate: an authored illustrative sequence can show a document, retrieval, a cited answer, and the highlighted source passage. Audi Form Builder could demonstrate React components assembling into a published form. Sanctions Checker could show dataset ingestion and the matching stages described in your existing copy. These should explain the actual work; use illustrative data and only include outcomes you can substantiate.

The data model needs an authored caseStudy structure and stable relationships; WorldContent currently contains project title, slug, icon, and screenshots, but no detailed case-study narrative. Keep content in the shared source rather than burying prose in station components.

A smaller improvement can precede the inspector: make the project index easier to scan by name. Its visible entries are numbers while project titles are screen-reader-only (Projects.tsx:388). A compact named selector, with title previews on hover/focus, helps visitors jump deliberately among 15 projects.

**Priority 3: connect skills and experience to evidence**

The skills constellation already reacts to the hovered page tile and active category. Give selection a deeper result:

- choose a skill and bring its badge into a quiet inspection orbit;
- show which projects and roles demonstrate it;
- select an evidence item to inspect that project or role;
- reveal connectors only for the current selection, avoiding a dense web of lines.

The current DOM UI displays numerical proficiency and category averages. Evidence such as “used to deliver these systems” gives visitors something more concrete to evaluate. See [Skills.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/Skills/Skills.tsx#L23).

For Experience, keep the vertical tether and scrolling camera. Let the selected role pod unfold its mission patch and a compact log containing dates, scope, key decisions, and linked work. The source already carries role title/company into the world, but richer inspection will need authored role IDs and content. Avoid using array index as the long-term identity for deep links.

**A physical purpose for each station**

| Station                     | Existing behavior                                     | Proposed spatial interface                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home / Gateway hub          | Astronaut, portal, station hull, page introduction    | A docking orientation display: clear destinations, an optional tour, and one highlighted project to inspect. Keep the first action obvious.                                    |
| About / Crew habitat        | Helmet, habitat ring, biography on page               | A personal dossier on a habitat console; portrait, short story, and a few selectable transmission cards for recommendations. Preserve quoted recommendations verbatim.         |
| Experience / Tether array   | One pod per role; camera follows the reading position | Each pod opens a mission log with linked project artifacts.                                                                                                                    |
| Projects / Fabrication yard | Screenshot helix and surrounding page HUD             | A case-study workbench with screenshot controls and authored technical story panels.                                                                                           |
| Skills / Research outpost   | Orbiting badges and category constellations           | Selected skill reveals its project/role evidence in a small local cluster.                                                                                                     |
| Contact / Comms array       | Globe, dish, transmission particles, rocket launch    | A comms terminal containing the real form; submission, error, retry, and success remain readable at the terminal. The existing packet/rocket effects complete the interaction. |

Give panels attachment points, a little thickness, and consistent orientation. A station-specific physical purpose makes their placement intelligible. Limit simultaneously open panels so visitors always know where to look.

**Priority 4: promote the existing sector map into navigation**

NavRadar already projects actual station positions, height, flight paths, and camera location, but its output is a decorative aria-hidden canvas. Build a selectable navigation version using the same data. See [NavRadar.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/NavRadar.tsx#L383).

An expanded chart can show station labels, current position, visited state, a selected station summary, and a clear Travel/Inspect action. On desktop it could unfold from a cockpit console; on mobile it can become a nearly frontal, readable chart. Preserve keyboard-accessible station links and touch targets. This offers spatial navigation without requiring every visitor to learn flight controls.

Keep essential orientation/exit controls consistently available. Secondary actions such as audio, presentation preferences, and the command palette can live in a compact utility console. The existing hologram navigation already has depth and motion; extending its purpose matters more than giving it another shader.

**Priority 5: object-anchored prompts and staged discovery**

WorldTooltip currently follows the cursor. For content objects, use an anchored callout with a short leader, object title, and action verb. Hide or simplify it at distance; expand it on deliberate focus. Ensure it does not disappear behind geometry while keyboard-focused.

Teach the next useful action where it is needed: “Inspect project,” “Read mission log,” or “Plot course.” Allow equivalent pointer, touch, and keyboard activation. In pointer-locked flight, a separate centre reticle selection mechanism would be necessary because ordinary pointer raycasts are intentionally blocked.

Hidden signals and persistent discoveries already exist. A useful extension is a small journal for revisiting found information, with related portfolio evidence. Important CV/contact actions should remain directly available as they are today.

The guided tour already pauses over its caption or focused controls. An explicit Hold/Resume control would make that behavior clearer on touch; Previous and resumable stops could extend it. These are refinements to the implemented tour, not missing basic pause functionality.

**How much should be true 3D?**

| Interface type                                                         | Recommended rendering                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Hulls, console frames, panel mounts, maps, physical buttons, artifacts | Geometry in the main scene                                                              |
| Short station names, numeric readouts, object labels                   | SDF text or carefully budgeted meshes                                                   |
| Project prose, links, forms, search, selectable text                   | Semantic HTML anchored to a world transform                                             |
| Reading on a narrow viewport                                           | Active panel turns frontal and fits the viewport; surrounding geometry provides context |
| Long case studies, direct links, no WebGL                              | Existing semantic route presentation                                                    |

Drei Html with transform/occlusion, or a custom projected DOM layer, are possible implementation routes. Neither automatically solves focus, clipping, mobile keyboards, or occlusion. Prototype one panel before committing to a full conversion.

Crucially, World currently marks its scene container aria-hidden and inerts main content outside page mode. A spatial HTML layer must mount outside hidden/inert ancestors, expose the active content, and remove inactive/occluded controls from the tab order. Avoid rendering accessible duplicates of the same panel.

Keep body text at stable readable size, nearly frontal while in use, and protected from bloom. The existing screenshot bloom masks offer a pattern for non-emissive displays. Enable parallax and subtle material response around reading surfaces, while holding the active reading surface steady.

**Comfort and performance**

Flights are intentionally cinematic. Source durations for about-turns are 5.2–7.8 seconds; forward flights are 1.1–3.6 seconds. See [flight.ts](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/flight.ts#L333). Add an optional quick/calm transit presentation for repeated navigation while preserving the world. Do not simply run the same turning arc faster: that increases angular velocity. Plan a shorter, gentler transition or a restrained fade/snap.

Separate optional camera motion from rendering quality: a visitor can want rich geometry and lighting while preferring no banking, shake, or FOV kick. Reduced-motion handling already exists and should remain authoritative.

Expand performance adaptation to the new content workload: cap visible labels and panels, lazily mount detailed inspection content, simplify distant details, and warm new GPU work through existing infrastructure. Current low quality does not automatically replace every desktop hull or turn off desktop shadows. Profile target devices before selecting budgets. Avoid an additional renderer for each station panel.

**Source-level issues worth validating first**

- ExploreHud intercepts Enter for docking when near a station and excludes only input elements; a focused button can therefore compete with the docking shortcut. ExploreControls also handles movement keys for non-form targets. Give focused UI controls priority and define input ownership explicitly. [ExploreHud.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/ExploreHud.tsx#L375), [ExploreControls.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/ExploreControls.tsx#L288).
- Waypoints fades unavailable/nearby buttons with opacity and pointer-events, but does not correspondingly disable their keyboard focus. Synchronize visibility with focusability and expose useful alternatives. [Waypoints.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/Waypoints.tsx#L53).
- Reduced motion selects demand rendering, while free-flight movement consumes mutable inputs inside useFrame. The available invalidation paths suggest movement/autopilot may stall after warmup. This needs browser reproduction; the reviewed tests check mode and autopilot state but do not establish sustained camera movement. [WorldCanvas.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/WorldCanvas.tsx#L242), [ExploreControls.tsx](https://github.com/lewishadden/portfolio-next/blob/4de05ad4328d1867d2cc4fcb8bfdc9860921c41f/components/World/ExploreControls.tsx#L378).

**Suggested delivery order and acceptance checks**

1. Establish selection, input ownership, focus restoration, and one stable inspection pose.
2. Prototype Sidenote on the existing helix with an anchored brief and screenshot controls.
3. Validate mouse, keyboard, touch, Back/forward, refresh/deep-link, reduced motion, world-off fallback, and contact-form keyboard layout before replicating the pattern.
4. Extend the shared inspection system to role pods, skill evidence, and the comms terminal.
5. Promote the existing sector map and add station-specific environmental storytelling.

For the prototype, the key test is whether a first-time visitor can identify a project, understand what you built, inspect evidence, and return to exploring without losing place. Measure frame time and interaction responsiveness separately on real desktop/mobile hardware. More immersion should improve the portfolio journey as well as the spectacle.
