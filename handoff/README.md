# World immersion pass: handoff from the cloud to the Mac

Written 9 Oct 2026, ~18:45 UTC, when the cloud run was stopped so the rest can run faster on the Mac (more
parallel agents, real-GPU WebGL). Plan: `docs/superpowers/plans/2026-10-09-world-immersion.md`.

## Where things stand

| Lane | State | Where |
|---|---|---|
| Wave 0 (foundation) | done | `claude/world-immersion-rpta9t` |
| L12 PAGE | implemented (11/11), reviewed (1 fix round), **merged** | `claude/world-immersion-rpta9t` (`0cff753`) |
| L3 PRJ | implemented (16/17 done, FX39 partial), reviewed (3 fix rounds), **merged** | `claude/world-immersion-rpta9t` (`5c40f99`) |
| L1 CAM | implemented (13/13), review round 1 fixed; round 2 found 1 confirmed major (B15 index ride turns ~20° the wrong way); fix `9743b66` committed but the fix agent was interrupted | `origin/claude/wi-l1` (head `9743b66`, base `0cff753`) |
| L2 TRN | implemented (9/9), review round 1 fixed (`677f1b3`); round 2 review had just started | `origin/claude/wi-l2` (head `677f1b3`, base `5c40f99`) |
| L4, L5, L6, L7, L8, L9, L10, L11 | not started | |
| Wave 2 (Task 90 follow-ups, 91 verify, QA, 92 review, 99 docs) | not started | |

Everything is pushed: the integration branch `claude/world-immersion-rpta9t` (50 commits over `ceb02b8`) and
the two in-flight lane branches. No dependency changes so far (`package.json` / lockfile untouched).

Baseline e2e on the foundation: 97/98, see `baseline-e2e.md` (one `@webgl` mobile-menu test to investigate).

The lane reports written so far are in `reports/` (l1, l2, l3, l12), and the structured results the cloud run
collected (item status, cross-lane follow-ups, doc notes, risks, test results) are in `lane-results.json`;
they are also baked into the workflow script, so Task 90 and the docs step get them.

## How the run is organised (same as in the cloud)

`world-immersion-pass-mac.js` is a Workflow script. It:

1. resumes **L1** (finishes the interrupted round-2 fix, then reviews the fix) and **L2** (review round 2 on
   its round-1 fixes), then runs **L4–L11**, `args.workers` lanes at a time (default 4), respecting
   dependencies (L4, L6 after L12; L9 after L8; L11 after L4, L5, L8, L9). Each lane: implement in its own
   worktree → 3-lens review (correctness, project rules, plan fidelity) → adversarial verification of every
   finding (2 skeptics + tiebreak for major/blocker, 1 for minor) → fix → re-review the fixes, up to 3 rounds
   → serialized merge into `claude/world-immersion-rpta9t`, typecheck/lint/build, push.
2. Task 90: cross-lane follow-ups and a checklist of known joins between lanes.
3. Task 91: `npm run verify`, build, full e2e, fix failures (never by loosening tests).
4. QA sweeps (desktop, phone/touch, degradation/a11y/contrast, perf vs a baseline build of `ceb02b8`) →
   verify → fix.
5. Task 92: six-dimension review of `ceb02b8..HEAD` → dedup → verify → fix, loop until dry (max 3 rounds).
6. Final full verification, then Task 99 docs (AGENTS.md, CLAUDE.md, plan checkboxes), push.

It does **not** open the PR: the session that runs it does, after reading its result (see the end).

## Setup on the Mac (once)

Paths assumed: repo `~/Workspace/portfolio-next` (= `/Users/lewis/Workspace/portfolio-next`), lane worktrees
in `~/Workspace/wi-worktrees/`, briefs/reports/scratch in `~/Workspace/wi/`. If yours differ, replace
`/Users/lewis/Workspace` in `lane-brief.md` and `world-immersion-pass-mac.js` before starting.

```sh
cd ~/Workspace/portfolio-next
git status   # the old local branch claude/world-immersion may show an untracked bun.lockb: leave it, never commit it
git fetch origin
git switch -c claude/world-immersion-rpta9t --track origin/claude/world-immersion-rpta9t   # or: git switch claude/world-immersion-rpta9t && git pull --ff-only
nvm use              # Node 24 (.nvmrc)
npm ci
npx playwright install chromium
cp -n .env.SAMPLE .env   # if there is no .env yet

# handoff files -> ~/Workspace/wi (lane-brief.md, reports/, handoff/)
mkdir -p ~/Workspace/wi/scratch ~/Workspace/wi-worktrees
git archive origin/claude/wi-handoff | tar -x -C ~/Workspace/wi

# lane worktrees
for l in l1 l2; do git worktree add -b claude/wi-$l ~/Workspace/wi-worktrees/$l origin/claude/wi-$l; done
for l in l4 l5 l6 l7 l8 l9 l10 l11; do git worktree add -b claude/wi-$l ~/Workspace/wi-worktrees/$l claude/world-immersion-rpta9t; done
for l in l1 l2 l4 l5 l6 l7 l8 l9 l10 l11; do
  cp -c -R node_modules ~/Workspace/wi-worktrees/$l/node_modules
  cp .env ~/Workspace/wi-worktrees/$l/
  mkdir -p ~/Workspace/wi/scratch/$l
done
```

Keep the Mac awake and plugged in for the whole run (`caffeinate -dims` in a spare terminal).

## Starting it

Open Claude Code in `~/Workspace/portfolio-next` with ultracode on, and ask it to:

> Read `~/Workspace/wi/handoff/README.md`, then resume the world immersion pass by running the workflow at
> `~/Workspace/wi/handoff/world-immersion-pass-mac.js` (pass it as `scriptPath`) with
> `args: { trailers: "<the commit trailer lines this session uses>" }`. When it finishes, check the result,
> fix anything it left red, and open the PR.

`args`:

- `trailers` (required): the exact lines to end every commit with, e.g.
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` plus the session's `Claude-Session:` line if it has one.
- `workers` (default 4): lanes in flight at once. The workflow itself runs at most (cores − 2) agents at a time.
- `light` (default false): one skeptic per finding and at most 2 review rounds per lane; roughly 30–40% faster.

## When it finishes: the PR (Lewis asked for one)

- Base `main`, head `claude/world-immersion-rpta9t`. No PR template in the repo.
- Title: a plain-English sentence about the visible effect, e.g. "The 3D world wraps every page: flights,
  stations, free roam and chrome all react to what you read and do".
- Body: what was wrong or missing and what each area changed (one short section per lane: page, transitions
  and tour, camera, projects, stations, sky, free roam, signals, chrome, sound), the motion levels, the test
  results (verify, build, full e2e numbers), perf measurements from the QA perf sweep, and every item that
  ended partial or skipped with the reason (FX39 is partial already). Squash-merged, so the title becomes the
  commit title.
- Then watch CI (verify, build, e2e) and fix anything red.

## Notes

- C11 decision (L1, already applied): the flight fog change was made in `ExploreControls.tsx` (L8's file) rather
  than relying on component mount order; L8 must keep it.
- `l1-uncommitted-debug.diff`: throwaway instrumentation the interrupted L1 fix agent had in its tree
  (discarded; kept only for context).
- `cloud-run-script.js` is the original cloud workflow, for reference.
