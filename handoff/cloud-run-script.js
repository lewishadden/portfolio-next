export const meta = {
  name: 'world-immersion-pass',
  description: 'Run the 12 world-immersion lanes in worktrees with per-lane adversarial review, merge them, then QA, review, fix and document the whole branch',
  whenToUse: 'Executing docs/superpowers/plans/2026-10-09-world-immersion.md Wave 1 and Wave 2',
  phases: [
    { title: 'Lanes', detail: 'implement each lane in its own worktree (2 at a time, dependency-ordered)' },
    { title: 'Lane review', detail: '3-lens review per lane, adversarial verify, fix, loop until dry' },
    { title: 'Merge', detail: 'serialized merges into claude/world-immersion-rpta9t, build, push' },
    { title: 'Integrate', detail: 'Task 90 cross-lane follow-ups' },
    { title: 'Verify', detail: 'Task 91 verify + build + full e2e, fix failures' },
    { title: 'QA', detail: 'desktop, phone, degradation/a11y/contrast and perf sweeps, verify, fix' },
    { title: 'Review', detail: 'Task 92 six-dimension review of the full diff, verify, fix, loop until dry' },
    { title: 'Docs', detail: 'final verification, Task 99 docs, push' },
  ],
}

const INTEGRATION = '/home/user/portfolio-next'
const BASE = 'ceb02b8'
const BRANCH = 'claude/world-immersion-rpta9t'
const PLAN = 'docs/superpowers/plans/2026-10-09-world-immersion.md'
const TRAILERS = 'End every commit message (merge commits included) with exactly these two lines after a blank line:\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_016j6Qd2KR8F6hdXjxxeJxhq\nNever put a model name anywhere else (code, comments, docs).'
const PUSH = `Push with \`git -C ${INTEGRATION} push -u origin ${BRANCH}\`; only on network errors retry up to 4 times waiting 2s, 4s, 8s, 16s. Never force-push, never push any other branch, never open a pull request.`
const LOCK = 'Build lock (at most 2 builds on the machine): `until mkdir /tmp/wi-build-1 2>/dev/null && L=1 || { mkdir /tmp/wi-build-2 2>/dev/null && L=2; }; do sleep 5; done; npm run build; rmdir /tmp/wi-build-$L` (always release the lock you took, on failure too).'
const ENV = 'Environment: Linux container, 4 cores shared with other agents. Chromium for Playwright: /opt/pw-browsers/chromium (executablePath); WebGL args `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` (software GL: judge correctness/layout, not smoothness). e2e: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium PLAYWRIGHT_BASE_URL=http://localhost:<port> npx playwright test <spec> --reporter=line`. See tests/e2e/fixtures.ts for switching the world on/off and skipping the loading screen. Never run npm install / npm ci (node_modules is hard-linked across worktrees). Put throwaway scripts under /home/user/wi/scratch/, never in the repo.'

const LANES = [
  { key: 'l12', name: 'L12 PAGE', title: 'page content', port: 3312, deps: [],
    items: 'C9 layout half, B6 layout half, C8 markup half, G3 markup, B2 markup, A16 page half, FX18, FX19, FX32, FX33, FX36' },
  { key: 'l3', name: 'L3 PRJ', title: 'projects', port: 3303, deps: [],
    items: 'FX25, FX37, DV2, PF4, FX39, B9, B8+PF3 (modal half), B14+FX22, B15 (page half), B10, B12, B13, FX13, FX14, FX23, FX24, F4 (ride half)',
    note: 'The camera half of B15 (CameraRig easing projectFocus) belongs to L1; if L1 is already merged, make sure your page half connects to it.' },
  { key: 'l1', name: 'L1 CAM', title: 'camera, framing and the course line', port: 3301, deps: ['l12'],
    items: 'FX12, FX02, C9 (camera half), B6 (camera half), B15 (camera half), C11, C8 (camera half), FX21, FX30 (camera half), D10, FX04 (camera half), N8, A1',
    note: 'CLAUDE.md camera rule: whenever you change flight.ts or CameraRig.tsx, simulate all 30 ordered pairs of the six navigable stations (turn rate, total rotation, clearance) at desktop and phone sizes with a throwaway script. L12 (left-column layout, [data-world-window] spacers, data-reading) is merged: tune C9 companions and C8 framing against it for real. C11: see the decision in the lane brief.' },
  { key: 'l2', name: 'L2 TRN', title: 'transitions, modes, the tour and page chrome around the canvas', port: 3302, deps: [],
    items: 'C5+FX09, E6 (incl. FX21 tour half), E5 (trigger), G1+FX16, FX35, C3, C4, FX03, N7' },
  { key: 'l4', name: 'L4 STN-A', title: 'Home, About, Experience, Lost, shared station machinery', port: 3304, deps: ['l12'],
    items: 'PF5, FX20+F3 (charge half), B21, C7 (arrival ring), N2, E5+G2 (listeners), B2 (experience half), B1, B4, A16, A3, B20',
    note: 'Pass world positions as CueDetail.at on cues and pings you emit (L11 spatialises them).' },
  { key: 'l5', name: 'L5 STN-B', title: 'Skills and Contact stations', port: 3305, deps: [],
    items: 'PF6, B6 (station half), N2 (badges), B21 (skills, contact), B5, E5+G2 (listeners), ContactStation globe click',
    note: 'Pass world positions as CueDetail.at on cues and pings you emit (L11 spatialises them).' },
  { key: 'l6', name: 'L6 SKY-A', title: 'sky bake, theme, post effects, quality', port: 3306, deps: ['l12'],
    items: 'PF2+A21, D6, D4, FX08, G3+FX06 (world half), D8, FX30 (optics half)',
    note: 'L12 is merged, so [data-reading] markup exists: verify the ReadingGuard against it.' },
  { key: 'l8', name: 'L8 FREE-A', title: 'free-roam interaction, the ship, the edge', port: 3308, deps: [],
    items: 'FX17, A2+FX28, E1, G1 (pitch), A1 (autopilot half), N3, A6 (phases 1-3), E8, E9',
    note: 'For L9 E3: make ExploreControls key F dispatch a `world:scan` window event (L9 listens for it); note it in the report. Keep L1 C11 flight-fog behaviour in ExploreControls if L1 is merged. Pass CueDetail.at on bump cues.' },
  { key: 'l7', name: 'L7 SKY-B', title: 'stars, dust, rocks, beacons, traffic', port: 3307, deps: [],
    items: 'C7 (stars), D6+FX31 (light stars), FX30 (streak half), D9, D2, FX07+FX04 (names half)' },
  { key: 'l9', name: 'L9 FREE-B', title: 'signals, radar, docking', port: 3309, deps: ['l8'],
    items: 'FX27, FX04 (radar half), E10, E2, E3, E7, F7 (source half)',
    note: 'L8 is merged: listen for its `world:scan` event (key F) and use its worldStore.autopilotPath.' },
  { key: 'l10', name: 'L10 CHR', title: 'site chrome', port: 3310, deps: [],
    items: 'FX34, FX38, DV3, FX05, FX06, A9+FX30 (tear half), A10, A11+FX10+FX15+FX26, N4 (UI), A12, A14+PF7, A15+FX29, N5+FX29 (readout), G2, N6' },
  { key: 'l11', name: 'L11 SND', title: 'sound and haptics', port: 3311, deps: ['l4', 'l5', 'l8', 'l9'],
    items: 'F1, F2, F3, F4, F7, N9, recipes for sonar/scan/edge/hail',
    note: 'L4, L5, L8 and L9 are merged: add CueDetail.at to any spawnPing/bump/cue emitters they missed.' },
]

