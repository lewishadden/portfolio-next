export const meta = {
  name: 'world-immersion-pass-mac',
  description: 'Resume the world-immersion pass on macOS: finish L1/L2 review, run the 8 remaining lanes with per-lane adversarial review, merge, then QA, review, fix and document',
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

const INTEGRATION = '/Users/lewis/Workspace/portfolio-next'
const WT = '/Users/lewis/Workspace/wi-worktrees'
const WI = '/Users/lewis/Workspace/wi'
const A = args || {}
const LIGHT = !!A.light
const WORKERS = A.workers || 4
const BASE = 'ceb02b8'
const BRANCH = 'claude/world-immersion-rpta9t'
const PLAN = 'docs/superpowers/plans/2026-10-09-world-immersion.md'
if (!A.trailers) throw new Error('Pass args.trailers: the commit trailer lines this session must use')
const TRAILERS = 'End every commit message (merge commits included) with exactly these lines after a blank line:\n' + A.trailers + '\nNever put a model name anywhere else (code, comments, docs).'
const PUSH = `Push with \`git -C ${INTEGRATION} push -u origin ${BRANCH}\`; only on network errors retry up to 4 times waiting 2s, 4s, 8s, 16s. Never force-push, never push any other branch, never open a pull request.`
const LOCK = 'Build lock (at most 3 builds on the machine): `until mkdir /tmp/wi-build-1 2>/dev/null && L=1 || { mkdir /tmp/wi-build-2 2>/dev/null && L=2; } || { mkdir /tmp/wi-build-3 2>/dev/null && L=3; }; do sleep 5; done; npm run build; rmdir /tmp/wi-build-$L` (always release the lock you took, on failure too).'
const ENV = 'Environment: macOS (Apple Silicon) shared with other agents. Drive the browser with your own headless Playwright scripts using Playwright\'s Chromium (installed once with `npx playwright install chromium`) and `--use-angle=metal` for real-GPU WebGL; never use the shared in-app browser. e2e: `PLAYWRIGHT_BASE_URL=http://localhost:<port> npx playwright test <spec> --reporter=line`. See tests/e2e/fixtures.ts for switching the world on/off and skipping the loading screen. Never run npm install / npm ci in a worktree. Put throwaway scripts under ' + WI + '/scratch/, never in the repo.'

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
  { key: 'perf', port: 3404, text: 'PERF MECHANISMS VERSUS BASELINE. Build a baseline: `git -C /Users/lewis/Workspace/portfolio-next worktree add /Users/lewis/Workspace/wi-worktrees/base ' + 'ceb02b8' + '` (skip if it exists), `cp -c -R /Users/lewis/Workspace/portfolio-next/node_modules /Users/lewis/Workspace/wi-worktrees/base/node_modules`, `cp /Users/lewis/Workspace/portfolio-next/.env /Users/lewis/Workspace/wi-worktrees/base/`, build it there with the build lock, serve it on port 3399 while the integration build serves on your port. Compare, with the world on at 1440x900 and 390x844, per settled route: draw calls, triangles, textures and programs (the stats overlay Alt+Shift+S / StatsProbe, or wrap WebGL2RenderingContext methods in an init script to count drawArrays/drawElements* per frame, linkProgram and texImage calls). Check that no linkProgram/compile happens after warm-up on first visits and first flights to each station, on a theme switch, when free roam starts, when the modal opens, and when the tour starts (each new shader must compile during warm-up). Check rAF/frame activity when idle at motion still, when the mobile menu is open, and the quality tier over 60s idle (relative to baseline; SwiftShader is slow for both). Also measure frame times on the M-series GPU: first-flight frames (target <=50ms), theme switch (<=50ms), idle 60fps, and the same at 390x844 with 4x CPU throttling (CDP Emulation.setCPUThrottlingRate). Report regressions: settled draw calls more than +5 over baseline, programs linked after warm-up, idle loops, tier collapses that baseline does not show, and frame-time targets missed. Kill both servers and remove the base worktree when done (`git worktree remove --force /Users/lewis/Workspace/wi-worktrees/base`).' },
]

// ---------- prompts ----------
function lanePrompt(lane, mergedNow, resume) {
  const others = LANES.filter(l => l.key !== lane.key && !mergedNow.includes(l.key)).map(l => l.name)
  return `Your lane: **${lane.name}: ${lane.title}**. Worktree \`${WT}/${lane.key}\`, branch \`claude/wi-${lane.key}\`, port **${lane.port}**, report \`${WI}/reports/${lane.key}.md\`, scratch dir \`${WI}/scratch/${lane.key}/\`.

First read \`${WI}/lane-brief.md\` (environment, rules, start and end steps) and follow it exactly. Then read, in your worktree, the plan \`${PLAN}\` (Global Constraints, Interface contract, and the "${lane.name}" section) and the AGENTS.md paragraphs for every subsystem you touch. Implement every item of your lane in plan order (${lane.items}), verifying and committing each.
${lane.note ? '\nLane note: ' + lane.note + '\n' : ''}
Lanes already merged into the integration branch (in your tree once you fast-forward): ${mergedNow.length ? LANES.filter(l => mergedNow.includes(l.key)).map(l => l.name).join(', ') : 'none yet'}. Lanes not merged yet (their halves of shared items are not in your tree; leave clean seams and note them as follow-ups): ${others.join(', ') || 'none'}.
${resume ? '\nRESUME: an earlier attempt at this lane stopped without returning. Inspect the worktree (git log, git status) and the report file, keep sound committed work, finish or discard half-done uncommitted edits, and continue with the remaining items. baseCommit is the integration commit the lane started from (the first commit before the lane\'s own commits).\n' : ''}
Commit trailers: ${TRAILERS}

Return the structured result: baseCommit, headCommit, every item with status and commits and how you verified it, followups (exact changes needed in files your lane does not own), docNotes for AGENTS.md/CLAUDE.md, risks for reviewers, tests (what you ran and the results), verifyPassed.`
}

function laneReviewPrompt(lane, range, lens) {
  return `You are reviewing lane ${lane.name} (${lane.title}) of the world immersion pass. Plan: \`${PLAN}\` section "${lane.name}" (items: ${lane.items}); lane rules: ${WI}/lane-brief.md. Worktree: ${WT}/${lane.key}. Review the diff \`git -C ${WT}/${lane.key} diff ${range}\` (and \`git log ${range}\`), reading surrounding code as needed. The lane report is ${WI}/reports/${lane.key}.md.

READ-ONLY: do not edit, commit, build, or start servers. You may run \`npm run typecheck\`/\`npm run lint\` in the worktree and throwaway node scripts under ${WI}/scratch/${lane.key}/review/.

Lens: ${lens.text}

Report only real, specific issues with a concrete failure scenario (inputs/state -> wrong result) and a file and line. Severity: blocker (breaks the site, a test, a documented rule, or an item's core effect), major (visible bug or rule breach on a realistic path), minor (small but real defect). No style nits the linters accept, no speculative "consider" items. An empty list is a fine answer.`
}

function verifyPrompt(f, dir, lens) {
  return `Adversarially check this code-review finding. Try to REFUTE it: read the actual code in ${dir}, trace a real caller or input path, check whether it is already handled elsewhere, whether the plan (\`${PLAN}\`), CLAUDE.md or AGENTS.md really require what it claims, and whether the failure can really happen. Default to refuted=true if you cannot establish the failure path concretely. READ-ONLY: do not edit files, commit, build or start servers (throwaway scripts under ${WI}/scratch/verify/ are fine).

Lens: ${lens}

Finding:
${JSON.stringify(f, null, 1)}

If it is real, say so (refuted=false) and give the best fix in betterFix when the suggested one is wrong or incomplete.`
}

function laneFixPrompt(lane, confirmed) {
  return `Apply these verified review findings to lane ${lane.name} in ${WT}/${lane.key} (branch claude/wi-${lane.key}). Follow ${WI}/lane-brief.md (file ownership, commit format, verification, build lock, port ${lane.port}). Record \`git rev-parse HEAD\` before your first change as startCommit.

For each finding: fix the root cause with the smallest sound change; implement plan items the review found missing; if on close inspection a finding is not a real problem, mark it no_change_needed and say why. Run typecheck and lint before each commit, then \`npm run verify\`, a build, and the e2e specs your changes touch. Commit with plain-English titles about the visible effect (item IDs in brackets where relevant). ${TRAILERS} Append a "Review fixes" section to ${WI}/reports/${lane.key}.md. Leave the worktree clean, no server running, no build lock held. Do not push.

Findings:
${JSON.stringify(confirmed, null, 1)}`
}

function mergePrompt(lane) {
  return `Merge lane ${lane.name} (branch \`claude/wi-${lane.key}\`) into the integration branch \`${BRANCH}\`, checked out at ${INTEGRATION}.

1. Make sure no stale \`next start -p 3100\` is left running in the integration checkout (kill it if so).
2. The checkout must be clean apart from an untracked bun.lockb (ignore it; never commit it). If not, stop and report.
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
2. Make sure nothing is listening on :3100, then run the full e2e suite (both projects): \`cd ${INTEGRATION} && npx playwright test --reporter=line\` (it starts \`next start\` on :3100 itself). Pre-lane baseline (cloud, SwiftShader): see ${WI}/handoff/baseline-e2e.md; a test that also failed there may be environmental, but still investigate it.
3. For every failure find the root cause and fix the app. Never loosen, skip or delete a test; update a test only where the plan deliberately changed the behaviour it asserts, and say so. Re-run the failing specs until green, then the whole suite once more.
4. Commit fixes with plain-English titles. ${TRAILERS}
5. ${PUSH}
Return passed, failuresFixed, remainingFailures (with the reason each could not be fixed), headCommit, pushed, notes.`
}

function qaPrompt(q) {
  return `QA sweep "${q.key}" of the world immersion pass, integration branch at ${INTEGRATION} (all lanes merged and built; the plan is \`${PLAN}\`, lane reports are in ${WI}/reports/). ${ENV}
READ-ONLY for the repository: do not edit, commit or build in ${INTEGRATION}. Serve the existing build with \`cd ${INTEGRATION} && npx next start -p ${q.port}\` in the background (kill it when done) and drive it with your own Playwright scripts under ${WI}/scratch/qa-${q.key}/.

${q.text}

Report only concrete, reproduced defects (what you did, what happened, what should happen, the file most likely responsible if you can tell), with evidence (measurements, console text, screenshot paths). Severity: blocker / major / minor. Distinguish SwiftShader slowness from real bugs.`
}

function globalReviewPrompt(range, lens) {
  return `Code review of the world immersion pass on \`${BRANCH}\` at ${INTEGRATION}: review the diff \`git -C ${INTEGRATION} diff ${range}\` (use \`git diff --stat\` first, then go file by file; read surrounding code as needed). Plan: \`${PLAN}\`; lane reports: ${WI}/reports/*.md. READ-ONLY: no edits, commits, builds or servers (typecheck/lint and throwaway scripts under ${WI}/scratch/review/ are fine).

Lens: ${lens.text}

Report only real, specific issues with a concrete failure scenario (inputs/state -> wrong result), file and line. Severity: blocker / major / minor. No nits the linters accept, no speculative "consider" items. An empty list is a fine answer.`
}

