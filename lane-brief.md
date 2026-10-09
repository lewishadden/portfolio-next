# Lane brief (World Immersion pass, Wave 1)

You are implementing ONE lane of the plan at `docs/superpowers/plans/2026-10-09-world-immersion.md`
(read the Global Constraints, the Interface contract, and your lane's section in full before starting).
Wave 0 (the foundation: Tasks 0.1, 0.2, 0.3 incl. N1 and the A15 menu pause) is already committed on the
base branch; every interface in the contract exists. Read CLAUDE.md first, and the AGENTS.md paragraphs for
every subsystem you touch.

## Environment (macOS)

- macOS (Apple Silicon), shared with up to three other lanes running at the same time plus merge builds.
- Your worktree: `/Users/lewis/Workspace/wi-worktrees/<lane>` on branch `claude/wi-<lane>` (already created,
  node_modules APFS-cloned, `.env` present). Work and commit ONLY there. Never touch
  `/Users/lewis/Workspace/portfolio-next` (the integration checkout) or another lane's worktree. Never push, never
  open PRs.
- Your port: given in your task. Start the prod server with `npx next start -p <port>` from your worktree, in the
  background, and kill it when done (`pkill -f "next start -p <port>"`).
- Build lock (at most 3 builds at once on the machine). Always wrap builds:
  `until mkdir /tmp/wi-build-1 2>/dev/null && L=1 || { mkdir /tmp/wi-build-2 2>/dev/null && L=2; } || { mkdir /tmp/wi-build-3 2>/dev/null && L=3; }; do sleep 5; done; npm run build; rmdir /tmp/wi-build-$L`
  (make sure you remove the lock dir you took, on failure too).
  Build only when you need to check behaviour (batch several items per build), not after every edit.
- Headless browser: your own Playwright scripts with Playwright's Chromium (installed once with
  `npx playwright install chromium`), launched with `--use-angle=metal` for real-GPU WebGL. Never use the shared
  in-app browser. Use the stats overlay (Alt+Shift+S) or `html` data attributes for counts. Write throwaway scripts
  under `/Users/lewis/Workspace/wi/scratch/<lane>/`, never in the repo. See `tests/e2e/fixtures.ts` for how tests
  turn the world on/off and skip the loading screen.
- e2e: `PLAYWRIGHT_BASE_URL=http://localhost:<port> npx playwright test <spec> --reporter=line`. Run the specs your
  files touch. `@webgl` tests run in the `chromium-webgl` project (SwiftShader flags, slow); run only the ones
  relevant to you.
- Perf: measure on the prod build as the plan asks (M-series GPU). Where a measurement is noisy, also verify the
  mechanism (compiled in warm-up, banded upload, etc.) and say so in the report.

## Before you start (workflow run)

- This lane is run by an orchestrating workflow: other lanes run at the same time, and lanes that finish are
  merged into the integration branch `claude/world-immersion-rpta9t` (checked out at
  `/Users/lewis/Workspace/portfolio-next`, which you must never touch). Start by bringing your branch up to date
  with what has been merged so far:
  `git -C /Users/lewis/Workspace/wi-worktrees/<lane> merge --ff-only claude/world-immersion-rpta9t` (if it can't
  fast-forward, do a normal merge). Record `git rev-parse HEAD` after that as your **baseCommit**: your diff is baseCommit..HEAD.
  Lanes merged before yours are therefore already in your tree: build on them rather than leaving no-ops.
- If `/Users/lewis/Workspace/wi/reports/<lane>.md` already exists, it is a progress report from an earlier,
  paused attempt (for L1, L3 and L12 no code was written in that attempt): read its notes first, then overwrite it
  with your final report.
- Decision for C11 (lane L1): the fog code in `ExploreControls.tsx` (L8's file) resets fog every frame outside
  free roam. L1 may make the one small change there so its fog target allows for an active flight (do not rely on
  component mount order); L8 must keep that behaviour. Note it in the report.
- Never run `npm install` / `npm ci` in a worktree: node_modules is cloned from the integration checkout.

## Rules

- Stay inside the files your lane owns (listed in the plan). If an item genuinely needs a change in another
  lane's file, make the smallest change only if the plan says so; otherwise describe the exact change needed in
  your report under "Cross-lane follow-ups".
- Do not edit AGENTS.md or CLAUDE.md. Put doc notes in your report.
- One commit per item (or per bracketed item group as the plan lists them), title = plain-English sentence about
  the visible effect + item IDs in brackets, e.g. `Sector map hides once the page arrives (FX04)`. Body: what was
  wrong or missing, and what changed. End every commit message with exactly the trailer lines given in your task
  prompt (after a blank line).

  Do not put any model name anywhere else (code, comments, report).
- Before each commit: `npm run typecheck && npm run lint` must pass; run `npx prettier --write` on the files you
  changed (SCSS included).
- If an item proves impossible, unsafe or far larger than described, do a sound smaller version or skip it, and
  explain in the report. Never leave the branch broken. Never weaken or skip existing tests.
- Every item must hold at all three motion levels (full, calm, still), with the world off, without JS and on
  lite devices, per the Global Constraints.

## At the end

1. `npm run verify` passes; a final build passes; the e2e specs for your area pass against your server
   (list which ones and the result).
2. Write your report to `/Users/lewis/Workspace/wi/reports/<lane>.md`:
   - per item: done / partial / skipped, the commit hash, how you verified it;
   - Cross-lane follow-ups (exact file, change and why);
   - Doc notes for AGENTS.md / CLAUDE.md (behaviour that changed, new rules and the bug behind them);
   - anything risky a reviewer should look at.
3. Kill your server and any Playwright processes you started; make sure you hold no build lock and the worktree
   is clean (everything committed). Return the structured result you are asked for.