const FOLLOWUP = { type: 'object', properties: { file: { type: 'string' }, change: { type: 'string' }, why: { type: 'string' } }, required: ['file', 'change', 'why'] }
const LANE_SCHEMA = {
  type: 'object',
  properties: {
    baseCommit: { type: 'string' },
    headCommit: { type: 'string' },
    items: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, status: { type: 'string', enum: ['done', 'partial', 'skipped'] },
      commits: { type: 'array', items: { type: 'string' } }, verification: { type: 'string' }, note: { type: 'string' } },
      required: ['id', 'status', 'verification'] } },
    followups: { type: 'array', items: FOLLOWUP },
    docNotes: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    tests: { type: 'string' },
    verifyPassed: { type: 'boolean' },
  },
  required: ['baseCommit', 'headCommit', 'items', 'followups', 'docNotes', 'risks', 'tests', 'verifyPassed'],
}
const FINDINGS = {
  type: 'object',
  properties: { findings: { type: 'array', items: { type: 'object', properties: {
    title: { type: 'string' }, file: { type: 'string' }, line: { type: 'integer' },
    severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
    detail: { type: 'string' }, failureScenario: { type: 'string' }, suggestedFix: { type: 'string' }, evidence: { type: 'string' } },
    required: ['title', 'file', 'severity', 'detail', 'failureScenario'] } } },
  required: ['findings'],
}
const VERDICT = { type: 'object', properties: { refuted: { type: 'boolean' }, reasoning: { type: 'string' }, betterFix: { type: 'string' } }, required: ['refuted', 'reasoning'] }
const FIX = {
  type: 'object',
  properties: {
    startCommit: { type: 'string' }, headCommit: { type: 'string' },
    results: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string' }, outcome: { type: 'string', enum: ['fixed', 'no_change_needed', 'skipped'] }, commit: { type: 'string' }, note: { type: 'string' } },
      required: ['title', 'outcome'] } },
    followups: { type: 'array', items: FOLLOWUP },
    docNotes: { type: 'array', items: { type: 'string' } },
    verifyPassed: { type: 'boolean' }, tests: { type: 'string' }, pushed: { type: 'boolean' },
  },
  required: ['startCommit', 'headCommit', 'results', 'verifyPassed', 'tests'],
}
const MERGE = { type: 'object', properties: { merged: { type: 'boolean' }, mergeCommit: { type: 'string' }, conflicts: { type: 'string' }, checksPassed: { type: 'boolean' }, pushed: { type: 'boolean' }, notes: { type: 'string' } }, required: ['merged', 'conflicts', 'checksPassed', 'pushed'] }
const VERIFY = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    failuresFixed: { type: 'array', items: { type: 'object', properties: { test: { type: 'string' }, cause: { type: 'string' }, commit: { type: 'string' } }, required: ['test', 'cause'] } },
    remainingFailures: { type: 'array', items: { type: 'object', properties: { test: { type: 'string' }, reason: { type: 'string' } }, required: ['test', 'reason'] } },
    headCommit: { type: 'string' }, pushed: { type: 'boolean' }, notes: { type: 'string' },
  },
  required: ['passed', 'failuresFixed', 'remainingFailures', 'headCommit', 'pushed'],
}
const DEDUP = FINDINGS