// ---------- helpers ----------
async function verifyFinding(f, dir, phaseName, label) {
  const lenses = (LIGHT || f.severity === 'minor') ? [VLENSES[0]] : VLENSES
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

async function reviewLane(lane, res, resume) {
  let range = resume && resume.range ? resume.range : `${res.baseCommit}..${res.headCommit}`
  let lenses = resume && resume.round > 1 ? LANE_LENSES.filter(l => l.key !== 'plan') : LANE_LENSES
  const startRound = resume && resume.round ? resume.round : 1
  const fixes = resume && resume.fixes ? resume.fixes.slice() : []
  for (let round = startRound; round <= (LIGHT ? 2 : 3); round++) {
    const found = (await parallel(lenses.map(lz => () =>
      agent(laneReviewPrompt(lane, range, lz), { label: `${lane.key}:review-${lz.key}-r${round}`, phase: 'Lane review', schema: FINDINGS }))))
      .filter(Boolean).flatMap(r => r.findings)
    if (!found.length) { log(`${lane.name}: review round ${round} found nothing`); break }
    const verdicts = await verifyAll(found, `${WT}/${lane.key}`, 'Lane review', `${lane.key}:f${round}`)
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

const PRIOR = {
 "l12": {
  "res": {
   "baseCommit": "ceb02b8ae43ec52f5ede8d5cc3a0f0eb82489b90",
   "headCommit": "9bb67313acc0446c4986fb2521639f6f5f365da2",
   "items": [
    {
     "id": "C9",
     "status": "done",
     "commits": [
      "1e381f6"
     ],
     "verification": "World-on SwiftShader screenshots at 1440x900 and 1100x800 in both themes. Stats, explore and recs are capped at min(46rem, 58vw), as 2x2 grids where they are grids. Contact is one capped column: intro, channels, form, map. .page-nav is left-aligned. About's grid is min(54rem, 58vw) with the name tag under the photo and highlights one per row under a 30rem bio column (container query). At 1440 the bio ends at about 68% of the width, leaving the right side to the station. Full non-WebGL suite passes (91).",
     "note": "About's wide layout was refined after the first visual check (narrower cap, tag under the photo) and folded into this commit."
    },
    {
     "id": "B6",
     "status": "done",
     "commits": [
      "68df282"
     ],
     "verification": "/skills at 1440 shows one column of cards at min(48rem, 58vw) with 5 tiles per row (4 at 1100), constellation clear on the right. Skills ticker specs pass."
    },
    {
     "id": "C8",
     "status": "done",
     "commits": [
      "febb7f4"
     ],
     "verification": "New WorldWindow spacers on home, About and Contact. At 390x844 with the world on they are display:block and 270px tall, and worldStore.worldWindow is set. They are display:none with the world off, without JS and on wide layouts. no-js spec passes.",
     "note": "The home spacer sits in app/page.tsx, which no lane owns; only the import and one JSX line changed."
    },
    {
     "id": "G3",
     "status": "done",
     "commits": [
      "5014ec7"
     ],
     "verification": "Read worldStore.readingRects, readingLarge and readingCount in the browser through a temporary debug hook that was not committed. Hero, page heads, About bio, recs, contact intro and explore head are measured, with large set on headings. Page-head, explore, contact-intro and recs-title lines now shrink to their text so the boxes are tight; the explore heading used to measure the full page width."
    },
    {
     "id": "B2",
     "status": "done",
     "commits": [
      "22885f5"
     ],
     "verification": "With the world on, hovering or focusing a contact card sets targetHover to contact:Phone or contact:Email, hovering the map sets globe:home, and leaving clears it."
    },
    {
     "id": "A16",
     "status": "done",
     "commits": [
      "726e41d"
     ],
     "verification": "Sampled 375 frames at full motion: heroRole matched the DOM's decoding text in 373, including 84 scrambled frames. At still it holds the final title, and a client navigation away from home sets it back to ''.",
     "note": "Reporting moved from an effect on displayed state (one frame behind the DOM) to the decode's own animation frame; this fix is folded into the commit."
    },
    {
     "id": "FX18",
     "status": "done",
     "commits": [
      "ff40706"
     ],
     "verification": "New test in tests/e2e/home.spec.ts: the Key stats aria snapshot has no '0+' after hydration and does not change during the count. At calm and still the digits show the real value immediately. Passes."
    },
    {
     "id": "FX19",
     "status": "done",
     "commits": [
      "d069b13"
     ],
     "verification": "New test in home.spec.ts: at 375px the CTA's top does not move over 14s. Measured title heights at 375 were 26/26/51/26 with the stack at 51. The phone screenshot shows the caret following the decoding text. Passes."
    },
    {
     "id": "FX32",
     "status": "done",
     "commits": [
      "d69f96d"
     ],
     "verification": "A mouse at full motion pulls the button (translate 8px, 5.7px). A mouse at calm and a touch tap both leave no transform. The plain magnet class now matches, so the full-width hero buttons at 640px and below apply (screenshot)."
    },
    {
     "id": "FX33",
     "status": "done",
     "commits": [
      "95d0c0d"
     ],
     "verification": "Hovering at 1440 with the world on: the card is preserve-3d and tilted, the icon's matrix3d carries z 30, and the inner glass keeps backdrop-filter blur(14px), confirmed in a screenshot. The spotlight ::before opacity is 1. StatsStrip's dead preserve-3d is removed.",
     "note": "Verified in Chromium only."
    },
    {
     "id": "FX36",
     "status": "done",
     "commits": [
      "9bb6731"
     ],
     "verification": "New test in skills.spec.ts: one tab stop per category, Tab and Shift+Tab move between categories, arrows, Home and End move between tiles, and the description reads 'Proficiency N%'. With the world on, focusing a tile sets targetHover to skill:Next.js and skillHover to Next.js. a11y spec (axe) passes."
    }
   ],
   "followups": [
    {
     "file": "components/About/About.tsx",
     "change": "Add data-world-section=\"bio\" to <div className=\"about__grid\">, and give companions.about in stations.ts two poses: bio, then recommendations.",
     "why": "L1 FX02 and C9 need the about station to swing clear before the bio's reading line, but About's only [data-world-section] is the recommendations. I left it out so L1's companion indexes don't shift under it while it is tuning."
    },
    {
     "file": "components/About/About.tsx",
     "change": "L4 B4: add data-world-target=\"about:portrait\" to <div className=\"about__frame\" ref={portraitRef}>. That line is unchanged in L12.",
     "why": "The visor portrait reacts to hovering the portrait frame. The name tag now sits under the photo inside the frame on wide layouts, which doesn't affect the target."
    },
    {
     "file": "components/World/stations/HomeStation.tsx",
     "change": "L4 A16 world half: build the glyph atlas from scrambleGlyphs, newly exported from components/Motion/ScrambleText.tsx (ASCII only: !<>_\\[]{}=+*^?#01), plus the title letters. Read worldStore.heroRole: '' off home, the final title below full motion.",
     "why": "The glyph set changed in FX19 (no '-', '/' or Greek), and the atlas must cover every glyph the decode can show."
    },
    {
     "file": "components/World/stations/ContactStation.tsx",
     "change": "L5 B5: target ids are contact:Email, contact:Phone, contact:LinkedIn, contact:GitHub (contactInfo.items[].name) and globe:home (LocationMap figure).",
     "why": "These are the ids the B2 markup now emits."
    },
    {
     "file": "components/World/stations.ts",
     "change": "L1 C9 and C8: retune companions for home, about and contact against the left-column layout. At 1440x900 the about bio spans about x 0.30 to 0.68, clearRight reads 0.217 at the recs and 0.24 on /skills, and phone windows are clamp(11rem, 32svh, 18rem).",
     "why": "The camera half consumes clearRight and worldWindow, which only now have real layout behind them."
    }
   ],
   "docNotes": [
    "Wide layouts (min-width: 900px and min-aspect-ratio: 11/10) keep page copy on the left so the station has the right side. Caps: stats, explore, recs and the contact column at min(46rem, 58vw); the skills grid at min(48rem, 58vw), one card per row with --span neutralised; the About grid at min(54rem, 58vw), with the name tag under the photo and a container query that puts highlights one per row under a 30rem bio column. .page-nav aligns left. Contact is one column at every width: intro, channels, form, map. New page content should keep within these caps.",
    "components/WorldWindow ([data-world-window]) is an aria-hidden spacer on home (between stats and explore), About (before the recommendations) and Contact (between channels and form). It shows only on narrow layouts under html[data-world-expected]:not([data-world='off']), at clamp(11rem, 32svh, 18rem). Otherwise it is display:none, which pageInputs skips.",
    "[data-reading] marks text over the world: the hero's meta, greeting, role, tagline and HUD; each page head's eyebrow, title and sub; the About bio; the recs title and quote; the contact intro; the explore head. data-reading=\"large\" goes on headings only. Keep each box tight to its text (justify-items: start on its grid parent), because the guard dims everything behind the box and a stretched heading measured the whole page width.",
    "data-world-target gains contact:<name> on contact cards and globe:home on the LocationMap.",
    "ScrambleText.onFrame(shown) reports the text on mount, then each decode frame from the decode's own animation frame; an effect on the displayed state lagged the DOM by a frame. scrambleGlyphs is exported and ASCII only, because '-' and '/' let a decoding word break across lines and the Greek letters fell back to a wider font.",
    "RoleRotator stacks every title in one inline-grid cell, inactive ones visibility:hidden, with the caret inside each title. The row keeps the tallest title's height, so nothing below it jumps on phones. It writes worldStore.heroRole and clears it on unmount.",
    "useCountUp counts at full motion only and returns the real number until its count starts, never 0; it used to put '0+' in the DOM and the accessibility tree from hydration. StatsStrip marks the digits aria-hidden and gives the value in an sr-only span. Update the Custom Hooks entry in AGENTS.md.",
    "Magnet uses pointer events, pulls only for pointerType mouse on a (hover: hover) and (pointer: fine) device at full motion, and adds the plain magnet class. Touch's emulated mouse events used to leave tapped buttons pulled off centre, and the .magnet page styles never matched before (the phone hero buttons are now full width).",
    "Explore cards paint glass and spotlight on an inner .explore__glass layer, and the card is preserve-3d so the icon's translateZ lifts. Never put backdrop-filter, overflow:hidden, isolation or filter on an element that must keep 3D children: they flatten it.",
    "Skill tiles are a roving-tabindex group per category: one tab stop; arrows, Home and End; up and down go to the nearest tile in the next row. The level is the tile's aria-describedby, an sr-only 'Proficiency N%' beside the tile. :focus-visible gets the hover styles, and focusin lights the badge through useTargetHover.",
    "Testing gotcha: at calm and still the global reduced-motion rule sets transition-duration 0.01ms !important but leaves transition-property all. Any computed style change, layout properties included, transitions and settles only on the next rendered frame. With the world on at still, scripts that inject CSS can read stale computed values, so inject 'transition: none' with it."
   ],
   "risks": [
    "FX33 was verified only in Chromium (blur kept, icon lifts). Safari has had bugs with backdrop-filter inside preserve-3d contexts; the plan's fallback is to drop the translateZ instead.",
    "The wide-layout caps apply whatever the world's state, as the experience timeline's already did. With the world off or without JS, the right ~40% below the page head is empty; L2's N7 backdrop helps.",
    "About on wide layouts is a visible design change: smaller photo, name tag under it instead of over it, and highlights one per row at about 1100px.",
    ".page-head { justify-items: start } affects every page head's children, including the Projects and ProjectPage children owned by L3. They shrink to their content; the projects spec passes and visual checks look the same.",
    "Contact markup changed: the aside wrapper is removed, and the map moves below the form at every width.",
    "On phones a one-line role title leaves an empty second line, because the row keeps the tallest title's height. This is intended.",
    "Skill tiles are focusable generic divs with no role; screen readers read their content plus the description. Axe is clean.",
    "Lane history was rewritten locally (never pushed) to keep one commit per item; only the final hashes are valid."
   ],
   "tests": "[\"npm run verify: passed.\", \"Final npm run build: passed. It was the third build, run behind the shared lock.\", \"Full non-WebGL suite (npx playwright test --project=chromium) against :3312: 91 passed. This includes the new tests/e2e/home.spec.ts (FX18 stats a11y, calm/still values, FX19 role line at 375px over 14s) and the new skills.spec.ts roving-tabindex test, plus a11y (axe, both themes, every route), no-js, motion, contact, about, projects, world (non-webgl) and resilience.\", \"tests/e2e/world.spec.ts --project=chromium-webgl: 4 passed in 5.4 min. This ran on the previous build, whose code differed only by the temporary debug hook.\", \"Throwaway Playwright scripts in /home/user/wi/scratch/l12 checked heroRole sampling, targetHover for contact, globe and skill tiles, Magnet with mouse, calm and touch, world-window display across world on, off and no-JS, reading rects, the explore card hover in 3D, and screenshots at 1440, 1100 and 390.\"]",
   "verifyPassed": true
  },
  "fixes": [
   {
    "startCommit": "9bb67313acc0446c4986fb2521639f6f5f365da2",
    "headCommit": "ee6dd19e0e0db6457a241fc401b1c209e0373f63",
    "pushed": false,
    "verifyPassed": true,
    "tests": "npm run typecheck and npm run lint pass before each commit, and npm run verify passes. The build passes; it ran under the build lock, which was released. e2e ran in the chromium project against a build of these changes on :3312. skills, about, home, a11y and no-js: 37 passed. motion, space, resilience and header: 18 passed. The roving-tabindex test in skills.spec.ts gained steps: it waits for the focused tile's lift, then checks that ArrowDown goes to index + columns, that ArrowUp comes back, and that ArrowDown on the last row stays put.",
    "results": [
     {
      "title": "FX33: the explore icon still doesn't lift, because its parent .explore__top flattens it",
      "outcome": "fixed",
      "commit": "f28808b",
      "note": "Added transform-style: preserve-3d to .explore__top in components/Explore/Explore.scss, with a comment. Checked on the built home page at 1440x900, full motion, hovering with a real mouse so the card tilts. The icon box with translateZ(30px) is 64.4x65.0 at (153.6, 296.8); without it, 62.3x62.8 at (160.2, 302.0). With the wrapper forced flat the two boxes are identical, which was the old behaviour. The glass and spotlight still paint behind the card content."
     },
     {
      "title": "FX36: ArrowDown on a skill tile moves sideways within the row, never to the row below",
      "outcome": "fixed",
      "commit": "59bcbe3",
      "note": "tileFor in components/Skills/Skills.tsx now works out rows from the layout offsets of the tiles' li cells (offsetTop, offsetLeft, offsetWidth). Those ignore the focus-visible lift, RevealItem's entrance offset and the card tilt. Tiles count as one row when within half a tile's height. On the real page, the old logic sent ArrowDown from tile 2 to tile 1; the new code sends it to tile 7, and still does with the card tilted. Swept 1440x900, 1280x720 and 390x844 at full, calm and still: up and down move one row in the same column, and down on the last row stays put. The skills.spec.ts roving test now checks this."
     },
     {
      "title": "ArrowDown in a skills category moves focus sideways, not to the row below (FX36)",
      "outcome": "fixed",
      "commit": "59bcbe3",
      "note": "Duplicate of the previous finding; the same commit fixes it."
     },
     {
      "title": "About portrait's `sizes` still says 460px after C9 shrank it to about 250px on wide layouts",
      "outcome": "fixed",
      "commit": "ee6dd19",
      "note": "sizes is now a portraitSizes constant in About.tsx. The wide-layout block in About.scss comments that it must change with it. The entries are: (min-width: 1490px) and (min-aspect-ratio: 11/10) 236px; (min-width: 901px) and (min-aspect-ratio: 11/10) calc(17.5vw - 22px); (min-width: 508px) 460px; calc(100vw - 48px). It uses 901px because the max-width: 900px block wins at exactly 900px (measured). It avoids min() inside sizes. The 508px entry also fixes the old overestimate between 508px and 900px. Probed at 23 viewports from 320px to 2560px: sizes resolves to 1.00-1.05 of the rendered width everywhere except the unchanged tall layouts 900px and wider. At 1440x900 the portrait now fetches w=640 at DPR 2 (was 828 or 1080) and w=256 at DPR 1 (was 640). The preload carries the new imagesizes."
     },
     {
      "title": "FX33: the explore icon still doesn't lift, because the `.explore__top` wrapper between the card and the icon flattens 3D",
      "outcome": "fixed",
      "commit": "f28808b",
      "note": "Duplicate of the first FX33 finding; the same commit fixes it. The report's doc note is corrected in the Review fixes section."
     }
    ],
    "docNotes": [
     "Explore cards: the glass and spotlight paint on an inner .explore__glass layer. Both the card and .explore__top, the wrapper between the card and the icon, are preserve-3d, so the icon's translateZ lifts it as the card tilts. transform-style is not inherited: every element between a 3D context and the element that lifts must be preserve-3d, and one flat wrapper silently drops the translateZ. None of those elements may have backdrop-filter, overflow: hidden, isolation, filter or opacity below 1, because those flatten too. To check a lift, compare the element's bounding box against a no-translateZ override; its computed transform reads the same whether or not it is flattened.",
     "Skill tiles: ArrowUp and ArrowDown find rows from the tile cells' layout offsets (offsetTop/offsetLeft), never from getBoundingClientRect(). Screen rects include the focused tile's :focus-visible lift (translateY(-4px)), RevealItem's entrance offset and the card's pointer tilt, and the lift alone made ArrowDown move sideways within the row.",
     "About portrait: its sizes (portraitSizes in About.tsx) encodes the wide-layout widths from About.scss's (min-width: 900px) and (min-aspect-ratio: 11/10) block: about 17.5vw - 22px, capped at 236px from 1490px. It splits at 901px because the max-width: 900px block wins at exactly 900px. Change the two together."
    ],
    "followups": []
   }
  ],
  "merge": {
   "merged": true,
   "mergeCommit": "0cff7537492ff6c0471b8d8d754be5d19b73ea77",
   "conflicts": "none",
   "checksPassed": true,
   "pushed": true,
   "notes": "Lane L12 (claude/wi-l12) is merged into claude/world-immersion-rpta9t in /home/user/portfolio-next. The merge commit is 0cff753, with the message \"Merge lane L12 PAGE: page content\" and both trailers. The lane branched from the current integration HEAD (ceb02b8), so git merged it cleanly with no conflicts.\n\n- It brings in 14 lane commits across 27 files, including two new files: components/WorldWindow/WorldWindow.tsx and tests/e2e/home.spec.ts. The commits are tagged C9, B6, C8, G3, B2, A16, FX18, FX19, FX32, FX33 and FX36.\n- Before merging, no Playwright run was in progress and nothing was serving on port 3100. Another lane's `next start -p 3303` was running, so I left it alone. The checkout was clean apart from ignored files such as bun.lockb.\n- `npm run typecheck` and `npm run lint` (eslint and stylelint) both passed. I also ran `npm run prettier:check`, which passed too.\n- The production build passed under build lock 1, which I released afterwards. It generated all 50 static pages with no warnings or errors in the log.\n- No fix commit was needed.\n- The push went through on the first try (ceb02b8..0cff753) and the branch now tracks the remote. I didn't run the e2e suite."
  }
 },
 "l3": {
  "res": {
   "baseCommit": "ceb02b8ae43ec52f5ede8d5cc3a0f0eb82489b90",
   "headCommit": "d68cb25dea6c4f6b21b106653663a0e160824bf7",
   "items": [
    {
     "id": "FX25",
     "status": "done",
     "commits": [
      "5a7e275"
     ],
     "verification": "Helix screens are keyed by slug. Typecheck and lint pass."
    },
    {
     "id": "FX37",
     "status": "done",
     "commits": [
      "1479cff"
     ],
     "verification": "curl against the production server: /_next/image returns image/jpeg for Accept */* and image/webp for the new Accept. In the browser, all 35 /_next/image responses on /projects (world on) were image/webp. The value is one constant (imageAccept) in routes.ts, used by prefetch() for /_next/image only and by both decoder fetches."
    },
    {
     "id": "DV2",
     "status": "done",
     "commits": [
      "b630564"
     ],
     "verification": "next dev (StrictMode), flying Home to Projects in SwiftShader: the screens show their shots (screenshot), and each of the 16 working-copy URLs (w=640) was requested once. Sharp copies are requested twice by design (prefetch, then a decode served from cache)."
    },
    {
     "id": "PF4",
     "status": "done",
     "commits": [
      "9bf2662"
     ],
     "verification": "Isolated three r186 test in Chromium SwiftShader: an 800x2000 striped bitmap uploaded in 8 bands came back in the right positions and orientation, mipmaps were built (a high-bias sample blends), no GL error. In the app (prod, 1440x900), sharp full-page copies went up as 794x256 texSubImage2D bands, about 1ms each and 8.9ms at most under SwiftShader. The 34ms frame budget was checked by mechanism, as the brief allows: one band per queueUpload frame."
    },
    {
     "id": "FX39",
     "status": "partial",
     "commits": [
      "2b2173e",
      "4ca97d8"
     ],
     "verification": "Dev-only marks and measures (projects:mount, hull-fetch, station-ready, hull-shown, hull-revealed) plus a console summary. Dev: fetch -51 to 2026ms, shown 6520ms, scanned in 8220ms after mount. Prod with the marks forced on, 20 Mbps throttle: the 3.6MB GLB downloads in about 2s, then shows 12.9s later; that gap is compile and upload under software GL (no KHR_parallel_shader_compile). Mitigation: sharp-copy prefetches (about 1.8MB at 1920 wide, started for every screen at once) now wait for the hull, or 6s at most. The 8 to 19s delay did not reproduce here as such, hence partial."
    },
    {
     "id": "B9",
     "status": "done",
     "commits": [
      "ba4e5de"
     ],
     "verification": "Prod, world on: once the front screen had cycled, View details opened the gallery on slide 03 (from screenShown). The pin (gallery to screen) is checked by code; a screenshot could not show it because the screen sits behind the glass panel. Invalidation at still is wired via the world:project-shot event and onLanded."
    },
    {
     "id": "B8+PF3",
     "status": "done",
     "commits": [
      "5a053d6",
      "1240e75"
     ],
     "verification": "Prod, world on: opening sets pdm--flip and the stage carries a WAAPI animation whose first keyframe is the FLIP from screenRect. Closing sets pdm--closing and runs the reverse animation, restores the title and returns focus to the View details link. Scrim confirmed in a screenshot. The existing @webgl modal test passes. A dialog brought back while closing is handled."
    },
    {
     "id": "B14+FX22",
     "status": "done",
     "commits": [
      "ccd6120"
     ],
     "verification": "Screenshot shows the 'Ride to this project' tip on a non-front screen. The @webgl modal test passes. The e2e Escape test still sees the card focused. Ride-and-focus after closing works through AnimatePresence onExitComplete."
    },
    {
     "id": "B15 (page half)",
     "status": "done",
     "commits": [
      "6d96849"
     ],
     "verification": "data-world-project is on the index links and pager cards. The station lights the screen named by targetHover project:<i> and dims screens behind the heading (worldStore.copy) on project pages. Typecheck and lint pass. Connects to L1's camera half only through projectFocus."
    },
    {
     "id": "B10",
     "status": "done",
     "commits": [
      "6c73179"
     ],
     "verification": "World off, prod: sampled at 0.45 and 0.55 of a step (e.g. ride 0.145, head translateY(-5.8px), opacity 0.68). At rest, data-riding and both variables are removed."
    },
    {
     "id": "B12",
     "status": "done",
     "commits": [
      "f6ff11f"
     ],
     "verification": "World-on screenshots show arms and joints from the spine to every screen. Two instanced draws, not shadow casters, mounted inside Precompiled."
    },
    {
     "id": "B13",
     "status": "done",
     "commits": [
      "0b0fa08"
     ],
     "verification": "The shader compiles and renders with no errors in any run. Wipe, seam and power-up curve are checked by code. The flicker is limited to once a second, and uPower is 1 at still."
    },
    {
     "id": "FX13",
     "status": "done",
     "commits": [
      "e8d6e42",
      "a19ae2c",
      "a18b762"
     ],
     "verification": "New e2e test (world off): from the top, a 150px wheel docks, the next 150px advances one project, and -150px returns. The @webgl ride test was updated to the new rule and passes. An overshoot after a font layout shift (dock measured at 533px, settled at 505px) was traced, fixed and re-verified."
    },
    {
     "id": "FX14",
     "status": "done",
     "commits": [
      "586c5f7",
      "07ba424"
     ],
     "verification": "At 844x390, all 15 projects: View details is on screen and hit-testable, the summary is clamped to 2 lines, the index is one row, and back to top is hidden. With the world on, the 3D screen still sits top-centre behind the copy column: that needs the L1 stationFraming follow-up."
    },
    {
     "id": "FX23",
     "status": "done",
     "commits": [
      "d459bcc",
      "1240e75"
     ],
     "verification": "New e2e test: the modal sets 'Drive King | Projects | Lewis Hadden' and Escape restores the list's title. Also seen in the WebGL run."
    },
    {
     "id": "FX24",
     "status": "done",
     "commits": [
      "136c6fc",
      "07ba424",
      "d68cb25"
     ],
     "verification": "Prod, world off, every project at 375x667, 390x844, 844x390 and 1280x720: View details and the index are inside the viewport and View details is hit-testable. Index links are 44x44 on coarse pointers. Back to top is hidden while docked in the stacked layout."
    },
    {
     "id": "F4 (ride half)",
     "status": "done",
     "commits": [
      "2cd8fd8",
      "81ea27e"
     ],
     "verification": "Checked by code: emitCue('tick', { at: screen world position }) fires when the ride settles within 0.02 on a new screen, not on the first frame, and at every motion level. Not audible until L11 adds the recipe."
    }
   ],
   "followups": [
    {
     "file": "components/World/stations.ts",
     "change": "FX14: under (height <= 520 && width > height), frame the projects screen in the left half. Fit it to the left cell's height (.proj-hud__screen, about 34-322 x 92-316 px at 844x390) and shift look/pos along the camera's right axis so the screen's centre sits at about NDC x = -0.5.",
     "why": "The new short-landscape layout puts the copy on the right half. The current narrow framing centres the 3D screen at the top (about x 280-563, y 84-260), behind the title and summary, which hurts readability with the world on."
    },
    {
     "file": "components/World/stations/ProjectsStation.tsx (applied at merge, L8 API)",
     "change": "When L8's tipTarget.ts lands, the helix screen mesh's onPointerOver/onPointerOut should call setTipTarget for the hovered screen.",
     "why": "Task 90 notes station files need setTipTarget calls. L8's API isn't in this tree, so I couldn't add it."
    },
    {
     "file": "components/Sound/* (L11)",
     "change": "Add the 'tick' recipe. ProjectsStation emits 'tick' with CueDetail.at = the settled screen's world position.",
     "why": "F4 sound half."
    },
    {
     "file": "next.config.js (unowned, integration)",
     "change": "Set agentRules: false, or keep reverting AGENTS.md after next dev.",
     "why": "next dev (16.3.8) appends a nextjs-agent-rules block to AGENTS.md on every start. I reverted it and did not commit it."
    },
    {
     "file": "app/projects/page.tsx, app/projects/[slug]/page.tsx, utils/projectPaths.ts (unowned, already changed)",
     "change": "No action needed; review only. FX23 passes siteName from the server page, and projectTitle() lives in utils/projectPaths.ts instead of utils/seo.ts.",
     "why": "Any client import of utils/seo.ts pulls content.json (64KB) into the client bundle."
    }
   ],
   "docNotes": [
    "Projects ride snapping is directional. Once a gesture ends more than 60px from where the scroll last rested (24px for a downward swipe from the top), it goes to the nearest stop beyond its start, in its direction; smaller gestures return to the nearest stop. Picking the nearest stop beyond the start, not the first stop past where it stopped, keeps a ride or fling that lands slightly past a project (e.g. after a web-font layout shift) on that project.",
    "HUD copy rides with the camera: Projects writes --ride (settleFocus(focus) - round(focus)) and --hud-o (clamp(1 - |ride|*2.2, 0, 1)) on .projects__stage[data-riding]. Head, stack, summary and actions translate by var(--ride) * -2.5rem and fade, with no transition. Within 0.02 of a project the attribute and both variables are removed. Reduced motion keeps only the fade.",
    "The stage gets data-docked between the first and last stop; in the stacked layout this hides .back-to-top. On narrow layouts the index is one sideways-scrolling row kept centred on the current project, with 44px links on coarse pointers. Short landscape (max-height 520px): screen left, copy right, actions beside the title, 2-line summary. Short portrait phones (700px tall or less): 30svh screen cell and a 2-line summary.",
    "Helix screen clicks in page mode: on /projects the settled front screen opens the modal, and any other screen dispatches world:project (projectRideEvent in ride.ts, detail = index), which Projects answers with goTo. From other pages a screen opens the project page; in tour or free roam a click only pings. Tips read 'Open project' or 'Ride to this project'. Closing a modal for a project not in front rides there and focuses its View details link.",
    "The gallery writes worldStore.projectShot via showProjectShot, which also dispatches world:project-shot. Screens write worldStore.screenShown. Galleries open on screenSlide(project), and an open gallery pins its screen to the gallery's slide.",
    "Project modal FLIP: with the world on, full motion and the project's screen in front, the gallery stage flies out of worldStore.screenRect, which ProjectsStation writes each frame while projectFocus >= 0. It uses WAAPI in a layout effect so the first painted frame is already over the screen. The frame and copy fade in (.pdm--flip); close reverses via usePresence (.pdm--closing). No backdrop blurs (plain 80% scrim). The phone sheet sets setChrome({ modalCover: true }) while open. document.title shows the project while open.",
    "Image fetches send Accept: image/webp,image/*;q=0.8 (imageAccept in routes.ts): the image endpoint varies on Accept and returns JPEG for */*. decodeImage shares decodes that are already under way, so a shared bitmap must never be closed or transferred. ScreenShots is created per effect run: a disposed instance gives up its loads, and the old useMemo'd instance left screens blank under StrictMode.",
    "Sharp copies taller than 512 rows upload in 256-row bands through queueUpload (uploadBanded): a DataTexture with source.dataReady = false and declared mip levels lets three allocate the chain with texStorage2D, each band is a copyTextureToTexture call, and the last band builds the mipmaps. Sharp copies and their prefetches wait for the hub hull, or 6s at most. Dev-only performance marks are named projects:*.",
    "ScreenArms: two InstancedMeshes in the truss material, not shadow casters (an instanced depth variant would compile on the first shadow pass rather than in warm-up). Screen shader: the next shot wipes down behind a seam (uSeam). uPower powers up the edge band on the curve from power.tsx, compressed so the surge peaks at 0.6s; it flickers at most once a second and is 1 at still. On project pages, screens behind the heading dim. data-world-project lights the named project's screen. The ride emits a 'tick' cue with the screen's position.",
    "CLAUDE.md: keep utils/seo.ts out of client code (it ships content.json); next dev rewrites AGENTS.md unless agentRules: false is set."
   ],
   "risks": [
    "PF4 depends on WebGL2 sub-rectangle uploads from ImageBitmap (copyTextureToTexture's image path) and on three r186's DataTexture path with declared mipmaps and dataReady = false. Recheck both after a three upgrade. Verified in isolation and in the app.",
    "B8 uses WAAPI on a plain div, not an m.div, so the first painted frame is already the FLIP start. The stage could be clipped by .pdm__body overflow when the screen rect falls outside the dialog body. usePresence makes AnimatePresence wait for safeToRemove; every close path calls it.",
    "FX13 changes the snap rule, so the existing @webgl ride test's '0.3 step glides back' step became '40px glides back, 0.3 step carries on' (commit a19ae2c). This is an intentional behaviour change from the plan, not a weakened test, but please confirm.",
    "FX39 is evidence plus a mitigation, not a proven root cause: real-GPU timings can't be measured in this environment.",
    "FX14 with the world on: until L1's framing follow-up lands, the 3D screen sits behind the right-hand copy in short landscape.",
    "Pre-existing stale hover: R3F only raycasts on pointer events, so a screen hovered before the camera rides keeps its tip until the pointer moves. With the tip swap, that tip now reads 'Ride to this project'.",
    "B13 power-up surges the edge light to 1.4x for about 0.3s (bloom). The arms can draw thin dark lines across the left copy area.",
    "Unowned files changed: app/projects/page.tsx (siteName prop), app/projects/[slug]/page.tsx and utils/projectPaths.ts (projectTitle). ride.ts gained DOM helpers and imports worldStore; it is still three-free.",
    "ProjectsStation.tsx grew substantially (arms, shader, banded uploads, pins, tips, power, ticks, instrumentation); it is worth a careful review."
   ],
   "tests": "\"Final prod build of HEAD d68cb25 on next start -p 3303. npm run verify passed and npm run build passed. Chromium project: projects.spec, no-js, a11y, seo, palette and motion specs, 63 passed. world.spec plus resilience.spec (chromium), 7 passed. chromium-webgl projects.spec, both @webgl tests passed. Two new tests: FX13 short-scroll ride (world off) and FX23 modal tab title. Throwaway Playwright scripts in /home/user/wi/scratch/l3 checked: FX37 content types; PF4 bands, both isolated and in-app; DV2 on next dev; FX39 timings; FX14/FX24 layouts for every project at 375x667, 390x844, 844x390 and 1280x720; the FX13 overshoot trace; B10 ride variables; WebGL screenshots for B8, B9, B12 and B14.\"",
   "verifyPassed": true
  },
  "fixes": [
   {
    "startCommit": "d68cb25dea6c4f6b21b106653663a0e160824bf7",
    "headCommit": "28fd7ec",
    "pushed": false,
    "verifyPassed": true,
    "tests": "Final build of HEAD 28fd7ec on next start -p 3303.\n- npm run verify: pass. Final npm run build: pass.\n- chromium project, specs projects, no-js, a11y, seo, palette, motion, world and resilience: 71 passed. This includes the new FX13 test \"a swipe onwards that catches a snap glide keeps going its way\".\n- The new FX13 test was also run against the old d68cb25 build, where it failed as expected (the ride went back to the first project). With the fix it passed 5 of 5 under --repeat-each=5.\n- chromium-webgl project, projects.spec.ts: 2 passed.\n- Layout checks: a Playwright script measured every project at 26 viewports, touch and fine pointer: short landscape, landscape tablets, desktop and stacked phone/tablet sizes. 0 problems.\n- World-on SwiftShader checks used probes that exist only in a temporary verification build:\n  - ticks come from the station with a position on /projects;\n  - no tick while the modal is open or after it closes, and none on a project-page Next project hop;\n  - a gallery opened 201ms into a fade starts on the incoming shot, with no wipe back.\n- World-off tick checks and the index-row sideways swipe check also passed.\n- A power-curve simulation at 60fps: the largest per-frame change is 0.032 and the curve never dips.",
    "results": [
     {
      "title": "Short-landscape layout (FX14) breaks on landscape viewports 900px or wider: HUD row collapses to 0px and the vertical index runs off-screen",
      "outcome": "fixed",
      "commit": "4065cc5",
      "note": "I added `(max-height: 520px) and (orientation: landscape)` to the stacked layout's query, so short landscape screens of any width get the one-row index, the -webkit-box summary clamp, the action alignment and the docked back-to-top hiding. The later short-landscape block still arranges the stage. Checked at 932x430 (touch and fine), 915x412, 1280x500, 960x470, 1093x514 and 1440x500: the HUD has real height, all 15 links are reachable, the summary is 2 lines and View details is hit-testable. 844x390 and 899x412 are unchanged."
     },
     {
      "title": "44px coarse-pointer index rows (FX24) overflow the desktop index column on landscape tablets and push View details below the viewport",
      "outcome": "fixed",
      "commit": "2cd3c42",
      "note": "In the desktop column, links on a coarse pointer now share out the stage's height, up to 44px each: `--tap-h` is computed from --stage-h and --steps. The stacked layouts set --tap-h to 44px. As a backstop the desktop stage gets `grid-template-rows: minmax(0, 1fr)`, reset to none in the stacked block. At 1133x680, 1024x700 and 1280x720 with touch, View details is now at the same place as with a fine pointer, and the links are 36-42px tall."
     },
     {
      "title": "Screen power-up without flicker ramps to full, then drops abruptly to 0.22 (a flash), which defeats the flickerGap protection",
      "outcome": "fixed",
      "commit": "6e9310b",
      "note": "The no-flicker path now swells smoothly from 1 to 1.4 by x=0.95 and then settles, so it has no dip at all. That also removes the 1-to-0.22 step at s=0. The flicker curve is unchanged."
     },
     {
      "title": "A gallery opened while its screen is mid-wipe starts on the outgoing shot, so the screen wipes forward and then back",
      "outcome": "fixed",
      "commit": "ceb8994",
      "note": "The screen writes screenShown[i] as soon as a fade starts, whether from its own cycle or from a pin. A working copy that lands mid-fade no longer overwrites that value. Verified with the world on: the gallery opened mid-fade on the incoming shot and the screen held it."
     },
     {
      "title": "Short-landscape layout (FX14) breaks on phones 900px or wider: the HUD collapses and the vertical index runs off-screen",
      "outcome": "fixed",
      "commit": "4065cc5",
      "note": "Duplicate of the first FX14 finding; the same fix covers it, and it also applies the summary clamp and alignment rules that the suggested scroller-only fix missed."
     },
     {
      "title": "44px index links on coarse pointers overflow the desktop-layout stage on landscape tablets and push View details off-screen",
      "outcome": "fixed",
      "commit": "2cd3c42",
      "note": "Duplicate of the earlier FX24 coarse-pointer finding, fixed by the same commit. The link count comes from --steps rather than a hard-coded 15, and the minmax(0, 1fr) row backstop is included."
     },
     {
      "title": "A screen's non-flicker power-up still blinks: uPower jumps from 1.0 to 0.22 a quarter-second in",
      "outcome": "fixed",
      "commit": "6e9310b",
      "note": "Duplicate of the earlier B13 finding, fixed by the same commit."
     },
     {
      "title": "The new sideways-scrolling index row is an inner scroller without a Lenis prevent attribute",
      "outcome": "fixed",
      "commit": "9c4f688",
      "note": "Added data-lenis-prevent-horizontal to the index <ol>. At 520x900, a sideways wheel scrolls the row (scrollLeft 0 to 45) and the page doesn't move."
     },
     {
      "title": "FX13: on touch, a forward swipe that interrupts a snap glide sends the ride back a project",
      "outcome": "fixed",
      "commit": "e093cd4",
      "note": "A Lenis 'virtual-scroll' listener moves the anchor to scrollY when a wheel or touch movement arrives during a snap glide. This covers both touch and wheel; the verifier showed wheel was affected too. The new e2e test fails on the old build and passes on the new one."
     },
     {
      "title": "B13: the 'no flicker' power-up jumps from full to 0.22 in one frame",
      "outcome": "fixed",
      "commit": "6e9310b",
      "note": "Duplicate of the earlier B13 finding, fixed by the same commit."
     },
     {
      "title": "F4 (ride half): the detent tick comes only from the 3D station, so it is missing with the world off and early on project pages",
      "outcome": "fixed",
      "commit": "28fd7ec",
      "note": "The station no longer ticks while a project is open: it records ticked = opened. With the world off, Projects emits 'tick' with no `at` when its ride settles on a new project. It skips its first update, so closing the modal doesn't tick. I did not add a tick to goTo's `lane.step < 10` branch, which has no runway and so no ride."
     }
    ],
    "followups": [
     {
      "file": "components/World/stations.ts",
      "change": "isWideViewport (line 42) and the projects framing should treat `height <= 520 && width > height` as short landscape at any width. The CSS now uses the short-landscape layout at 932x430 and 1280x500 too, with the screen cell in the left half, but the 3D screen still gets the wide, centred framing there.",
      "why": "FX14 now applies to short landscape screens 900px or wider. The camera framing (L1's file) must match it, or the 3D screen sits behind the right-hand copy. This extends the existing follow-up 1 in the L3 report."
     },
     {
      "file": "components/Sound/sound.ts",
      "change": "The 'tick' recipe (L11) must handle a cue with no `at`. The tick fires once for each project passed during a long ride (an index jump), up to about 6-7 a second, so keep it short and soft.",
      "why": "With the world off, Projects now emits 'tick' with no position, so the listener sits at the station. With the world on, the station still emits it with the screen's position."
     }
    ],
    "docNotes": [
     "Projects ride snapping measures each gesture from where it started. That is where the scroll last came to rest, or the point where a gesture caught a running snap glide (Lenis 'virtual-scroll' while gliding). The old anchor was the stop the glide was heading for, so a short swipe onwards read as one backwards.",
     "Detent ticks: the ProjectsStation ticks from the screen on the /projects ride only, never while a project is open (its page or its modal). With the world off, Projects emits 'tick' with no `at`. Both skip the first update.",
     "Screen power-up: within flickerGap of the last flicker, the edge light swells from 1 to 1.4 and settles. It never dims, because any drop counts as a flash.",
     "worldStore.screenShown is the shot a helix screen shows or is fading to. It is written when a fade starts, so a gallery opened mid-fade starts on the incoming shot.",
     "Projects.scss: the stacked layout's media query includes `(max-height: 520px) and (orientation: landscape)` at any width, and the short-landscape block builds on it. On coarse pointers, links in the desktop index column are `--tap-h` tall, which is the stage height shared out up to 44px. The desktop stage row is minmax(0, 1fr).",
     "Inner scrollers that scroll sideways get data-lenis-prevent-horizontal, as the projects index row does now. Plain data-lenis-prevent would hand vertical wheel input to native, unsmoothed scrolling."
    ]
   },
   {
    "startCommit": "28fd7ec484fc88d20a2a9e9390dbd168c8ff4aab",
    "headCommit": "a1fd5c4d0055e526e3f6e30e138128c28fb4baa2",
    "pushed": false,
    "verifyPassed": true,
    "tests": "npm run verify: pass. Final npm run build of HEAD: pass. I made one extra control build of 28fd7ec with the new tests, only to show they catch the bug: there the 30px catch test and the new index-ride test failed. Results against the HEAD build (next start -p 3303, world off unless noted):\n- chromium projects.spec.ts: 14 passed.\n- The \"ride without the world\" tests run 5 times each (--repeat-each=5): 20 passed.\n- chromium no-js, a11y and motion specs: 38 passed.\n- chromium-webgl projects.spec.ts (both @webgl helix tests): 2 passed.\nOther checks on the production build:\n- Throwaway frame-level sim and a browser probe for FX13.\n- Layout script for FX24 at 13 tablet and phone sizes, every project checked, plus a screenshot.\nScripts are in /home/user/wi/scratch/l3/fix2/.",
    "results": [
     {
      "title": "A short onward swipe that catches a snap glide still sends the ride back a project, and index or screen rides are not covered at all (FX13 fix e093cd4 is incomplete)",
      "outcome": "fixed",
      "commit": "544f442",
      "note": "The `gliding` flag is gone. Both of the ride's own scrolls now pass `userData: { rideTo }` to `lenis.scrollTo`: the snap glide and goTo's ride (index link, helix screen, after a modal closes). Lenis clears that when the scroll ends or something else takes it over.\n\nWhen a gesture catches one of these scrolls (`virtual-scroll` while Lenis is smooth scrolling), the anchor moves to the catch point. If the gesture goes the ride's way, it also notes where the ride was going (`heading`). At rest, a gesture that kept going that way is measured from that destination:\n- short of it: the ride goes there;\n- more than 60px past it: on to the next stop;\n- less than 60px past it: back to it.\n\nA gesture against the ride, or one that turns back, is measured from the catch point as before.\n\nI didn't use the review's \"skip the commit test, nearest stop beyond the catch\". In the sim, that rule sends a 10-59px nudge that catches a glide in its last frames on past the project the glide was arriving at.\n\nResults on the production build:\n- Onward catches of 70, 30 and 10px, 17px into a glide, all end on Sidenote. The control build sent 30px and 10px back to ZGS Carpentry.\n- An index ride from 01 to 07, caught 48px short by a 100px wheel back, ends on 06 (the control build ended on 07).\n\nIn the e2e tests, the catch test now runs for 70px and 30px. A new test covers a swipe back that catches an index ride in its tail."
     },
     {
      "title": "FX24's 44px touch targets are lost in the desktop index column on landscape tablets",
      "outcome": "fixed",
      "commit": "a1fd5c4",
      "note": "A new `@media (pointer: coarse)` block sits before the stacked block:\n- the stage's first column is `calc(88px + 0.25rem)`;\n- the index list is `repeat(2, 44px)` with a 0.25rem gap, row-major so the visual order matches DOM and focus order;\n- links are at least 44x44.\n\n`--tap-h` is removed everywhere. The stacked and short landscape layouts reset both grids as before, so they are unchanged.\n\nEight rows take about 363px, which fits the smallest desktop stage (about 412px).\n\nChecked on every project:\n- Touch at 1133x680, 1024x600, 1093x530, 1280x720, 1180x640 and 1366x950: links are 44x44 in two columns, all 15 can be hit, and View details is on screen and can be hit.\n- Unchanged: fine pointers, the phones, portrait tablets and short landscape sizes."
     }
    ],
    "followups": [],
    "docNotes": [
     "AGENTS.md, projects ride, snapping (replaces the round 1 note). A gesture is measured from where the scroll last rested, unless it catches one of the ride's own scrolls: a snap glide, or goTo's ride from an index link, a helix screen or a modal closing. Those scrolls carry their destination in Lenis `userData` (`rideTo`), which Lenis clears when they end or are taken over. A catching gesture is measured from the catch point. If it keeps going the ride's way, it is measured from where the ride was going instead: short of that, the ride goes there; more than 60px past it, on to the next stop. Bugs behind this:\n- measured from the glide's destination, a short swipe onwards read as a swipe back;\n- measured from the catch point alone, a short swipe fell under the 60px commit and went back;\n- index rides were never treated as caught, so a swipe in a ride's tail was measured from before the ride.\nAny new programmatic ride scroll on /projects should pass `userData: { rideTo }`.",
     "AGENTS.md, projects layouts (replaces the round 1 `--tap-h` note). On coarse pointers every index link is at least 44x44. In the desktop column they sit two to a row (stage column 88px + 0.25rem); the stacked and short landscape layouts keep a one-row index. Don't size links to fit the stage: 15 links at 44px in one column outgrow any stage under about 790px."
    ]
   },
   {
    "startCommit": "a1fd5c4d0055e526e3f6e30e138128c28fb4baa2",
    "headCommit": "252bb2ac4935809869fb2c3203eaf6733229336b",
    "pushed": false,
    "verifyPassed": true,
    "tests": "npm run verify passed and the production build passed (the build was of the tree committed as 252bb2a). Server: next start -p 3303. chromium, projects.spec.ts: 16 passed. The \"ride without the world\" tests with --repeat-each=5: 30 passed. chromium-webgl, projects.spec.ts: 2 passed. The new e2e test \"a ride the index sends after a swipe caught another ends where it was sent\" runs once going down and once going up. Against the previous build (a1fd5c4) it failed 3 of 3 for both directions, and it passes on the new build. Probe scripts are in /home/user/wi/scratch/l3/fix3/. probe.mjs compares the old and new builds: on the old build 01→07, wheel, 05 ended on 07; 15→01, wheel, 02 ended on 01; and 01→15, wheel, 13 ended on 15. On the new build they end on 05, 02 and 13, and the page never passes the project chosen. probe2.mjs checks that the FX13 catches still work: a wheel catch or a touch catch onwards still ends on the caught ride's destination, an ignored sideways catch ends on 07 (or on 05 when 05 is clicked next), and a touch catch followed by a click on 05 ends on 05.",
    "results": [
     {
      "title": "A caught ride's heading outlives that ride: a later index or helix-screen ride gets sent on to the old destination",
      "outcome": "fixed",
      "commit": "252bb2ac4935809869fb2c3203eaf6733229336b",
      "note": "In components/Projects/Projects.tsx, rest() (the Lenis 'scroll' listener) now clears `heading` whenever one of the ride's own scrolls is running: isScrolling === 'smooth' and userData.rideTo is a number. That covers a new goTo ride (from an index link, Enter, a helix screen) and a catch that Lenis ignored. Real catches keep their heading: a wheel catch replaces userData in the same call, and a touch catch turns the scroll native. The check is shared with interrupt through a small riding() arrow helper; a hoisted function declaration loses the `lenis` narrowing. press now clears `heading` only for mouse pointers, so a scrollbar drag leaves the page where it was dropped. I did not clear it on every pointerdown, as the review suggested, because a second touch swipe during the momentum would lose a heading it can no longer set again, which is the stop-short bug FX13 fixed. I added the down and up e2e cases. Their second click is an in-page .click() with no pointerdown, so they exercise the rest() path rather than the mouse press."
     }
    ],
    "docNotes": [
     "AGENTS.md, projects ride, snapping and catches (add to the round 2 note): a caught ride's heading is dropped as soon as one of the ride's own scrolls (one whose userData carries rideTo, while Lenis is 'smooth') is seen running. That is a later ride from the index, Enter or a helix screen, or the caught ride itself when Lenis ignored the gesture. A mouse press (a scrollbar drag) also drops it. A touch press does not, so a second swipe onwards during the momentum still counts from where the ride was going. The bug behind this: the heading lasted until the next settle, so a project picked from the index within about 1.4s of a swipe that caught a ride glided on to where the caught ride had been going."
    ],
    "followups": []
   }
  ],
  "merge": {
   "merged": true,
   "mergeCommit": "5c40f9971f5192aac1bd8ace84e93e68ce2b7c29",
   "conflicts": "none",
   "checksPassed": true,
   "pushed": true,
   "notes": "I merged claude/wi-l3 (34 commits) into claude/world-immersion-rpta9t at /home/user/portfolio-next with --no-ff. The merge commit is 5c40f99, with the message \"Merge lane L3 PRJ: projects\" and the two required trailers. Git merged it automatically and there were no conflicts. L3's 14 files (the Projects components, ProjectDetailsModal, ProjectBody/ProjectPage, the two app/projects pages, the world files ProjectsStation.tsx, ride.ts, routes.ts and imageDecoder.ts, utils/projectPaths.ts and tests/e2e/projects.spec.ts) don't overlap with any file changed on the integration branch since the merge base ceb02b8 (L12's page-content work). No fix-up commit was needed.\n\nChecks: typecheck, eslint and stylelint all passed, and so did prettier:check. The production build passed under lock /tmp/wi-build-1, which I released afterwards, and its log has no warnings or errors; all 15 project pages were generated. I did not run the e2e tests; the task didn't ask for them.\n\nPush: origin moved from 0cff753 to 5c40f99 on the first try and the branch tracks origin. Nothing else was pushed and no pull request was opened.\n\nStep 1 problem: the wait loop `until ! pgrep -f \"playwright test --reporter=line\"` never ends, because pgrep -f matches the waiting shell's own command line, which contains that text. No Playwright run was actually going, so I stopped the loop. A pattern that can't match itself, such as `pgrep -f \"[p]laywright test --reporter=line\"`, fixes this for the other lane merges. There was no `next start -p 3100` running, so nothing needed killing. One other server is running, `next start -p 3301` (PID 31570, probably another lane's), and I left it alone. The checkout was clean before the merge."
  }
 },
 "l1": {
  "res": {
   "baseCommit": "0cff7537492ff6c0471b8d8d754be5d19b73ea77",
   "headCommit": "c2626716359edd9a71fe178c450662db6a1949f7",
   "items": [
    {
     "id": "FX12",
     "status": "done",
     "commits": [
      "c765aef"
     ],
     "verification": "Replicated the parallax maths over stationCamera's projects ride at screens 0, 3 and 7, at 1440x900 and 390x844. At screen 3 the old world-axis offset moved the camera 0.32 units along the view (about 7% of the 4.3-unit distance, read as a zoom); the new side/up offset moves it 0. typecheck and lint pass."
    },
    {
     "id": "FX02",
     "status": "done",
     "commits": [
      "5c81a4d"
     ],
     "verification": "Pixel masks on the built /about page: the world is drawn alone, with the About station's parts shown and then hidden (R3F clock frozen, glow planes and motes kept in both shots), and the difference is the station. Zero station pixels fell inside .about__copy's text line boxes at every quarter-screen scroll step through the bio, at 1440x900 and 1100x800, in dark and light themes. Before the change the sim showed overlaps from the top of the page to the end of the bio at both sizes. The pose is a 0.5 rad swing round the station, back 2.1, look (0,-0.8,0), room 5.2, found by searching the projected rings, habitat ring and masts against the measured line boxes. Also needed data-world-section=\"bio\" on .about__grid in About.tsx, as L12's report asked."
    },
    {
     "id": "C9",
     "status": "done",
     "commits": [
      "33daeb0"
     ],
     "verification": "Station pixel masks counted inside .glass boxes while scrolling, dark theme, 1440x900 and 1100x800 (pixels per scroll position): Contact went from 4,890-10,416 to 0 everywhere; About ≤3; Home from 2,254-27,000 to 83 and 287 at 1440 and 343 at 1100, only while blending from the stats pose to the explore pose; Experience ≤556 (the hull's wing tips near the top). The hero titles on Home and Contact still overlap their stations by design; that is not C9's target. Also added a still-mode settle frame: the rig asks for one more frame while a snapped pose is still moving, because the pose otherwise stayed one measure (or a whole End jump) stale. 30-flight sim unchanged."
    },
    {
     "id": "B6",
     "status": "done",
     "commits": [
      "a697a26"
     ],
     "verification": "Stepped stationCamera through the measured /skills layouts. In the browser at calm (where the camera cuts to each category's pose), at 1440x900 the planet stays in shot at x 1128-1164 at every category stop and the camera position changes per category; at 1100x800 it stays at x 865-892. At 390x844 it is unchanged (scrolls away as before). The full-motion blend between poses is checked by the sim only: SwiftShader ran at about 1fps, too slow to let the damped camera settle at each stop. Orbits and badges reach about 120px into the cards' right edge; see the L5 follow-up."
    },
    {
     "id": "B15",
     "status": "done",
     "commits": [
      "fc3523c",
      "77e6c91"
     ],
     "verification": "Sim of the rig's settled following (follow cap plus damp3) on project pages, measuring the camera's distance from the helix spine. One-screen hops stay at 14.97-15.22 on an orbit of 15.22 (the old straight jump cut in to 14.08). A 0->7 hop stays outside 11.1, but only after 77e6c91 exempts hops from FX30's cap; with the cap the path cut through the spine (1.9). In the browser, next, next and prev on /projects/drive-king each played 'select' as the hop set off and 'hud-lock' as it settled; the path itself couldn't be traced at about 1fps."
    },
    {
     "id": "C11",
     "status": "done",
     "commits": [
      "7b2d546",
      "c262671"
     ],
     "verification": "Browser at 960x600, full motion, with both stations already mounted, flying Home -> Contact. Mid-flight the fog sat at about 275-279 far and 59-60 near (targets 280/60), and the Contact station group was drawn the whole way in, from 237 units. Six seconds after landing the fog was at 194/42, easing back towards 120/26. A mid-flight screenshot at 190 units shows Contact's lit beacon behind the heading. A per-frame probe during this check found a pre-existing NaN camera frame at the end of the flight; fixed in c262671 by clamping smootherstep, and the post-fix probe of four flights found no non-finite camera values. 30-flight sim identical to base: peak 127 deg/s, at most 348 deg of turning, closest pass 16.3 units."
    },
    {
     "id": "C8",
     "status": "done",
     "commits": [
      "2e13c91"
     ],
     "verification": "Sim through the measured 390x844 layouts: with each world window centred on the reading line, the station's centre lands inside it on Home, About and Contact, and stays inside 0.2 of a screen either side. Browser at 390x844, still: with the window near the reading line, 84-100% of the station's pixels are inside the window rect (About 58% at +0.3, just past the cut); with the window off screen there are no station pixels. Below full motion it cuts into the window instead of sweeping with the scroll."
    },
    {
     "id": "FX21",
     "status": "done",
     "commits": [
      "c546a45"
     ],
     "verification": "Browser navigation Home -> About through the header link at still and at calm, recording onFlight and onCue: 'flight end about' arrives after the cut with no 'start'. The camera speed stays 0. The @webgl tour test (reduced motion) passes."
    },
    {
     "id": "FX30",
     "status": "done",
     "commits": [
      "5b0278b"
     ],
     "verification": "Sim of the rig's exact settled-following code: a 34-unit End jump on /experience peaked at 124 units/s before and is capped at 35 now; a one-screen About jump is under the cap either way. In the browser, /experience at SwiftShader drew one frame every couple of seconds, so I verified the mechanism rather than a speed profile, per the brief."
    },
    {
     "id": "D10",
     "status": "done",
     "commits": [
      "2f9496e"
     ],
     "verification": "Browser at still and at calm, with a MutationObserver on html[data-world-cut] plus the flight events. Still: cut out -> flight end about -> cut in -> attribute cleared 300ms later. Calm: the same sequence. With screenshots forcing frames, the canvas opacity goes 1 -> 0 on 'out' and back to 1 on 'in', and the transition durations apply (0.15s and 0.3s, against the reduced-motion 0.01ms)."
    },
    {
     "id": "FX04",
     "status": "done",
     "commits": [],
     "verification": "No code change: the camera half already holds. A fresh load at full motion recorded the boot warp-in emitting 'start', then 'approach' at progress 0.60 (with the 'power' cue), then 'end' at 1.00, exactly like a flight. Notes for the radar and beacon halves are in the follow-ups."
    },
    {
     "id": "N8",
     "status": "done",
     "commits": [
      "436fddf"
     ],
     "verification": "Browser in free roam with the camera parked: 18 units from About, the sun's shadow target converged on About (45.8, 11.5, -34.3, still easing, against 48, 12, -36). With no station within 40 units it follows the camera (10.1, 12, -91.9 for a camera at 10, 12, -92). A third case near Skills stopped before converging because no frame was drawn between two readings; it is the same code path."
    },
    {
     "id": "A1",
     "status": "done",
     "commits": [
      "7b51dad"
     ],
     "verification": "Browser at 960x600, full motion. Settled: the line is hidden (visible false, so no draw call). setPreview('skills'): pink, opacity easing up to 0.91, length 186, nothing flown. Flight: cyan, with the flown share tracking progress (0 -> 0.76 at 65%), so it shortens. After landing it fades out. At calm: a still pink preview line, and it fades when the click cuts instead of flying. Screenshots show the dashed course: faint pink behind the nav for the preview, cyan in flight. The preview was driven through setPreview directly because the swaying header defeats Playwright's hover."
    }
   ],
   "followups": [
    {
     "file": "components/World/pageInputs.ts",
     "change": "In measureClearRight, take the rightmost of the panels as wide as the widest instead of the first. For example: `if (rect.top > line || rect.bottom <= line) continue; const edge = (rect.right / window.innerWidth) * 2 - 1; if (rect.width < widest - 1 || (rect.width <= widest + 1 && edge <= right)) continue; widest = Math.max(widest, rect.width); right = edge;`",
     "why": "`rect.width <= widest` skips ties, so for a row of equal cards (Home's 2x2 stats and explore grids, Contact's phone and LinkedIn row) clearRight is the left card's edge: -0.31 instead of 0.22 at 1440. C9's clearRoom then can't clear those rows, so the companion rooms are tuned as constants to clear them. This is a foundation file no lane owns, so I didn't edit it."
    },
    {
     "file": "components/World/stations/ProjectsStation.tsx",
     "change": "Choose the front screen (`front` / `live`) from `riddenProjectFocus()` (exported from stations.ts) instead of `worldStore.projectFocus` and the `opened` prop. B8's FLIP should read `worldStore.screenRect` once the ride has settled.",
     "why": "After a B15 hop (prev/next, a modal opening another project, End on the runway) the camera rides the helix for 0.8-2.2s. The screen should light as the camera arrives, not at the jump, and the screen rect moves during the hop."
    },
    {
     "file": "components/World/ExploreControls.tsx",
     "change": "Keep the C11 seam in reachOut: outside free roam the fog heads for `fogTarget(base, lite)` from stationHooks.ts, not for the base distances (an 8-line change in L8's file, as the lane brief allowed).",
     "why": "This is how flights between pages draw the fog back to 280/60 and let it ease back after landing. It reads the flight state itself, so it doesn't depend on mount order."
    },
    {
     "file": "components/World/NavRadar.tsx",
     "change": "FX04 radar half (and the matching L7 beacon-name half in components/World/Beacons.tsx): treat a flight whose 'start' arrives before any 'end' since the component mounted as the boot warp-in.",
     "why": "The warp-in is an ordinary flight to the page's station ('start', 'approach' at 0.6 with the power cue, 'end' at 1, verified) and always the canvas's first. The radar and beacons mount with the world, so this tells it apart without a new interface."
    },
    {
     "file": "components/World/stations/SkillsStation.tsx",
     "change": "B6 station half: fade badges and orbit segments that sit left of worldStore.clearRight (the category card at the reading line, about 0.24 NDC), not only those behind the heading block (worldStore.copy).",
     "why": "On wide /skills the camera now keeps the constellation beside the one-column grid, and the orbits and badges reach about 120px into the cards' right edge (7-16k px of overlap per category stop at 1440 and 1100)."
    },
    {
     "file": "components/About/About.tsx",
     "change": "Keep `data-world-section=\"bio\"` on `.about__grid` (added in 5c81a4d, as L12's report asked). L4's B4 adds `data-world-target=\"about:portrait\"` on `.about__frame` two lines below; the two merge cleanly.",
     "why": "FX02's bio pose is keyed to it, so companions.about is now [bio, recommendations]. L10's HeaderHud section ticks (A10) will see two About sections."
    },
    {
     "file": "components/Sound/sound.ts",
     "change": "N9 (L11): play the 'arrive' chord on onFlight('end') when no 'start' preceded it for that station.",
     "why": "Since FX21, cuts at calm and still emit 'end' with no 'start', after D10's dip, which is exactly N9's arrival-without-flight signal."
    },
    {
     "file": "components/World/optics.ts",
     "change": "FX30 optics half (L6), and the streak half in Starfield.tsx and Dust.tsx (L7): key the radial blur and the streaks on worldStore.flight.active or explore mode, not on worldStore.velocity alone.",
     "why": "The camera half caps scroll-driven speed at 35 units/s, but companion-pose glides sit at 35 and project-ride hops reach about 70; neither should look like lightspeed."
    },
    {
     "file": "components/World/World.scss",
     "change": "Keep D10's two rules at the end of the file: `html[data-world-cut='out'|'in'] .world__canvas`, with !important over the reduced-motion transition rule.",
     "why": "L1 appended them to L2's file as the plan allowed; they must survive L2's merge."
    }
   ],
   "docNotes": [
    "Report file: the harness blocked subagents from writing report .md files, so /home/user/wi/reports/l1.md is still the stale progress note from the paused attempt (it says no commits). This structured result is the lane report and supersedes it.",
    "Camera › parallax: the pointer offset runs along the pose's own side and up axes (side = forward x up, up = side x forward), 0.45 / 0.28. In world x and y it zoomed the projects ride's side-on screens.",
    "Camera › About: the About pose drops at page speed (2 * distance * tan(fov/2) * zoom per viewport height), so the station leaves with the page head. companions.about is [bio (.about__grid, data-world-section=\"bio\"), recommendations]. The bio pose swings 0.5 rad, so the crew habitat, 15 units behind the helmet and a parallax trap behind the copy, comes out from behind the copy.",
    "Camera › companions (replace 'the station pushed further right beside the copy'): on wide layouts copy keeps to the left column (min(46rem, 58vw), about 0.23 NDC), and companion rooms are tuned to clear it. The sideways shift is max(constant room, clearRoom): enough to put the station's framing box (shots.halfWidth) right of worldStore.clearRight plus 0.06 NDC, with its centre capped at 0.62. The experience beam and projects helix clear the point framed, others their centre. Not on the centred projects ride.",
    "Camera › still: drawn on demand, a frame asked for by a scroll can run before pageInputs has measured the page, so the rig asks for one more frame (invalidate) while a snapped pose still moves. Rule: anything posed from pageInputs' measures must survive a one-measure lag at still.",
    "Camera › wide /skills (B6): the planet stays in shot (sinks 1.6 over the page) and the eye moves to one pose per category (worldStore.skillFocus), 0.42 rad above that category's orbit plane (orbitTilts) and 1.15x back, arriving over the first 30% of the category. Direction and distance are blended separately so it goes round the planet. Below full motion it cuts. Narrow is unchanged.",
    "Camera › projects ride (B15): CameraRig keeps a ridden focus. It passes the page's settled focus straight through for changes under 0.5 per frame, otherwise hops along the helix with smootherstep over clamp(0.8 + 0.12|d|, 0.8, 2.2)s, with 'select' on hops of a screen or more and 'hud-lock' when they settle. stationCamera reads riddenProjectFocus() (stations.ts); rideProjectFocus() / pageProjectFocus() are the setter and the page's value. Hops aren't held to the follow cap. It cuts below full motion.",
    "Camera › flight fog (C11): while worldStore.flight is active outside free roam, the fog eases to far 280 (lite 180), near 60, and back after landing. The destination draws out to 320 (stationInRange per key). stationHooks.fogTarget(base, lite) is the target ExploreControls' reachOut eases to outside free roam; other stations follow the fog through setViewRange as before.",
    "Camera › phone world windows (C8): stationFraming(key, w, h, out, slot?) takes an optional slot {top, height} in CSS px. On narrow layouts, as the [data-world-window] nearest the reading line (worldStore.worldWindow) approaches it, the camera blends (1 - smoothstep(distance / height, 0.05, 0.4)) towards a pose framing the station inside the window, swung 0.35 rad, damped by the rig. Below full motion it cuts in halfway.",
    "Camera › cuts (FX21 + D10): below full motion a retarget cuts and then emits onFlight('end', station) with no 'start', so power never drops and the tour lands. A change of station also dips the canvas: html[data-world-cut]='out' (150ms fade, view held 160ms), cut, 'in' (300ms), cleared 300ms later. At still the rig invalidates at 170 and 480ms. Add data-world-cut to CLAUDE.md's debugging list of html data attributes. The fade rules in World.scss use !important over the reduced-motion transition rule on purpose.",
    "Camera › follow cap (FX30): the settled camera chases a point moving at most 35 units/s towards its pose (and its look point), then damps onto it as before. Flights, cuts and project-ride hops aren't capped. Before, an End jump of 34 units hit 124 u/s and triggered lightspeed.",
    "Lighting (N8): in explore mode the shadow box centres on the station nearest the camera within 40 units (any station, the derelict included), else the camera.",
    "CourseLine (A1, new component paragraph): one camera-facing ribbon, 64 segments preallocated (position = centre, aTangent, aSide, aAlong), width max(0.05, distance x 0.0018). It is a CatmullRom through the path, rebuilt only when the source array changes: previewPath (pink), flight.path (cyan), autopilotPath in free roam (cyan). Dashes march towards the destination, the flown stretch falls away (nearest point to the camera), it starts 2.5-9 units ahead of the camera and fades into the station. Fragments are dropped behind worldStore.copy. Still: none; calm: static. asGlow; drawn once in warm-up, then hidden while unused.",
    "flight.ts rule: smootherstep never returns more than 1. Just under 1 the polynomial rounds over (smootherstep(1 - 1.3e-15) = 1 + 1.3e-15), and Curve.getPointAt past 1 is NaN, which gave a blank frame with a NaN camera and FOV at the end of some flights. Never feed getPointAt an eased value that isn't clamped.",
    "Testing technique (AGENTS.md Testing or verification notes): to measure where a station draws, render the world alone (page visibility hidden, with transition: none injected), freeze the R3F clock (clock.autoStart = false, running = false) so shaders don't animate between shots, find the station's group from a signature mesh (not by position: many groups sit at the origin), hide its non-glow children and diff the two screenshots. At still the first frame after a scroll can be stale, so draw two. Under SwiftShader headless, getComputedStyle mid-transition can be stale when no frames are drawn; take screenshots to force frames."
   ],
   "risks": [
    "Out-of-lane edits: About.tsx (L12's file) gained data-world-section=\"bio\" on .about__grid, as L12's report asked; ExploreControls.tsx (L8's) got the agreed fogTarget seam in reachOut (8 lines). Both are small and should merge cleanly, but L8 must keep the seam.",
    "C9 is tuned with constants because of the pageInputs tie bug (follow-up). Residual overlaps: Home 83-343 station pixels inside glass mid-way between its two companion poses, Experience up to 556 (hull wing tips). The hero titles on Home ('Hadden') and Contact ('connect') still overlap their stations at the top of the page, as before; L6's readability guard covers that.",
    "The FX30 follow cap also slows deliberate companion swings: Home's explore pose moves about 50 units, so it now glides over about 1.5s rather than about 0.6s. Project-ride hops are exempt, which needed a fix commit (77e6c91) after the cap made long hops cut through the helix spine.",
    "C8 on About at full motion: the scroll pose is far above (page speed), so blending into the window sweeps the station a long way. It is damped and capped at 35 u/s; below full motion it cuts. Worth a look on a real phone.",
    "B6 keeps the constellation beside the grid, so orbits and badges overlap the right ~120px of the category cards until L5's badge half dims them.",
    "smootherstep (flight.ts) now clamps its output to 1, which affects every caller: the 30-flight sim is identical to base and the probe found no NaN frames, but it is shared maths.",
    "D10's World.scss rules use !important against the global reduced-motion rule; check they survive L2's World.scss changes and don't fight L2's world-off and veil rules.",
    "The CourseLine is thin far off (0.0018 x distance) and was only seen at DPR 1 in SwiftShader, where the pink preview reads faint. Judge it on a real GPU at DPR 2 before tuning.",
    "Everything was verified under SwiftShader at about 1-2fps while another lane ran Playwright (load 9-12 on 4 cores). Frame-time and perf numbers weren't measured; mechanisms were checked instead (masks, event logs, sims of the rig's exact maths). Full-motion blends (B6, C8) and the projects ride's path were checked in sims, not traced live."
   ],
   "tests": "npm run verify passes (prettier:check, eslint, stylelint, tsc), and npm run typecheck plus npm run lint passed before every commit. The final build passes (build lock taken and released each time; 6 builds in total). e2e against my server on :3301, final clean build: chromium project, 74 passed (world, motion, space, about, projects, no-js, resilience, skills, home, contact, a11y and header specs; an earlier run of the first ten of these passed 55); chromium-webgl, 6 passed (world.spec.ts' 4 @webgl tests and projects.spec.ts' 2) in 11.3 min. Throwaway sims in /home/user/wi/scratch/l1/sim: all 30 ordered flights at 1440x900 and 390x844 are identical to base before and after the flight.ts fix (peak 127 deg/s, at most 348 deg of turning, closest pass 16.3 units); FX12, FX02, B6, B15, C8 and FX30 sims as noted per item. Browser checks in /home/user/wi/scratch/l1 (station pixel masks, flight and cue logs, cut attribute timeline, per-frame NaN probe) as noted per item.",
   "verifyPassed": true
  },
  "fixes": [
   {
    "startCommit": "c2626716359edd9a71fe178c450662db6a1949f7",
    "headCommit": "1b4214673df50afebcb4f1fa1063793b3aba6765",
    "pushed": false,
    "verifyPassed": true,
    "tests": "npm run verify passes on HEAD 1b42146. The final clean build (behind the lock) passes; the built chunk carries the latest change and no debug hooks. e2e against next start -p 3301: default chromium project world.spec.ts + projects.spec.ts + no-js.spec.ts + motion.spec.ts, 33 passed (1.1m); chromium-webgl @webgl tests in world.spec.ts (56, 89, 175, 252), projects.spec.ts (103, 157) and motion.spec.ts (96, 120), 8 passed (14.2m). The 30-ordered-flight simulation (60 flights, 1440x900 and 390x844) is identical to the lane's last run (peak 127°/s, at most 348° of turning, closest pass 16.3). Scripts in /home/user/wi/scratch/l1/fix/: c9gap.ts, c9base.ts, tour.ts, and ride.ts (rig-level, real stations.ts, 60/120Hz, desktop and phone, before/after). Browser checks were run on a temporary uncommitted debug build of 893c26d: C9 gap, tour leak, ride cues and turn, course-line uCopy uniform.",
    "results": [
     {
      "title": "C9 clear room flips on and off at every gap between glass cards, so the camera jumps sideways while reading",
      "outcome": "fixed",
      "commit": "b444c39",
      "note": "Fixed in pageInputs.measureClearRight, not by easing over time in stations.ts. Glass within 5% of the viewport height of the reading line counts as at it, which covers any card gap. Each panel's pull fades towards -1 over the next 20%, and the value is the right-most faded edge, which also settles ties between side-by-side cards. Simulated on /experience at 1440x900: the largest eye move per 4px is 0.27 (1.28 before), with no jumps (16 before); on /skills, clear room adds at most 0.26 per 4px. Browser: clearRight holds 0.22 across the gap with no sideways camera move, and the head of the list eases in (largest step 0.44 per 8px). pageInputs.ts is a foundation file no lane owns; the worldStore.clearRight doc comment was updated."
     },
     {
      "title": "Page-only measurements (world window, clear room, skill focus) reframe tour stops and link previews for other stations",
      "outcome": "fixed",
      "commit": "d22224c",
      "note": "stationCamera takes reading=true. CameraRig passes mode==='page' and planPreview passes false. Without it, the pose ignores worldWindow, clearRight, skillFocus, sectionFocus (companions), roleFocus, and the projects aside/intro/ride (it holds the yard overview). Simulation: with the left-over page state, every stop moves 0.00 units at 390x844 and 1440x900 (5.5-25 before); page-mode poses are unchanged. Browser (phone, /about, still): a tour started at the top and one started at the world window gave identical camera positions at all 6 stops."
     },
     {
      "title": "A ride hop that is retargeted every frame restarts from rest: the camera stalls and 'select' repeats",
      "outcome": "fixed",
      "commit": "4c39cc3",
      "note": "The ride moved into stations.ts (stepRide/createRide) and was reworked. While the hop is still setting off, a goal that races on or drifts re-aims the same hop, re-based to carry on from where it is. A real change of course sets off afresh at the current speed (quintic carry term). Follow-up 1b42146 times a re-aimed hop for its current goal: index 01 to 11 now lands at 2.03s (plan 2.0)."
     },
     {
      "title": "The course line is masked by a heading block that isn't on screen (tour, free roam, and a flight before approach)",
      "outcome": "fixed",
      "commit": "893c26d",
      "note": "CameraRig marks a flight to a new page from its start until its approach (holdPageCopy, cleared on approach, at the end of any flight and on unmount). stations.ts pageCopyShown() requires html[data-world-mode]==='page', which also covers L2's 'returning' state, and no held flight. CourseLine masks only then, so the boot warp-in and the return from the tour keep the mask. Done inside L1's files, without PageTransition. Browser: no mask for 59 tour-flight frames; on a page flight, no mask for 23 frames before approach and the mask for 16 after. SkillsStation needs the same gate (follow-up for L5)."
     },
     {
      "title": "Long projects-ride hops spin the camera at up to ~670 deg/s with no turn-rate limit",
      "outcome": "fixed",
      "commit": "4c39cc3",
      "note": "The ride's angle takes the short way round (at most 180°), and the duration stretches so the peak turn is at most 2.4 rad/s. The hop threshold is scaled by frame time, so 120Hz behaves like 60Hz. Rig sim at 60/120Hz, desktop and phone: index 01 to 15 turns 98° at 80°/s (607° at 551°/s before); End 95° at 77°/s (606° at 707°/s); pager wrap 95° at 78°/s (625° at 544°/s); 120Hz 01 to 04 125°/s with clearance 3.77 (427°/s, 1.04 before). Runway clearance from every screen is 3.75 or more (0.00-0.06 before). Prev/next on a project page is unchanged. Worst peaks: 166°/s on a mid-hop reversal, 145°/s on a 5-screen glide. A 4-screen hop now takes about 2.45s."
     },
     {
      "title": "B15: one long ride from the projects index plays the 'select' cue 8 to 12 times",
      "outcome": "fixed",
      "commit": "4c39cc3",
      "note": "'select' sounds once, when a ride first spans a screen (including a hop that grows into one), and never on a chained restart. 'hud-lock' sounds once, on landing, if the ride sounded. Sim: every hopping case gives exactly 1 select and 1 hud-lock (8-13 selects before, and no hud-lock after a reversal). Browser: each index ride gave one select and one hud-lock."
     },
     {
      "title": "Lane report never written: FX04 status, e2e results, follow-ups and doc notes are missing",
      "outcome": "fixed",
      "note": "/home/user/wi/reports/l1.md was overwritten with the final report. It has per-item status, commits and evidence (FX04 camera half: done, no change, per logs/boot.log), files touched outside L1's list (ExploreControls C11, About.tsx bio section, World.scss D10, pageInputs/worldStore), verification and specs run, cross-lane follow-ups, doc notes for Task 99, risks, and the appended 'Review fixes' section."
     }
    ],
    "followups": [
     {
      "file": "components/World/stations/SkillsStation.tsx",
      "change": "In clearOfCopy(), treat worldStore.copy as empty when pageCopyShown() (from '../stations') returns false.",
      "why": "worldStore.copy is measured at opacity 0 while touring or exploring and during a flight to a new page before its approach, so badges fade out behind copy that isn't on screen. CourseLine got the same gate (893c26d). Owner: L5."
     },
     {
      "file": "components/World/stations/ProjectsStation.tsx",
      "change": "Drive the front screen from riddenProjectFocus() (stations.ts) instead of worldStore.projectFocus.",
      "why": "The camera rides the helix, so the front screen should light as the camera arrives rather than when the page jumps. Use the focus, not an angle: the ride's angle can now go the short way round. Owner: L3."
     },
     {
      "file": "components/World/ExploreControls.tsx",
      "change": "Keep reachOut heading for fogTarget(base, lite) outside free roam (L1's agreed C11 change in 7b2d546).",
      "why": "Otherwise the flight fog draw-back is reset every frame. Owner: L8."
     },
     {
      "file": "components/World/World.tsx",
      "change": "Keep html[data-world-mode]==='page' meaning the page is shown, with any other value (tour, explore, L2's 'returning') meaning hidden.",
      "why": "pageCopyShown() reads that attribute to decide whether the heading block is on screen. Owner: L2."
     },
     {
      "file": "components/World/World.scss",
      "change": "Keep the [data-world-cut] rules L1 appended at the end (D10) when merging L2's changes.",
      "why": "The rules drive the below-full-motion canvas dip around cuts. Owner: L2."
     }
    ],
    "docNotes": [
     "stationCamera(..., reading = true): only the page's own station in page mode reads page measurements (sectionFocus, roleFocus, skillFocus, clearRight, worldWindow, projectAside/intro). Tour stops (the rig passes mode==='page') and link previews (false) are framed from the top of their page. Any new page-reading input must be gated on `reading`. Bug: tour stops picked up the hidden page's world window, glass and category, 7-25 units off on phones.",
     "worldStore.clearRight (pageInputs): the right-most edge of the #main-content .glass panels within 5% of the viewport height of the reading line, each fading towards -1 over the next 20%. Measured at the line alone, every gap between cards read -1 and the station jumped out and back 16 times down /experience. Wide layouts shift the station by max(constant room, clearRoom); clearMost is 0.62 NDC.",
     "Projects ride (B15): stepRide/createRide live in stations.ts and CameraRig hands over rideProjectFocus(value, angle) each frame. Pass-through below half a screen per 1/60s (scaled by frame time). Hops move focus and angle together, and the angle goes the short way round (at most 180°). Duration is clamp(0.8+0.12·|Δ|, 0.8, 2.2)s, longer to keep the peak turn ≤ 2.4 rad/s. While setting off, a racing or drifting goal re-aims the same hop, timed for its current goal and never past halfway; a real change of course carries the current speed. One 'select' when a ride first spans a screen, one 'hud-lock' on landing. Snaps below full motion. Bugs: the length of the helix spun the view 1.7 turns at up to 780°/s through screens; a Lenis glide restarted the hop every frame and played 'select' 8-12 times.",
     "CLAUDE.md camera rule: for changes to the projects ride, also simulate turn rate, total rotation and clearance to every screen. Cover 1/3/7/14-screen hops, index glides, End and the pager wrap, at 60 and 120Hz.",
     "pageCopyShown() / holdPageCopy() (stations.ts): worldStore.copy is measured at opacity 0 too. Things that keep out of the heading block (CourseLine, SkillsStation badges) must check pageCopyShown(): html[data-world-mode]==='page', and no flight to a new page short of its approach.",
     "html[data-world-cut='out'|'in'] (D10): below full motion a cut to another station fades the canvas out (150ms, old view held 160ms), cuts, then fades in over 300ms and clears. The rig invalidates at 170ms and 480ms. The World.scss rules use !important over the global reduced-motion rule. Add data-world-cut to CLAUDE.md's debugging attribute list.",
     "FX30: the settled camera chases a point capped at 35 units/s (followSpeed). The cap is lifted during flights, cuts and projects-helix hops. FX21: a snapped station change emits only 'end', never 'start'. FX04: the boot warp-in emits start/approach(0.6)/end like any flight.",
     "C11: while a flight is under way outside free roam, fog eases to 280 units (180 on lite devices), near 60 (fogTarget in stationHooks.ts). The destination draws from 320 units (stationInRange). ExploreControls.reachOut heads for fogTarget outside free roam; both read the flight state, so neither depends on mount order. flight.ts smootherstep is clamped to ≤ 1, which fixed a NaN camera on a flight's last frame.",
     "FX12: parallax runs along the pose's own side/up axes. B6: wide /skills uses one orbit-facing pose per category (skillFocus). C8: stationFraming takes an optional world-window slot on narrow layouts (swing 0.35 rad). FX02: the About pose moves at page speed and has a bio companion pose. N8: in free roam the shadow box centres on the nearest station within 40 units. A1: CourseLine is a camera-facing dashed ribbon, always mounted (compiled in warm-up)."
    ]
   }
  ],
  "resume": {
   "round": 2,
   "range": "1b4214673df50afebcb4f1fa1063793b3aba6765..HEAD",
   "pendingFix": {
    "round": 2,
    "findings": [
     {
      "title": "A 5-screen index ride turns the camera about 20° the wrong way, then reverses (B15 review fix)",
      "file": "components/World/stations.ts",
      "line": 186,
      "severity": "major",
      "detail": "The ride commits to a turn direction before the glide's final goal is known. While a hop is setting off, `retarget`'s first branch re-aims it every frame with `angleTo = ride.angle + wrapAngle(goal * helix.turn - ride.angle)`. That is the short way round from the current angle to the glide's current goal, not to where the glide ends.\n\nOn an index click, Lenis scrollTo (duration 1.2, expo-out) moves the page's focus over about 1.2s:\n- At 60Hz the glide's first frame moves the settled focus 0.39 screens. That is under `jump` (0.5), so it passes straight through: +17° of angle in one frame (lines 247-249).\n- The hop then sets off the positive way.\n- Once the intermediate goal is more than 4.03 screens ahead (π / 0.78), `wrapAngle` flips the short way to negative. The re-based hop keeps the position continuous but reverses the angular velocity.\n\nBefore 4c39cc3 the hop followed `value * helix.turn`, so it never reversed. The commit's own claim (\"turns the short way round, once\") does not hold for these rides.",
      "failureScenario": "/projects at 1440x900 (or 390x844), 60Hz, full motion, the ride on project 01. Click the index entry for 06 (likewise 03->08, 10->15, or any 5-screen jump either way); the B14 `goTo` glide does the scrolling.\n\nSimulated through the rig, with the real `stepRide`, `stationCamera`, the 35 u/s follow cap, its reset while hopping, and damp3 (`/home/user/wi/scratch/l1/review/cr-yaw.ts`):\n- The camera's yaw swings +19.6° over the first ~0.55s, stops, then turns -156° to land at -136.5°.\n- That is 176° of turning instead of 136.5°, with a visible reversal: the screens slide one way, stop, then slide back.\n- At 120Hz the wrong-way part is only 1.7°: the first frame hops instead of passing through.\n- A 14-screen glide shows 5-7° of the same back-swing.\n\nThe ride still lands on the right screen with one select and one hud-lock.",
      "suggestedFix": "Aim the ride at the glide's destination from its first frame. For example, `Projects.goTo(i)` (L3) writes the target index to worldStore, and `stepRide` uses that as the goal while it is set. Alternatively, in L1 only: don't pass a step straight through when the next frames will turn it into a hop, and keep a re-aimed hop's established turn direction unless the other way is shorter by a clear margin (hysteresis), so an intermediate goal crossing the half-turn boundary cannot reverse a ride that has already turned that way. Re-run the 5-screen index cases at 60 and 120Hz and check that the yaw is monotonic.",
      "betterFix": "Prefer the destination approach over hysteresis, and fill in the parts the suggestion leaves out.\n\n1. **Publish the destination from the page (L3):** `Projects.goTo(i)` sets `worldStore.projectGlideTo = i` before calling `lenis.scrollTo(y, { onComplete: clear })`.\n2. **Clear it when the glide stops:** clear it on `onComplete`. Also clear it on any user input that interrupts the glide (Lenis `virtual-scroll`, `pointerdown`, `keydown`), because a wheel replaces Lenis's animation and the first `onComplete` never fires. Clear it on unmount and whenever `selected >= 0`. With `immediate` (reduced motion) don't set it at all.\n3. **Use it in the ride (L1):** in CameraRig, `ridingTo = glideTo >= 0 ? glideTo : pageProjectFocus()`. The ride then sets off once, the short way from the first frame, toward the real destination. This also suppresses the first-frame pass-through, since |dest - value| ≥ jump.\n4. **Guard against a stale value:** in the rig, ignore `glideTo` unless the page focus lies between the ride's value and `glideTo`.\n5. **Keep a fallback when no destination is set:** re-aims inside `retarget` should keep the hop's current turn sign (`Math.sign(ride.angleTo - ride.angleOrigin)`) unless the opposite way is shorter by more than about 40°, and must never pass a goal straight through while hopping.\n6. **Re-check:** re-run 1→6, 6→1, 3→8, 10→15, 1→14 and 1→15 at 60, 90, 120 and 144Hz through the rig. Yaw should be monotonic, no turn should exceed π, and each ride should sound one 'select' and one 'hud-lock'.",
      "verifierNotes": [
       "CONFIRMED: I could not refute this. The reversal happens on a real input path.\n\n**How the click reaches the ride**\n- An index click calls `Projects.goTo(i)`, which runs `lenis.scrollTo(y, { immediate: reduce })` (components/Projects/Projects.tsx:283-295).\n- `ReactLenis` is set up with `{ lerp: 0.1, duration: 1.2 }`. The Lenis 1.3.23 constructor gives it `defaultEasing = min(1, 1.001 - 2^(-10t))`, and `scrollTo` uses `options.duration` and `options.easing`, so the glide is 1.2s expo-out.\n- Lenis advances once per rAF (`raf`: deltaTime = time - this.time, with autoRaf on by default in lenis-react). The first frame at 60Hz therefore covers 9.28% of the glide: 0.464 screens of raw focus for a 5-screen jump.\n- Projects' scroll listener writes `worldStore.projectFocus` linearly from `scrollY`. CameraRig calls `stepRide(rig.ride, pageProjectFocus(), ...)` (CameraRig.tsx:218-220), and `pageProjectFocus` = `settleFocus(...)`, which gives 0.388.\n- That is under `jump` = 0.5, so stations.ts:247-249 passes it straight through: `ride.angle` = 0.388 × 0.78, which is +17.4°.\n- On the next frame the goal is 1.0, which sets off a positive hop. Each later frame re-aims it in `retarget`'s first branch (u < 0.5, onward) with `angleTo = ride.angle + wrapAngle(goal*turn - ride.angle)`. That is the short way to the intermediate goal, and it stays positive until that goal passes about 4.4 screens.\n\n**What the simulation shows**\nI wrote my own per-frame trace of `ride.angle`, using the real `stepRide` and `settleFocus` and a one-frame Lenis lag (/home/user/wi/scratch/verify/b15rev/angle.ts):\n- **1→6 at 60Hz:** the angle climbs to +24.4° by frame 26. At that frame `angleTo` flips from +202° to -151.5°, and the angle then runs down to -136.5°: one change of direction, about 24° the wrong way.\n- **Same at 3→8, 10→15, 2→7 and 6→1 (mirrored).**\n- **Other rates:** 4.9° the wrong way at 120Hz and 7.3° at 90Hz. At 144Hz it is 14.1°, because the scaled jump lets the first frame pass straight through again.\n- **1→14:** 12° the wrong way, with three changes of direction.\n\nI also re-ran the reviewer's full-rig script (/home/user/wi/scratch/verify/b15rev/cr-yaw.ts: follow cap, its reset while hopping, damp3). The camera yaw peaks at +19.6° around 0.55s and then turns to -136.5°, as the finding says.\n\n**Checked and ruled out**\n- The 2π jump in `ride.angle` when the hop lands is harmless: `stationCamera` only uses the angle in sin/cos.\n- Nothing else handles the case. Snapping waits for rest, and End is an instant native scroll, which hops once with the final goal.\n- 4c39cc3's own claim that a long jump \"turns the short way round, once\" does not hold for index or screen-click glides.\n\nThe plan only requires smootherstep easing and the 0.5 pass-through. The defect is the turn direction being chosen from the glide's intermediate goals.\n\n**The suggested fix works, with additions**\nI sketched it: while `goTo`'s glide runs, the ride's goal is the destination index (/home/user/wi/scratch/verify/b15rev/dest.ts). At 60, 120 and 144Hz, for 1→6, 6→1, 3→8, 10→15, 1→7, 1→11, 1→14, 1→15 and 15→1, it gives 0° the wrong way and no change of direction. The final angles are unchanged (-136.5°, -94.3° and so on), peaks are 80-138°/s, and rides land in 1.5-2.2s.\n\nThe hysteresis-only alternative is weaker: keeping the established direction turns a 5-screen ride +223.5°, which breaks the at-most-half-a-turn property 4c39cc3 established. See `betterFix` for the details the suggestion leaves out.",
       "CONFIRMED: I could not refute it. The failure is real, nothing else handles it, and it goes against the code's own claim.\n\n**The code (/home/user/wt/l1/components/World/stations.ts:186)**\n- `retarget`'s re-aim branch sets `angleTo = ride.angle + wrapAngle(goal * helix.turn - ride.angle)`, which is the short way to the glide's current goal, not to where the glide ends.\n- At 0.78 rad a screen, the short way flips sign once the goal is about 4 screens ahead. The re-base keeps the angle continuous but reverses its velocity.\n\n**The input path**\n- The index `onClick` calls `goTo(i)` (Projects.tsx:283-293, and the same in L3). That calls `lenis.scrollTo(y)` with the provider's `duration: 1.2` (ClientProviders.tsx:39) and Lenis 1.3.23's default easing `1.001 - 2^(-10t)`. `autoRaf` is true, so the first advance has a real 16.7ms delta.\n- At 60Hz the first frame's settled focus for a 5-screen jump is `settleFocus(0.464) = 0.389`. That is below `rideJump` (0.5), so it passes straight through: +17.4°. Later frames hop the positive way until the goal passes the flip.\n- CameraRig.tsx:218-219 feeds `pageProjectFocus()` (settled `projectFocus`) into `stepRide` every frame, exactly as the reviewer's sim does.\n\n**My reproduction**\n- Running /home/user/wi/scratch/l1/review/cr-yaw.ts (NODE_PATH set to the l1 node_modules) reproduces the finding. For 1->6, 3->8 and 10->15 at 1440x900 and 390x844, 60Hz, the camera yaw reaches +19.6° and lands at -136.5°. At 120Hz the wrong-way part is 1.7°.\n- The raw ride angle, without camera damping (/home/user/wi/scratch/verify/b15rev/angle.ts), goes 24.4° the wrong way at 60Hz, 7.3° at 90Hz, 4.9° at 120Hz and 14.1° at 144Hz, always with a direction change.\n- 01->14 changes direction 3 times, 12° wrong-way at most. One small error in the finding: its \"14-screen glide\" is the 13-screen 01->14.\n\n**Context lens**\n- Nothing in any lane gives the ride the glide's destination. L3's `userData: { rideTo }` only feeds its snap logic, and no lane writes a ride goal to `worldStore`.\n- The plan's B15 text does not require monotonic yaw. But commit 4c39cc3 claims \"turns the short way round, once\", and the stations.ts docblock says the angle \"takes the short way round\". Neither holds here.\n- That commit's own simulations covered 1->15, End, the pager wrap and project-page 1->5, never a 5-screen index glide. CLAUDE.md asks for camera changes to be simulated for total rotation; this ride turns 176° where 136.5° would do, with a visible back-swing.\n- It is a regression the B15 review fix introduced. Before it, hops followed `value * turn` and so could not reverse.\n- Severity is more moderate than major: the ride still lands on the right screen, with one select and one hud-lock.\n\n**Cost of the fix**\n- The destination approach is cheap: one store field, a write in `goTo` and one line in CameraRig.\n- The sim at /home/user/wi/scratch/verify/b15rev/dest.ts shows it removes the problem: 0° wrong-way and no direction changes at 60, 120 and 144Hz. A 5-screen ride lands in 1.88s, peaking at about 137°/s."
      ]
     }
    ],
    "startCommit": "1b4214673df50afebcb4f1fa1063793b3aba6765",
    "doneCommits": "9743b66 \"The projects ride turns one way round the helix on a glide to a project, not one way and then back (B15)\"",
    "note": "The interrupted agent also had uncommitted throwaway debug instrumentation (marked __l1tmp) in components/Projects/Projects.tsx and components/World/stations.ts; it was discarded and is saved at /Users/lewis/Workspace/wi/handoff/l1-uncommitted-debug.diff. It suggests the agent was checking whether Projects.tsx should publish a worldStore.projectRideTo target on an index ride (Projects.tsx is L3's file; L3 is merged on the integration branch but not yet in this lane's tree, so fast-forward/merge the integration branch first). Check whether 9743b66 fully fixes the finding on every ride path (index click, prev/next, swipe), finish it, and report any change needed in L3's files as a follow-up or make it if the plan allows."
   }
  }
 },
 "l2": {
  "res": {
   "baseCommit": "5c40f9971f5192aac1bd8ace84e93e68ce2b7c29",
   "headCommit": "6b4052a718ca123c4763cf86817f6ee7032829f0",
   "items": [
    {
     "id": "C5+FX09",
     "status": "done",
     "commits": [
      "b76fa37"
     ],
     "verification": "New @webgl test in world.spec ('leaving the tour for a page'), at full motion: Visit from a tour stop adds no .page-ghost, and html[data-world-mode] goes 'returning' then 'page'. Passes. The existing 'take over the page and hand it back' test also passes.",
     "note": "World.tsx keeps a 'returning' state: page hidden and inert until onFlight approach/end for its station, no flight there by the third rAF, or 6.5s. Below full motion it comes back at once. Then a 600ms Web Animation fades it in. Visit goes through navigateFromMode. snapshotPage bails unless html[data-world-mode]==='page'. PageTransition holds the copy whenever the world is on screen (new worldOnScreen), so pages opened from a mode wait for the camera too."
    },
    {
     "id": "E6 (incl. FX21 tour half)",
     "status": "done",
     "commits": [
      "fabfb1e",
      "0bbd853",
      "92d1a0a"
     ],
     "verification": "New @webgl test 'the guided tour', started from /skills via the palette: the first stop is Skills and reads 01; Space on the card sets Pause aria-pressed; arrow keys step round from the start; the closing card shows; ArrowLeft goes back to 06; 'Back to Skills' exits. Passes. Screenshots of the card (both themes, paused) and the closing card. Stops land at once at still.",
     "note": "worldMode gains tourStep (stops shown; equal to tourStops.length on the closing card). tourStop stays the station index, so WorldCanvas did not change. Also: startTour(from?), backTour(). Dwell is clamp(3500+45*chars, 5500, 10000) ms via --tour-dwell. Captions say tap on touch screens. The closing card offers Open Contact, Fly freely from here and Back to <page>. The card is now 620px wide, and its step line ends '· Paused' while paused."
    },
    {
     "id": "E5 (trigger)",
     "status": "done",
     "commits": [
      "e8acb50"
     ],
     "verification": "Prod build at full motion, with a CDP logpoint on the showcase(p,'tour') call in the built chunk: it logged 'showcase about' and 'showcase experience' as the tour landed. Below full motion it is not called. No station listens yet (L4 and L5 add the listeners)."
    },
    {
     "id": "G1+FX16",
     "status": "done",
     "commits": [
      "11be348"
     ],
     "verification": "New @webgl test 'coming back from the tour and free roam': Esc from the tour returns focus to 'Take the tour'; Esc from free roam with focus on a HUD station button returns it to the 'Free roam' button. Passes.",
     "note": "worldMode remembers document.activeElement when a mode starts from page. restoreFocus() runs a frame after inert lifts and tries the remembered element, then .roam-fab, then #main-content, with preventScroll. After arrivedAt (Visit, docking) it focuses #main-content, setting tabIndex -1 if the markup has none."
    },
    {
     "id": "FX35",
     "status": "done",
     "commits": [
      "97e2339"
     ],
     "verification": "New test (chromium project): the .roam-fab is reached within 15 tab stops on /. Passes. .skip-link is inert while the page is hidden.",
     "note": "RoamButton moved to right after <Header> in app/layout.tsx. It is the only element at z-index 41, so paint order does not change."
    },
    {
     "id": "C3",
     "status": "done",
     "commits": [
      "f72efea"
     ],
     "verification": "The leaving-the-tour @webgl test asserts the settled wrapper is transform none and filter none. Passes. Real flights in SwiftShader never reach their approach before the 6.5s cap, so I forced each arrival by patching the chunk through Playwright routing. Mid-reveal the swing measured 7 deg rotateY and -8vw (-102.4px at 1280), entering from the left. Both swing and rush ended at none,none.",
     "note": "hidden carries transformPerspective 1400, and the visible variant's transitionEnd sets it to 0, so the wrapper always ends at transform none."
    },
    {
     "id": "C4",
     "status": "done",
     "commits": [
      "0d39c61",
      "6b4052a"
     ],
     "verification": "Prod build at full motion: html[data-flight='cruise'] is set on navigation flights while the veil's computed opacity is 0, and it clears after approach or end. The follow-up commit excludes the boot warp-in, whose copy is already arriving."
    },
    {
     "id": "FX03",
     "status": "done",
     "commits": [
      "3fcbc36"
     ],
     "verification": "Pixel-sampled contrast on the prod build at 1440x900 (scratch/l2/contrast.mjs: text hidden, text-shadows kept, text colour against every pixel behind each line). Dark theme, worst 10% per line, before -> after: .page-sub 3.01->6.43 on /experience, 3.23->6.49 on /projects, 3.98->>=4.6 on /about; .hero__tag 4.34->7.34 on /. Light theme already measured >=4.5 on all five pages and is unchanged. Still below 4.5: only L10's StationReadout muted spans (see follow-ups)."
    },
    {
     "id": "N7",
     "status": "done",
     "commits": [
      "a6656f4"
     ],
     "verification": "New test (chromium project): with the world off, /skills and /projects/drive-king show .station-fallback and the star sky (::after background-image), and the 'Turn on 3D' button sets data-world 'on'. Passes. Screenshots: both themes at 1440 and 390, plus no-JS /about. The narrow rule for project pages was measured clear of the breadcrumb and eyebrow at 390x844, 390x664, 760x1000 and 844x390.",
     "note": "New app/_stars.scss (star-tile, tile-sizes). The sky shows under html:not([data-world-expected]) or html[data-world='off']. /skills and project pages use the terminal render: a one-prop edit each in Skills.tsx and ProjectPage.tsx. RoamButton reads 'Turn on 3D' when the world is off and only turns it on."
    }
   ],
   "followups": [
    {
     "file": "components/Header/Header.scss",
     "change": "Add html[data-world-mode='returning'] to the .header-scrim hide rule next to the tour and explore entries. World.scss currently holds `html[data-world-mode='returning'] .header-scrim { opacity: 0 }`, which can move into Header.scss.",
     "why": "C5 adds a 'returning' mode in which the header is hidden. Without the rule its scrim band shows over the world while the camera flies back."
    },
    {
     "file": "app/layout.tsx / components/Header (L10 FX34)",
     "change": "Ship <main id=\"main-content\" tabIndex={-1}> with no focus outline, as planned.",
     "why": "restoreFocus() focuses #main-content after Visit or docking. It sets tabIndex -1 itself when missing, but without FX34's outline removal a keyboard user may see the global focus ring round main."
    },
    {
     "file": "components/StationReadout/StationReadout.scss",
     "change": "In the dark theme, use --text-secondary for the muted spans ('Docked at the', 'km from Home'), or give them the same --bg-primary halo World.scss gives .page-sub.",
     "why": "After FX03 they are the only text under 4.5:1: worst 10% is 3.27:1 on /projects and 4.27-4.37:1 on /projects and /contact (dark), and 4.25:1 on /projects (light). The halo alone only reached 3.65:1, so it needs a colour change."
    },
    {
     "file": "components/BootScreen/BootScreen.scss",
     "change": "Replace the local star-tile() with `@use '../../app/stars' as *` (the function is identical).",
     "why": "N7 moved the star tile function into a shared partial for the world-off sky. BootScreen still has its own copy."
    },
    {
     "file": "components/World/World.tsx (L11 N9)",
     "change": "For 'arrive' with the world off, add a small pathname effect on the !active path that emits the cue, or listen to pathname changes in the sound module. Coordinate with L2's World.tsx changes (returning, cruise, focus effects).",
     "why": "The plan points N9 at World.tsx's world-off path, and World.tsx is owned by L2."
    },
    {
     "file": "stations (L4 HomeStation/AboutStation/ExperienceStation/LostStation, L5 SkillsStation/ContactStation)",
     "change": "Subscribe with onShowcase and react to reason 'tour'. The trigger fires 600ms after a tour stop lands, at full motion only.",
     "why": "E5's trigger is in place, but no station listens yet, so nothing visible happens."
    },
    {
     "file": "components/IconifyLoader/iconify-bundle.json",
     "change": "After merging lanes, re-run `node scripts/generate-iconify-bundle.mjs` rather than hand-merging.",
     "why": "L2 regenerated it (adding ph:pause-bold and ph:play-bold), and other lanes may too. It is a generated file."
    }
   ],
   "docNotes": [
    "Modes: html[data-world-mode] gains 'returning'. At full motion, after the tour or free roam hands back, the page stays hidden and inert, with the veil off, until whichever comes first: the flight to its station is on approach or ends, no flight there has started by the third frame, or 6.5s pass. It then fades in over 600ms (a Web Animation, so the header and footer keep their own transitions). Below full motion it comes back at once. Code and CSS asking whether the page is showing should test html[data-world-mode='page'], not the store's mode.",
    "Page snapshot: snapshotPage bails unless html[data-world-mode] is 'page'. The copy has no id, so the rule hiding #main-content does not hide it. The bug (FX09): Visit left the tour, then navigated, so the page the tour had hidden flashed up and flew off with the camera.",
    "PageTransition holds the new page's copy whenever the world is on screen (worldOnScreen), in any mode, so pages opened from the tour or free roam wait for the camera. On approach the copy arrives the way the camera flew: after an about-turn it swings in from the side the camera turns towards (x -sign*8vw, rotateY sign*7deg, perspective 1400px); after an ahead flight it rushes up (scale 0.94, y 16). The wrapper always settles at transform none and filter none: transitionEnd drops the perspective, since a leftover perspective() would make the wrapper the containing block of the page's fixed elements.",
    "Tour: worldMode.startTour(from?) starts at the current station. tourStop is the station index; tourStep counts the stops shown, and tourStep === tourStops.length is the closing card. advanceTour()/backTour() step. The card has Previous stop and Pause (aria-pressed); Space on the card pauses, arrow keys step, Esc exits, and the step line reads '· Paused' while paused. Dwell = clamp(3500 + 45*caption chars, 5500, 10000) ms via --tour-dwell. A stop lands at once below full motion, or when no flight starts by the third frame. Captions say tap instead of click or hover on touch screens. The closing card offers Open Contact, Fly freely from here (free roam in place) and Back to <page>. At full motion TourOverlay calls showcase(station, 'tour') 600ms after landing. Tests start the tour from the palette with fill('guided tour').",
    "Focus: worldMode remembers the focused element when the tour or free roam starts from the page. restoreFocus() runs a frame after the page stops being inert and tries the remembered element, then .roam-fab, then #main-content (preventScroll). After arrivedAt (Visit, docking) focus goes to #main-content.",
    "Tab order: <RoamButton /> renders right after <Header> in app/layout.tsx, so free roam is within 15 tab stops on /. The skip link is inert while the page is hidden.",
    "Cruise: World.tsx sets html[data-flight='cruise'] for page-mode flights longer than 1.6s that follow a navigation. The boot warp-in is excluded because its copy is already arriving. The attribute clears on approach or end, and .world__veil fades to 0 while it is set.",
    "Veil (FX03): in the dark theme at >=900px the veil is 70% at the left edge, 45% at 45% of the width, and gone by 70%. .page-sub and .hero__tag get a --bg-primary halo. The bug: the subtitle's worst 10% measured 3.0:1 over the nebula's core on /experience, 3.2:1 on /projects and 4.0:1 on /about.",
    "World off (N7): under html:not([data-world-expected]) or html[data-world='off'] (no JS, no WebGL, Save-Data, switched off), .world__backdrop carries the loading screen's star tiles from app/_stars.scss (star-tile, tile-sizes) and a still nebula per theme. /skills and the project pages show the terminal render; on narrow layouts a project page's render sits below its breadcrumb. RoamButton reads 'Turn on 3D' when the visitor has switched the world off, and only turns it back on."
   ],
   "risks": [
    "Returning timing: if no flight events come back for the page's station, the page stays hidden for up to 6.5s (the 3-frame check covers a camera already there). It relies on CameraRig starting a flight when the mode changes (retarget on rig.mode !== mode). If L1 changes that, the page waits for the cap.",
    "The C3 arrival poses were checked only by forcing the reveal with a patched chunk. Real approaches in SwiftShader never come before the 6.5s cap, because frames advance at most 1/20s each. The swing direction (the copy enters from the side the camera turns towards, opposite the outgoing ghost) follows the documented sign of flight.turn and should be checked on real hardware.",
    "PageTransition now holds the copy in any mode while the world is on screen. A navigation inside free roam that bypasses navigateFromMode (the browser's Back button) holds the copy up to 6.5s, while explore mode hides the page anyway.",
    "The tour card takes focus when the tour starts and whenever its buttons are replaced (the closing card). It is a polite live region, as before.",
    "Edits outside the files L2 owns: one import and the illustration prop each in components/Skills/Skills.tsx (L12) and components/Projects/ProjectPage/ProjectPage.tsx (L3); the RoamButton move in app/layout.tsx (the plan allows it); a new app/_stars.scss; and a regenerated iconify-bundle.json (adds only ph:pause-bold and ph:play-bold).",
    "Performance: no new post passes or geometry. The world-off sky is about 37 static gradient layers on one fixed element, drawn only with the world off. The returning and tour checks are one-shot rAF polls of 3 frames."
   ],
   "tests": "npm run verify passed (prettier, eslint, stylelint, tsc), and typecheck and lint were run before every commit. The final npm run build passed. Against the prod server on port 3302:\n- chromium project: 100 passed, 0 failed. Specs: world, no-js, a11y, header, skills, projects, motion, resilience, home, about, mobile-menu, palette, contact, seo, space.\n- chromium-webgl project: 10 passed, 0 failed. These were every @webgl test in world.spec (3D toggle; take over and hand back; the guided tour; leaving the tour for a page; focus return; touch thumbsticks; warming a station on a phone), motion.spec's two @webgl tests, and resilience.spec's @webgl test.\n- The @webgl tests in header, mobile-menu and projects were not run, since L2 does not touch what they cover.\n\nNew tests in tests/e2e/world.spec.ts:\n- free roam within 15 tab stops;\n- world-off sky, fallback renders and the 'Turn on 3D' button;\n- @webgl: tour keyboard controls and closing card;\n- @webgl: Visit adds no ghost, goes 'returning' then 'page', and the wrapper settles at transform none;\n- @webgl: focus returns after the tour and free roam.\n\nThrowaway checks in /home/user/wi/scratch/l2:\n- contrast.mjs: pixel-sampled contrast, dark and light, before and after;\n- flightcheck.mjs: CDP logpoint for showcase, plus cruise and veil;\n- arrival-sim.mjs: forced swing and rush arrivals;\n- tour and world-off screenshots.",
   "verifyPassed": true
  },
  "fixes": [
   {
    "startCommit": "6b4052a718ca123c4763cf86817f6ee7032829f0",
    "headCommit": "677f1b3568c3df7968cb08840d425614ce05cd46",
    "pushed": false,
    "verifyPassed": true,
    "results": [
     {
      "title": "After an about-turn, the copy swings in from the wrong side: C3 reads the departure turn, but at approach the camera is turning the other way",
      "outcome": "fixed",
      "commit": "32c384d",
      "note": "Re-ran the simulation on the current flight.ts: in 135 of 135 about-turns the reveal window turns opposite to flight.turn. swingIn now takes the departure turn and enters from that side (x turn*8vw, rotateY -turn*7deg). That is the side the camera turns towards while rounding, and the side the old page left by. The comment explains why."
     },
     {
      "title": "The tour's 5s arrival fallback is shorter than every about-turn, so the wrap stop lands early and the E5 trick fires before the camera arrives",
      "outcome": "fixed",
      "commit": "5e3d8be",
      "note": "The fallback now re-checks every 500ms while a flight to the stop is active and its progress is still moving, and lands otherwise. 'end' still lands the stop. A stale flight whose progress is stuck can't hold the stop."
     },
     {
      "title": "Coming back to a stop whose landing was the last one recorded starts the progress bar before the camera lands",
      "outcome": "fixed",
      "commit": "66bc46e",
      "note": "A render-time stepSeen reset clears landedAt on every tourStep change (no setState in an effect). Scratch check at full motion: after → then ←, .tour__fill--run is absent until the flight back lands, 9.4s later."
     },
     {
      "title": "Space on the closing card silently pauses the tour, and the pause carries back to the last stop",
      "outcome": "fixed",
      "commit": "420be39",
      "note": "The key handler reads worldMode.get().tourStep and toggles pause only on a stop's card. The guided tour e2e test now covers it (677f1b3)."
     },
     {
      "title": "The cruise rule still lifts the veil over visible copy when the world starts after a navigation",
      "outcome": "fixed",
      "commit": "ccf3f1a",
      "note": "A cruise now needs the flight to be going to the station whose copy PageTransition is holding (holdCopy/copyHeldFor in pageSnapshot.ts). loadedOn is removed. Follow-up daf71ea clears the cruise whenever the held copy is released (onCopyHold), since a hold ended by the cap or 'already there' left it on. Scratch check: Turn on 3D after a navigation gives no data-flight change, and a link flight still sets cruise."
     },
     {
      "title": "restoreFocus pulls focus out of the command palette when it is open as the page comes back",
      "outcome": "fixed",
      "commit": "f7b3a5a",
      "note": "restoreFocus now returns early if the active element is still focusable (not body, connected, not inert, rendered). Scratch check: ⌘K during 'returning' keeps focus on the palette combobox. The focus-return e2e test still passes."
     },
     {
      "title": "A page opened from the tour stays blank for 6.5s when the camera is already at its pose (no 'already there' release in PageTransition)",
      "outcome": "fixed",
      "commit": "019d1fe",
      "note": "PageTransition now has World's 3-rAF check. It shows the copy if no flight to the new station is under way by frame 3, or with that flight's arrival if one has already approached. The resilience test needed its precondition hardened (677f1b3): the camera is now made to leave before the test turns back."
     },
     {
      "title": "Cruise still lifts the veil during the warp-in whenever the canvas mounts after a navigation",
      "outcome": "fixed",
      "commit": "ccf3f1a",
      "note": "Duplicate of the cruise finding; same fix (plus daf71ea)."
     },
     {
      "title": "Tour progress bar runs during the flight back after a quick ← / → step",
      "outcome": "fixed",
      "commit": "66bc46e",
      "note": "Duplicate of the landedAt finding; same fix."
     },
     {
      "title": "C3: about-turn copy swings in from the side opposite the one the camera rounds",
      "outcome": "fixed",
      "commit": "32c384d",
      "note": "Duplicate of the C3 direction finding; same fix."
     },
     {
      "title": "E5/E6: tour 'lands' from the 5s fallback before the camera arrives on the 7.3s contact-to-home hop, so the showcase fires mid-flight",
      "outcome": "fixed",
      "commit": "5e3d8be",
      "note": "Duplicate of the arrival-fallback finding; same fix. Polling the live flight state (not a fixed 8.5s) also copes with frame drops that stretch flights."
     }
    ],
    "tests": "npm run verify passed, and typecheck and lint passed before every commit. Two production builds passed under the build lock. chromium project (all specs, 2 workers): 100 passed, 0 failed. chromium-webgl: resilience 'straight back', world.spec take over and hand back, guided tour, leaving the tour, and coming back from the tour and free roam: 5 passed. An earlier run of all 8 WebGL tests in world+resilience passed 7. The resilience test failed once on the 180s timeout under load average 8, then on a re-run hit a real race: Back committed within the first 3 frames of flight, the camera was still within 0.25 of About, and the new 'already there' release rightly showed the copy. The test now waits 6 frames before going back, which keeps its premise of turning back before the approach. Full-motion scratch checks (scratch/l2/review-fixes.mjs): no cruise on the warp-in after Turn on 3D, while a link flight still cruises; the bar waits after ←/→; the palette keeps focus. The C3 direction was verified by simulation only (135/135 about-turns).",
    "followups": [
     {
      "file": "components/World/CameraRig.tsx (L1)",
      "change": "In startFlight, when planFlight returns null, set worldStore.flight.active = false and worldStore.flight.duration = 0 before returning.",
      "why": "After a retarget within 0.25 units (Back within a few frames, or a retarget at the end of a tour flight), the rig drops rig.flight but worldStore.flight stays active with the old to/approached, and 'end' never fires. L2's listeners now cope with that stale state; others may not."
     },
     {
      "file": "components/World/CameraRig.tsx (L1), optional",
      "change": "Publish the approach turn (e.g. worldStore.flight.arriveTurn from the heading rate in fly() before emitting 'approach'), and have PageTransition read it.",
      "why": "PageTransition derives the arrival side from the departure turn, relying on flight.ts's rule that about-turns round the opposite way. A measured value would stay correct if that rule changes."
     }
    ],
    "docNotes": [
     "C3: after an about-turn the copy enters from the side the camera set off turning away from (flight.turn +1, a left departure, means in from the right). By the approach the camera rounds the other way, and the copy moves with the view, on the same side the old page left by.",
     "PageTransition shows the copy if no flight to the new station is under way by the third frame (already there), or one is already on approach, mirroring World's 'returning' check. It records the station whose copy it holds in pageSnapshot.ts (holdCopy / copyHeldFor / onCopyHold).",
     "Cruise: html[data-flight='cruise'] is set on 'start' only for a flight to the station whose copy is held (page mode, over 1.6s). It clears on any other flight event and whenever the held copy is released, so a warp in never lifts the veil over visible copy. Bug: switching the world back on mid-visit counted the warp in as a cruise.",
     "Tour: at full motion a stop lands on its flight's 'end'. The 5s fallback lands only once no flight to the stop is still moving, re-checking every 500ms (bug: 5.2-7.8s about-turns landed early). Each step waits for its own landing, even when revisited. Space pauses only on a stop's card.",
     "Focus: restoreFocus only moves focus when it is lost (body, disconnected, inert or unrendered). Bug: a command palette opened during 'returning' lost focus to the page behind it.",
     "Pre-existing observation, not changed: World's ready state never resets when the canvas unmounts, so after toggling the world off and on, .world--ready (and worldOnScreen) is true before the new canvas has warmed up."
    ]
   }
  ],
  "resume": {
   "round": 2,
   "range": "6b4052a718ca123c4763cf86817f6ee7032829f0..677f1b3568c3df7968cb08840d425614ce05cd46"
  }
 }
}
const doneSet = new Set(['l12', 'l3'])
const mergedOrder = ['l12', 'l3']
let inProgress = 0
for (const k of mergedOrder) laneResults[k] = { lane: k, res: PRIOR[k].res, fixes: PRIOR[k].fixes.map((fix, i) => ({ round: i + 1, confirmed: fix.results.length, fix })), merge: PRIOR[k].merge }

async function runLane(lane) {
  const mergedNow = mergedOrder.slice()
  const prior = PRIOR[lane.key]
  if (prior && prior.resume) return resumeLane(lane, prior)
  let res = await agent(lanePrompt(lane, mergedNow, false), { label: `${lane.key}:implement`, phase: 'Lanes', schema: LANE_SCHEMA, agentType: 'general-purpose' })
  if (!res) {
    log(`${lane.name}: implementation agent did not return; resuming once`)
    res = await agent(lanePrompt(lane, mergedNow, true), { label: `${lane.key}:implement-resume`, phase: 'Lanes', schema: LANE_SCHEMA, agentType: 'general-purpose' })
  }
  if (!res) { log(`${lane.name}: FAILED to implement; not merged`); return { lane: lane.key, failed: 'implement' } }
  const counts = res.items.reduce((a, it) => { a[it.status] = (a[it.status] || 0) + 1; return a }, {})
  log(`${lane.name}: implemented (${JSON.stringify(counts)}); reviewing`)
  const fixes = await reviewLane(lane, res, null)
  return finishLane(lane, res, fixes)
}

async function resumeLane(lane, prior) {
  const res = prior.res
  const resume = { ...prior.resume, fixes: prior.fixes.map((fix, i) => ({ round: i + 1, confirmed: fix.results.length, fix })) }
  if (prior.resume.pendingFix) {
    const pf = prior.resume.pendingFix
    log(`${lane.name}: finishing the interrupted round ${pf.round} fix`)
    const fix = await agent(laneFixPrompt(lane, pf.findings) + `\n\nRESUME NOTE: this fix round was interrupted on another machine. It started at ${pf.startCommit} (report that as startCommit). Commits already made in this round: ${pf.doneCommits}. ${pf.note}`,
      { label: `${lane.key}:fix-r${pf.round}-resume`, phase: 'Lane review', schema: FIX, agentType: 'general-purpose' })
    if (fix) {
      resume.fixes.push({ round: pf.round, confirmed: pf.findings.length, fix })
      resume.range = `${fix.startCommit || pf.startCommit}..${fix.headCommit}`
      resume.round = pf.round + 1
    }
  }
  log(`${lane.name}: resuming review at round ${resume.round} on ${resume.range}`)
  const fixes = await reviewLane(lane, res, resume)
  return finishLane(lane, res, fixes)
}

async function finishLane(lane, res, fixes) {
  const merge = await withMergeLock(() =>
    agent(mergePrompt(lane), { label: `${lane.key}:merge`, phase: 'Merge', schema: MERGE, agentType: 'general-purpose' }))
  if (merge && merge.merged) { mergedOrder.push(lane.key); log(`${lane.name}: merged (${merge.conflicts}); pushed=${merge.pushed}`) }
  else log(`${lane.name}: MERGE FAILED: ${merge ? merge.notes : 'agent died'}`)
  return { lane: lane.key, res, fixes, merge }
}

// ---------- Wave 1: dependency-aware two-worker scheduler ----------
const queue = LANES.filter(l => !doneSet.has(l.key))
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
log(`Resuming Wave 1 on macOS: L12 and L3 already merged; ${queue.length} lanes left, ${WORKERS} at a time`)
await Promise.all(Array.from({ length: WORKERS }, () => worker()))

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

1. Update AGENTS.md (the exhaustive per-feature reference, recording why things are built as they are) and CLAUDE.md (the map; keep it concise) for every behaviour that changed: motion levels, new worldStore fields and events, new components and where they mount, the readability guard, the tour controls, the palette, the footer console, docking, signals and scan, the sector edge, the cockpit, the course line, the sound bus, spatial cues and haptics, the new e2e tests, and any new easy-to-break rules with the bug behind each. Use the doc notes below and the lane reports in ${WI}/reports/*.md, and check every statement against the code (no claims you have not verified). Follow the files' existing style and the copy rules (British spelling; no em-dashes in user-facing text).
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
