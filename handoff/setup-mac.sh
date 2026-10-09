#!/usr/bin/env bash
# One-time Mac setup for resuming the world immersion pass. Safe to re-run: every step checks what is
# already there. Stops at the first failure with a message saying which step failed.
# Override the paths with REPO=..., WT=..., WI=... if yours differ.
set -uo pipefail

REPO="${REPO:-$HOME/Workspace/portfolio-next}"
WT="${WT:-$HOME/Workspace/wi-worktrees}"
WI="${WI:-$HOME/Workspace/wi}"
BR=claude/world-immersion-rpta9t

fail() { echo; echo "SETUP FAILED: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

cd "$REPO" || fail "no repository at $REPO (run with REPO=/path/to/portfolio-next)"

step "Fetching"
git fetch origin || fail "git fetch origin"
git worktree prune

step "Integration branch $BR"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no
  fail "$REPO has uncommitted changes to tracked files: commit or stash them, then re-run"
fi
if git show-ref --verify --quiet "refs/heads/$BR"; then
  git switch "$BR" || fail "git switch $BR"
  git merge --ff-only "origin/$BR" || fail "fast-forward $BR to origin/$BR"
else
  git switch -c "$BR" --track "origin/$BR" || fail "create $BR from origin/$BR"
fi
git log --oneline -1

step "Node and dependencies"
echo "node $(node -v)"
case "$(node -v)" in v24.*) ;; *) echo "WARNING: .nvmrc wants Node 24 (try: nvm use). Continuing." ;; esac
npm ci || fail "npm ci"
npx playwright install chromium || fail "npx playwright install chromium"
[ -f .env ] || cp .env.SAMPLE .env

step "Handoff files into $WI"
mkdir -p "$WI/scratch" "$WT" || fail "mkdir $WI / $WT"
git archive origin/claude/wi-handoff | tar -x -C "$WI" || fail "extract origin/claude/wi-handoff"
ls "$WI" "$WI/handoff"

step "Lane worktrees in $WT"
for l in l1 l2 l4 l5 l6 l7 l8 l9 l10 l11; do
  dir="$WT/$l"
  b="claude/wi-$l"
  case "$l" in l1 | l2) start="origin/$b" ;; *) start="$BR" ;; esac
  if [ -e "$dir/.git" ]; then
    echo "$l: worktree already exists"
  elif git show-ref --verify --quiet "refs/heads/$b"; then
    git worktree add "$dir" "$b" || fail "git worktree add $dir $b"
  else
    git worktree add -b "$b" "$dir" "$start" || fail "git worktree add -b $b $dir $start"
  fi
  if [ "$l" = l1 ] || [ "$l" = l2 ]; then
    [ "$(git rev-parse "$b")" = "$(git rev-parse "origin/$b")" ] || echo "WARNING: $b differs from origin/$b"
  fi
  [ -d "$dir/node_modules" ] || cp -c -R node_modules "$dir/node_modules" || fail "clone node_modules into $dir"
  cp .env "$dir/.env" || fail "copy .env into $dir"
  mkdir -p "$WI/scratch/$l"
done

step "Done"
git worktree list
echo
echo "Next: keep the Mac awake (caffeinate -dims), open Claude Code in $REPO with ultracode on, and give it the"
echo "prompt in $WI/handoff/README.md (\"Starting it\")."