const LANE_LENSES = [
  { key: 'correctness', text: 'CORRECTNESS. Find real bugs: logic or maths errors, wrong units or coordinate spaces, stale closures, missing cleanup (listeners, rAF, timers, observers, worldStore fields not reset on route change or unmount), races between flights, route changes, modes and boot, SSR/hydration mismatches, null paths, broken keyboard or touch paths, and regressions to behaviour that existed before. Trace each from a real caller or input.' },
  { key: 'rules', text: 'PROJECT RULES. Check against CLAUDE.md ("Where three.js may be imported", "Rules that are easy to break", "Every feature must degrade") and the plan Global Constraints: warm-up (every new shader/material compiled before first draw: Precompiled or mounted hidden; textures via queueUpload; async GPU work via useWarmupTask), no new post passes or per-tier pass changes, every pow() base clamped to [0,1], React Compiler lint rules (no mutating hook return values; uniforms via setUniform), asGlow / maskBloom, no runtime three import in DOM-safe modules, correctness at motion levels full, calm and still, world off, no-JS, lite devices, accessibility (content in the DOM, aria-hidden canvas, keyboard with visible focus, 4.5:1 text, no more than 3 flashes per second), perf (no full-screen transparent geometry around the camera, instanced draws, settled draw calls at most ~+5), copy (British spelling, no em-dashes in user-facing text), conventions (camelCase everywhere, BEM, import groups, one folder per component), Lenis rules for overlays.' },
  { key: 'plan', text: 'PLAN FIDELITY. For every item in this lane\'s section of the plan, check the diff implements what the plan specifies (behaviour, files, interfaces, tests to add, verification). Report items missing, partial without a sound reason, or implemented in a way that loses the intended effect, and tests the plan asked for that are absent. Also flag edits to files outside the lane\'s ownership that the plan did not allow.' },
]
const VLENSES = [
  'REPRODUCE: can the claimed failure actually happen on a realistic path (real caller, real input, real state)? Trace it in the code.',
  'CONTEXT: is it already handled elsewhere, intentional per the plan / AGENTS.md / code comments, or is the rule it cites not actually a rule? Would the suggested fix cost more than it prevents?',
]
const VTIE = 'TIEBREAK: two reviewers disagreed. Weigh both directions carefully and decide on the evidence in the code.'

const GLOBAL_LENSES = [
  { key: 'correctness', text: LANE_LENSES[0].text },
  { key: 'warmup-perf', text: 'WARM-UP AND PERF. Every new shader, material, texture and composer change against the warm-up rules (Precompiled, mounted hidden, queueUpload one per frame, useWarmupTask, precompileComposer), post-processing tiers unchanged in pass structure, bloom masking, NaN-safe pow(), shadows decided once, per-frame allocations in useFrame, draw-call and triangle growth on settled pages, full-screen transparent geometry, rAF loops that run when idle, DOM measurement per frame causing layout thrash.' },
  { key: 'react-conventions', text: 'REACT RULES AND CONVENTIONS. React Compiler lint rule intent (no mutating hook return values, refs read during render, impure render), effect dependencies and cleanups, StrictMode double-mount safety, the three.js import split (DOM-safe modules never import three at runtime; check with the import graph), CLAUDE.md conventions (camelCase, BEM, import grouping, one folder per component, m.* not motion.*, Reveal components, Lenis stop/start for overlays, data-lenis-prevent), copy rules (British spelling, no em-dashes in user-facing text, titles format).' },
  { key: 'a11y', text: 'ACCESSIBILITY (WCAG 2.1 AA). Content stays in the DOM, canvas aria-hidden, new controls keyboard-operable with visible focus and correct roles/names/states (aria-pressed, aria-expanded, role=switch, role=status politeness), focus management on mode changes, modal and palette, inert usage, live-region spam, 4.5:1 text contrast over the world in both themes, flashes under 3/s, tap targets, reduced-motion respect, screen-reader duplication (sr-only + aria-hidden pairs).' },
  { key: 'degrade', text: 'DEGRADATION. Every changed feature at motion levels full, calm and still (html[data-motion], utils/motion.ts), with the world off (html[data-world=off], WebGL missing or failing, Save-Data), without JavaScript (server HTML, noscript styles, failsafe), on lite devices (liteQuery: sd hulls, fewer particles, no shadows), with storage blocked, for crawlers, and during the boot screen.' },
  { key: 'integration', text: 'CROSS-LANE INTEGRATION. The lanes were built in parallel and merged: check every producer/consumer pair across lanes is actually connected and consistent: worldStore fields (targetHover values written by pages vs read by stations, readingRects/data-reading vs ReadingGuard, clearRight/worldWindow vs camera, heroRole vs glyph ring, screenRect/projectShot/screenShown, charge vs sound, intent, autopilotPath vs course line and radar, edge, tipBox/setTipTarget, commsFocus/composing), events (showcase, cues with CueDetail.at, world:scan, world:project, onChrome), split items whose halves live in different lanes (B6, B15, C8, C9, FX04, FX21, FX29, FX30, G3, A1, A16, E5/G2, B21, F3, F7), duplicated or conflicting logic introduced by two lanes, and dead code left behind by merges.' },
]

