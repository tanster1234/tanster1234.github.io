#!/bin/zsh
# Build the site and publish dist/ to the `master` branch (what GitHub Pages serves).
# Keeps master's history: dist is synced into a worktree of master, committed, and pushed.
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DEPLOY="$ROOT/../_deploy"
MSG=${1:-"Deploy site from source $(git rev-parse --short HEAD)"}

npm run build
git fetch origin master
if [[ ! -e "$DEPLOY/.git" ]]; then
  git worktree add -B master "$DEPLOY" origin/master
else
  git -C "$DEPLOY" checkout -q master && git -C "$DEPLOY" reset -q --hard origin/master
fi
rsync -a --delete --exclude '.git' dist/ "$DEPLOY/"
touch "$DEPLOY/.nojekyll"          # Pages must not run Jekyll: it would drop the _astro/ folder
git -C "$DEPLOY" add -A
if git -C "$DEPLOY" diff --cached --quiet; then echo "nothing to deploy"; exit 0; fi
git -C "$DEPLOY" commit -q -m "$MSG" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
GIT_TERMINAL_PROMPT=0 git -C "$DEPLOY" push origin master
echo "pushed to master: $(git -C "$DEPLOY" rev-parse --short HEAD)"