const QA = [
  { key: 'desktop', port: 3401, text: 'DESKTOP FUNCTIONAL AND VISUAL QA at 1440x900 and 1024x768, dark and light themes, world on (WebGL flags). Cover every route (/, /about, /experience, /projects, /skills, /contact, /projects/drive-king, a 404), flights between station pairs (all from /, plus at least 8 other ordered pairs), the tour start to finish (pause/play, arrow keys, the final card), free roam (look, thrust, boost, autopilot to a station and a signal, docking, signals found, scan with F, the sector edge), the project modal (open from a screen and from View details, gallery, close) and project pages (prev/next), the command palette (pages, motion commands, hail), the theme switch, the hail button and the footer console. Take screenshots at key moments and look at them. Report console errors, page errors, WebGL warnings, black or NaN frames, overlapping or unreadable labels and text, broken layouts, controls that do nothing, and anything that contradicts the plan\'s described behaviour.' },
  { key: 'phone', port: 3402, text: 'PHONE AND TOUCH QA at 390x844 and 844x390 (isMobile, hasTouch, deviceScaleFactor 2), dark and light. Cover every route, the [data-world-window] spacers and how the station frames in them, the mobile menu (numbers, prefetch, the world pausing), the projects ride with touch swipes (one swipe advances one project, the first swipe docks), the short-landscape projects layout (View details reachable), the modal on narrow screens, the tour on a phone (radar hidden, captions touch-aware), free roam touch controls (Scan button), tap targets of at least 44px on coarse pointers, back-to-top, and horizontal overflow. Screenshot and inspect. Report concrete defects.' },
  { key: 'degrade-a11y', port: 3403, text: 'DEGRADATION, ACCESSIBILITY AND CONTRAST QA. (1) Motion levels via localStorage motion = full / calm / still: html[data-motion] set before paint, flights vs snaps and the D10 cut, ambient motion running at calm and frozen at still, CSS entrance animations only at full, no streaks/shake at calm. (2) World off (localStorage world=off and a stubbed getContext): fallback renders incl. /skills and project pages, the star backdrop, "Turn on 3D" label, the projects ride with screenshots. (3) No JavaScript (javaScriptEnabled false): every route readable, nothing stuck at opacity 0. (4) axe-core on every route in both themes (see tests/e2e/a11y.spec.ts for how). (5) Keyboard: skip link focuses main, Free roam within the first 15 tab stops, Esc from free roam restores focus, tour keys, palette focus after navigation, skills roving tabindex. (6) Contrast: for every [data-reading] block on every route in both themes with the world on, screenshot and pixel-sample the background behind the text against the computed text colour; report blocks whose 10th-percentile contrast is under 4.5:1 (3:1 for large). Report concrete defects with measurements.' },
  { key: 'perf', port: 3404, text: 'PERF MECHANISMS VERSUS BASELINE. Build a baseline: `git -C /home/user/portfolio-next worktree add /home/user/wt/base ' + 'ceb02b8' + '` (skip if it exists), `cp -al /home/user/portfolio-next/node_modules /home/user/wt/base/node_modules`, `cp /home/user/portfolio-next/.env /home/user/wt/base/`, build it there with the build lock, serve it on port 3399 while the integration build serves on your port. Compare, with the world on at 1440x900 and 390x844, per settled route: draw calls, triangles, textures and programs (the stats overlay Alt+Shift+S / StatsProbe, or wrap WebGL2RenderingContext methods in an init script to count drawArrays/drawElements* per frame, linkProgram and texImage calls). Check that no linkProgram/compile happens after warm-up on first visits and first flights to each station, on a theme switch, when free roam starts, when the modal opens, and when the tour starts (each new shader must compile during warm-up). Check rAF/frame activity when idle at motion still, when the mobile menu is open, and the quality tier over 60s idle (relative to baseline; SwiftShader is slow for both). Report regressions: settled draw calls more than +5 over baseline, programs linked after warm-up, idle loops, tier collapses that baseline does not show. Kill both servers and remove the base worktree when done (`git worktree remove --force /home/user/wt/base`).' },
]

// ---------- prompts ----------
function lanePrompt(lane, mergedNow, resume) {
  const others = LANES.filter(l => l.key !== lane.key && !mergedNow.includes(l.key)).map(l => l.name)
  return `Your lane: **${lane.name}: ${lane.title}**. Worktree \`/home/user/wt/${lane.key}\`, branch \`claude/wi-${lane.key}\`, port **${lane.port}**, report \`/home/user/wi/reports/${lane.key}.md\`, scratch dir \`/home/user/wi/scratch/${lane.key}/\`.

First read \`/home/user/wi/lane-brief.md\` (environment, rules, start and end steps) and follow it exactly. Then read, in your worktree, the plan \`${PLAN}\` (Global Constraints, Interface contract, and the "${lane.name}" section) and the AGENTS.md paragraphs for every subsystem you touch. Implement every item of your lane in plan order (${lane.items}), verifying and committing each.
${lane.note ? '\nLane note: ' + lane.note + '\n' : ''}
Lanes already merged into the integration branch (in your tree once you fast-forward): ${mergedNow.length ? LANES.filter(l => mergedNow.includes(l.key)).map(l => l.name).join(', ') : 'none yet'}. Lanes not merged yet (their halves of shared items are not in your tree; leave clean seams and note them as follow-ups): ${others.join(', ') || 'none'}.
${resume ? '\nRESUME: an earlier attempt at this lane stopped without returning. Inspect the worktree (git log, git status) and the report file, keep sound committed work, finish or discard half-done uncommitted edits, and continue with the remaining items. baseCommit is the integration commit the lane started from (the first commit before the lane\'s own commits).\n' : ''}
Return the structured result: baseCommit, headCommit, every item with status and commits and how you verified it, followups (exact changes needed in files your lane does not own), docNotes for AGENTS.md/CLAUDE.md, risks for reviewers, tests (what you ran and the results), verifyPassed.`
}

function laneReviewPrompt(lane, range, lens) {
  return `You are reviewing lane ${lane.name} (${lane.title}) of the world immersion pass. Plan: \`${PLAN}\` section "${lane.name}" (items: ${lane.items}); lane rules: /home/user/wi/lane-brief.md. Worktree: /home/user/wt/${lane.key}. Review the diff \`git -C /home/user/wt/${lane.key} diff ${range}\` (and \`git log ${range}\`), reading surrounding code as needed. The lane report is /home/user/wi/reports/${lane.key}.md.

READ-ONLY: do not edit, commit, build, or start servers. You may run \`npm run typecheck\`/\`npm run lint\` in the worktree and throwaway node scripts under /home/user/wi/scratch/${lane.key}/review/.

Lens: ${lens.text}

Report only real, specific issues with a concrete failure scenario (inputs/state -> wrong result) and a file and line. Severity: blocker (breaks the site, a test, a documented rule, or an item's core effect), major (visible bug or rule breach on a realistic path), minor (small but real defect). No style nits the linters accept, no speculative "consider" items. An empty list is a fine answer.`
}

function verifyPrompt(f, dir, lens) {
  return `Adversarially check this code-review finding. Try to REFUTE it: read the actual code in ${dir}, trace a real caller or input path, check whether it is already handled elsewhere, whether the plan (\`${PLAN}\`), CLAUDE.md or AGENTS.md really require what it claims, and whether the failure can really happen. Default to refuted=true if you cannot establish the failure path concretely. READ-ONLY: do not edit files, commit, build or start servers (throwaway scripts under /home/user/wi/scratch/verify/ are fine).

Lens: ${lens}

Finding:
${JSON.stringify(f, null, 1)}

If it is real, say so (refuted=false) and give the best fix in betterFix when the suggested one is wrong or incomplete.`
}

function laneFixPrompt(lane, confirmed) {
  return `Apply these verified review findings to lane ${lane.name} in /home/user/wt/${lane.key} (branch claude/wi-${lane.key}). Follow /home/user/wi/lane-brief.md (file ownership, commit format, verification, build lock, port ${lane.port}). Record \`git rev-parse HEAD\` before your first change as startCommit.

For each finding: fix the root cause with the smallest sound change; implement plan items the review found missing; if on close inspection a finding is not a real problem, mark it no_change_needed and say why. Run typecheck and lint before each commit, then \`npm run verify\`, a build, and the e2e specs your changes touch. Commit with plain-English titles about the visible effect (item IDs in brackets where relevant). Append a "Review fixes" section to /home/user/wi/reports/${lane.key}.md. Leave the worktree clean, no server running, no build lock held. Do not push.

Findings:
${JSON.stringify(confirmed, null, 1)}`
}

function mergePrompt(lane) {
  return `Merge lane ${lane.name} (branch \`claude/wi-${lane.key}\`) into the integration branch \`${BRANCH}\`, checked out at ${INTEGRATION}.

1. If a baseline e2e run is still going, wait for it: \`until ! pgrep -f "playwright test --reporter=line" >/dev/null; do sleep 15; done\`. Then make sure no stale \`next start -p 3100\` is left running (kill it if so).
2. The checkout must be clean apart from the locally excluded bun.lockb. If not, stop and report.
3. \`git -C ${INTEGRATION} merge --no-ff claude/wi-${lane.key}\` with the message "Merge lane ${lane.name}: ${lane.title}" plus the trailers. ${TRAILERS}
   On conflicts, read both sides and the plan items involved and resolve keeping both lanes' intents; never silently drop a lane's behaviour. Describe every conflict and its resolution in your result.
4. In ${INTEGRATION}: \`npm run typecheck && npm run lint\`, then a production build. ${LOCK} If the merge broke something, fix it in a separate commit (same trailers).
5. ${PUSH}
Never run npm install / npm ci. Return merged, mergeCommit, conflicts ('none' if none), checksPassed, pushed, notes.`
}

function integrationFixPrompt(title, items, extra) {
  return `${title}

Work in the integration checkout ${INTEGRATION} on branch \`${BRANCH}\` (all lanes are merged there). Read CLAUDE.md's rules and the plan \`${PLAN}\` Global Constraints first. ${ENV}
Record \`git rev-parse HEAD\` before your first change as startCommit. For each item: check it is still real in the current code; fix the root cause with the smallest sound change, or mark it no_change_needed with the reason. ${extra || ''}
Run typecheck and lint before each commit; at the end \`npm run verify\`, a production build (${LOCK}) and the e2e specs your changes touch (start \`npx next start -p 3410\` from ${INTEGRATION} in the background, point PLAYWRIGHT_BASE_URL at it, kill it after). Never loosen, skip or delete tests. Commit with plain-English titles about the visible effect. ${TRAILERS}
Then: ${PUSH}
Leave the checkout clean and no server running.

Items:
${JSON.stringify(items, null, 1)}`
}

function fullVerifyPrompt(stage) {
  return `Task 91 full verification (${stage}) of \`${BRANCH}\` at ${INTEGRATION}. ${ENV}
1. \`npm run verify\`, then a production build (${LOCK}).
2. Make sure nothing is listening on :3100, then run the full e2e suite (both projects): \`cd ${INTEGRATION} && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --reporter=line\` (it starts \`next start\` on :3100 itself). The pre-lane baseline results are in /tmp/claude-0/e2e.log; a test that also failed there may be environmental, but still investigate it.
3. For every failure find the root cause and fix the app. Never loosen, skip or delete a test; update a test only where the plan deliberately changed the behaviour it asserts, and say so. Re-run the failing specs until green, then the whole suite once more.
4. Commit fixes with plain-English titles. ${TRAILERS}
5. ${PUSH}
Return passed, failuresFixed, remainingFailures (with the reason each could not be fixed), headCommit, pushed, notes.`
}

function qaPrompt(q) {
  return `QA sweep "${q.key}" of the world immersion pass, integration branch at ${INTEGRATION} (all lanes merged and built; the plan is \`${PLAN}\`, lane reports are in /home/user/wi/reports/). ${ENV}
READ-ONLY for the repository: do not edit, commit or build in ${INTEGRATION}. Serve the existing build with \`cd ${INTEGRATION} && npx next start -p ${q.port}\` in the background (kill it when done) and drive it with your own Playwright scripts under /home/user/wi/scratch/qa-${q.key}/.

${q.text}

Report only concrete, reproduced defects (what you did, what happened, what should happen, the file most likely responsible if you can tell), with evidence (measurements, console text, screenshot paths). Severity: blocker / major / minor. Distinguish SwiftShader slowness from real bugs.`
}

function globalReviewPrompt(range, lens) {
  return `Code review of the world immersion pass on \`${BRANCH}\` at ${INTEGRATION}: review the diff \`git -C ${INTEGRATION} diff ${range}\` (use \`git diff --stat\` first, then go file by file; read surrounding code as needed). Plan: \`${PLAN}\`; lane reports: /home/user/wi/reports/*.md. READ-ONLY: no edits, commits, builds or servers (typecheck/lint and throwaway scripts under /home/user/wi/scratch/review/ are fine).

Lens: ${lens.text}

Report only real, specific issues with a concrete failure scenario (inputs/state -> wrong result), file and line. Severity: blocker / major / minor. No nits the linters accept, no speculative "consider" items. An empty list is a fine answer.`
}

// ---------- helpers ----------
async function verifyFinding(f, dir, phaseName, label) {
  const lenses = f.severity === 'minor' ? [VLENSES[0]] : VLENSES
  const votes = (await parallel(lenses.map((lz, i) => () =>
    agent(verifyPrompt(f, dir, lz), { label: `${label}:v${i + 1}`, phase: phaseName, schema: VERDICT })))).filter(Boolean)
  let refutes = votes.filter(v => v.refuted).length
  let confirms = votes.length - refutes
  if (lenses.length === 2 && refutes === 1 && confirms === 1) {
    const t = await agent(verifyPrompt(f, dir, VTIE), { label: `${label}:tie`, phase: phaseName, schema: VERDICT })
    if (t) { votes.push(t); if (t.refuted) refutes++; else confirms++ }
  }
  const real = votes.length === 0 ? true : confirms > refutes
  const fixHint = votes.filter(v => !v.refuted && v.betterFix).map(v => v.betterFix)[0]
  return { ...f, real, verifierNotes: votes.map(v => (v.refuted ? 'REFUTED: ' : 'CONFIRMED: ') + v.reasoning), betterFix: fixHint }
}

async function verifyAll(found, dir, phaseName, prefix) {
  const verdicts = await parallel(found.map((f, i) => () => verifyFinding(f, dir, phaseName, `${prefix}.${i + 1}`)))
  return verdicts.filter(Boolean)
}

let mergeChain = Promise.resolve()
function withMergeLock(fn) {
  const p = mergeChain.then(fn)
  mergeChain = p.catch(() => null)
  return p
}

const laneResults = {}
const laneLog = []

async function reviewLane(lane, res) {
  let range = `${res.baseCommit}..${res.headCommit}`
  let lenses = LANE_LENSES
  const fixes = []
  for (let round = 1; round <= 3; round++) {
    const found = (await parallel(lenses.map(lz => () =>
      agent(laneReviewPrompt(lane, range, lz), { label: `${lane.key}:review-${lz.key}-r${round}`, phase: 'Lane review', schema: FINDINGS }))))
      .filter(Boolean).flatMap(r => r.findings)
    if (!found.length) { log(`${lane.name}: review round ${round} found nothing`); break }
    const verdicts = await verifyAll(found, `/home/user/wt/${lane.key}`, 'Lane review', `${lane.key}:f${round}`)
    const confirmed = verdicts.filter(v => v.real)
    log(`${lane.name}: review round ${round}: ${found.length} findings, ${confirmed.length} confirmed`)
    if (!confirmed.length) break
    const fix = await agent(laneFixPrompt(lane, confirmed), { label: `${lane.key}:fix-r${round}`, phase: 'Lane review', schema: FIX, agentType: 'general-purpose' })
    if (!fix) break
    fixes.push({ round, confirmed: confirmed.length, fix })
    if (!fix.headCommit || fix.headCommit === fix.startCommit) break
    range = `${fix.startCommit}..${fix.headCommit}`
    lenses = LANE_LENSES.filter(l => l.key !== 'plan')
  }
  return fixes
}

const doneSet = new Set()
const mergedOrder = []
let inProgress = 0

async function runLane(lane) {
  const mergedNow = mergedOrder.slice()
  let res = await agent(lanePrompt(lane, mergedNow, false), { label: `${lane.key}:implement`, phase: 'Lanes', schema: LANE_SCHEMA, agentType: 'general-purpose' })
  if (!res) {
    log(`${lane.name}: implementation agent did not return; resuming once`)
    res = await agent(lanePrompt(lane, mergedNow, true), { label: `${lane.key}:implement-resume`, phase: 'Lanes', schema: LANE_SCHEMA, agentType: 'general-purpose' })
  }
  if (!res) { log(`${lane.name}: FAILED to implement; not merged`); return { lane: lane.key, failed: 'implement' } }
  const counts = res.items.reduce((a, it) => { a[it.status] = (a[it.status] || 0) + 1; return a }, {})
  log(`${lane.name}: implemented (${JSON.stringify(counts)}); reviewing`)
  const fixes = await reviewLane(lane, res)
  const merge = await withMergeLock(() =>
    agent(mergePrompt(lane), { label: `${lane.key}:merge`, phase: 'Merge', schema: MERGE, agentType: 'general-purpose' }))
  if (merge && merge.merged) { mergedOrder.push(lane.key); log(`${lane.name}: merged (${merge.conflicts}); pushed=${merge.pushed}`) }
  else log(`${lane.name}: MERGE FAILED: ${merge ? merge.notes : 'agent died'}`)
  return { lane: lane.key, res, fixes, merge }
}

// ---------- Wave 1: dependency-aware two-worker scheduler ----------
const queue = LANES.slice()
let waiters = []
function signal() { const w = waiters; waiters = []; w.forEach(r => r()) }
function waitSignal() { return new Promise(r => waiters.push(r)) }
function pickNext() {
  let i = queue.findIndex(l => l.deps.every(d => doneSet.has(d)))
  if (i < 0 && inProgress === 0 && queue.length) i = 0
  return i >= 0 ? queue.splice(i, 1)[0] : null
}
async function worker() {
  while (queue.length) {
    const lane = pickNext()
    if (!lane) { await waitSignal(); continue }
    inProgress++
    try { laneResults[lane.key] = await runLane(lane) } catch (e) { laneResults[lane.key] = { lane: lane.key, failed: String(e) } }
    inProgress--
    doneSet.add(lane.key)
    laneLog.push(lane.key)
    signal()
  }
  signal()
}
phase('Lanes')
log('Wave 1: 12 lanes, two at a time, each reviewed and merged as it finishes')
await Promise.all([worker(), worker()])

const failedLanes = Object.values(laneResults).filter(r => r.failed || !(r.merge && r.merge.merged)).map(r => r.lane)
log(`Wave 1 done. Merged: ${mergedOrder.join(', ')}. Not merged: ${failedLanes.join(', ') || 'none'}`)

// ---------- Task 90: cross-lane follow-ups ----------
phase('Integrate')
const followups = []
for (const r of Object.values(laneResults)) {
  if (r.res) r.res.followups.forEach(f => followups.push({ fromLane: r.lane, ...f }))
  if (r.fixes) r.fixes.forEach(x => (x.fix.followups || []).forEach(f => followups.push({ fromLane: r.lane, ...f })))
}
const joinChecks = 'Also check these known cross-lane joins are connected in the merged code, and fix any that are not: setTipTarget called wherever worldTip.set is called (A2); CueDetail.at passed by spawnPing/bump/cue emitters (F1); the world:scan F-key event (E3); clearRight and worldWindow consumed by the camera against the L12 markup (C9, C8); data-reading markup vs the ReadingGuard uniforms (G3); heroRole written by RoleRotator and read by the glyph ring (A16); targetHover values written by pages vs read by stations (B2, B4, B5, B15); projectFocus easing vs the runway (B15); screenRect, projectShot and screenShown (B8, B9); worldStore.charge vs sound voices (F3); autopilotPath vs the course line and radar (A1, E10); FX04 radar/names/camera halves; FX21 camera/tour halves; FX29 menu/readout; FX30 camera/optics/streak/tear halves.' + (failedLanes.length ? ` Lanes that failed or did not merge: ${failedLanes.join(', ')}; report what that leaves missing (do not implement whole lanes here).` : '')
const integ = await agent(integrationFixPrompt('Task 90: apply the cross-lane follow-ups the lanes reported.', followups, joinChecks),
  { label: 'integrate:followups', phase: 'Integrate', schema: FIX, agentType: 'general-purpose' })

// ---------- Task 91: full verification ----------
phase('Verify')
const verify1 = await agent(fullVerifyPrompt('after the merges and follow-ups'), { label: 'verify:full-1', phase: 'Verify', schema: VERIFY, agentType: 'general-purpose' })

// ---------- QA sweeps ----------
phase('QA')
const qaResults = await pipeline(QA,
  q => agent(qaPrompt(q), { label: `qa:${q.key}`, phase: 'QA', schema: FINDINGS, agentType: 'general-purpose' }),
  (r, q) => r && r.findings.length ? verifyAll(r.findings, INTEGRATION, 'QA', `qa:${q.key}`) : [])
const qaConfirmed = qaResults.filter(Boolean).flat().filter(v => v.real)
log(`QA: ${qaConfirmed.length} confirmed defects`)
let qaFix = null
if (qaConfirmed.length) {
  qaFix = await agent(integrationFixPrompt('Fix the defects the QA sweeps found and adversarial verification confirmed.', qaConfirmed,
    'Reproduce each defect first with a throwaway Playwright script where practical, and confirm the fix the same way.'),
    { label: 'qa:fix', phase: 'QA', schema: FIX, agentType: 'general-purpose' })
}

// ---------- Task 92: review of the full diff, loop until dry ----------
phase('Review')
let range = `${BASE}..HEAD`
let lenses = GLOBAL_LENSES
const reviewRounds = []
for (let round = 1; round <= 3; round++) {
  const raw = (await parallel(lenses.map(lz => () =>
    agent(globalReviewPrompt(range, lz), { label: `review:${lz.key}-r${round}`, phase: 'Review', schema: FINDINGS }))))
    .filter(Boolean).flatMap(r => r.findings)
  if (!raw.length) { reviewRounds.push({ round, found: 0 }); break }
  const deduped = raw.length > 1
    ? await agent(`Merge duplicate code-review findings (same root cause, even if worded differently or reported under different lenses). Keep every distinct issue; for duplicates keep the most precise file/line/detail and the highest severity, and combine their failure scenarios. Do not drop or invent findings.\n\n${JSON.stringify(raw, null, 1)}`,
        { label: `review:dedup-r${round}`, phase: 'Review', schema: DEDUP })
    : { findings: raw }
  const list = (deduped && deduped.findings.length) ? deduped.findings : raw
  const verdicts = await verifyAll(list, INTEGRATION, 'Review', `review:r${round}`)
  const confirmed = verdicts.filter(v => v.real)
  log(`Review round ${round}: ${raw.length} raw, ${list.length} distinct, ${confirmed.length} confirmed`)
  const entry = { round, found: list.length, confirmed: confirmed.length, fix: null }
  reviewRounds.push(entry)
  if (!confirmed.length) break
  const fix = await agent(integrationFixPrompt(`Task 92 review round ${round}: fix the confirmed review findings.`, confirmed),
    { label: `review:fix-r${round}`, phase: 'Review', schema: FIX, agentType: 'general-purpose' })
  entry.fix = fix
  if (!fix || !fix.headCommit || fix.headCommit === fix.startCommit) break
  range = `${fix.startCommit}..${fix.headCommit}`
  lenses = GLOBAL_LENSES.filter(l => ['correctness', 'warmup-perf', 'a11y', 'degrade'].includes(l.key))
}

// ---------- Final verification + Task 99 docs ----------
phase('Docs')
const verify2 = await agent(fullVerifyPrompt('final, after QA and review fixes'), { label: 'verify:full-final', phase: 'Docs', schema: VERIFY, agentType: 'general-purpose' })

const itemStatus = Object.values(laneResults).filter(r => r.res).map(r => ({ lane: r.lane, items: r.res.items.map(i => ({ id: i.id, status: i.status, note: i.note })) }))
const docNotes = Object.values(laneResults).flatMap(r => [
  ...(r.res ? r.res.docNotes : []),
  ...((r.fixes || []).flatMap(x => x.fix.docNotes || [])),
])
const docs = await agent(`Task 99: document the world immersion pass. Work in ${INTEGRATION} on \`${BRANCH}\`.

1. Update AGENTS.md (the exhaustive per-feature reference, recording why things are built as they are) and CLAUDE.md (the map; keep it concise) for every behaviour that changed: motion levels, new worldStore fields and events, new components and where they mount, the readability guard, the tour controls, the palette, the footer console, docking, signals and scan, the sector edge, the cockpit, the course line, the sound bus, spatial cues and haptics, the new e2e tests, and any new easy-to-break rules with the bug behind each. Use the doc notes below and the lane reports in /home/user/wi/reports/*.md, and check every statement against the code (no claims you have not verified). Follow the files' existing style and the copy rules (British spelling; no em-dashes in user-facing text).
2. In \`${PLAN}\`, tick the items that are done (- [x]) and annotate partial or skipped ones with a short reason.
3. \`npx prettier --write\` the changed files, \`npm run verify\`, commit ("Document the world immersion pass in AGENTS.md and CLAUDE.md" or similar plain-English title). ${TRAILERS}
4. ${PUSH}
Return a FIX-shaped result (results = one entry per document section you changed).

Item status by lane:
${JSON.stringify(itemStatus, null, 1)}

Doc notes:
${JSON.stringify(docNotes, null, 1)}`, { label: 'docs', phase: 'Docs', schema: FIX, agentType: 'general-purpose' })

return {
  merged: mergedOrder,
  failedLanes,
  lanes: Object.values(laneResults).map(r => ({
    lane: r.lane,
    failed: r.failed || null,
    items: r.res ? r.res.items.map(i => `${i.id}:${i.status}`) : [],
    risks: r.res ? r.res.risks : [],
    reviewRounds: (r.fixes || []).map(x => ({ round: x.round, confirmed: x.confirmed, fixed: x.fix.results.filter(y => y.outcome === 'fixed').length })),
    merge: r.merge ? { merged: r.merge.merged, conflicts: r.merge.conflicts, pushed: r.merge.pushed } : null,
  })),
  integration: integ ? { results: integ.results.length, fixed: integ.results.filter(y => y.outcome === 'fixed').length, verifyPassed: integ.verifyPassed } : null,
  verify1: verify1 ? { passed: verify1.passed, fixed: verify1.failuresFixed.length, remaining: verify1.remainingFailures } : null,
  qa: { confirmed: qaConfirmed.map(f => `${f.severity}: ${f.title}`), fix: qaFix ? qaFix.results.map(y => `${y.outcome}: ${y.title}`) : [] },
  review: reviewRounds.map(e => ({ round: e.round, found: e.found, confirmed: e.confirmed, fix: e.fix ? e.fix.results.map(y => `${y.outcome}: ${y.title}`) : [] })),
  verifyFinal: verify2 ? { passed: verify2.passed, remaining: verify2.remainingFailures, head: verify2.headCommit, pushed: verify2.pushed } : null,
  docs: docs ? { head: docs.headCommit, pushed: docs.pushed } : null,
}
