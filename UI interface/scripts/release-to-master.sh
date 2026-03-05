#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit or stash changes before release."
  exit 1
fi

echo "Fetching latest refs from origin..."
git fetch origin

echo "Switching to master..."
git checkout master

echo "Syncing master with origin/master..."
git pull --ff-only origin master

echo "Merging origin/main into master..."
git merge --no-ff origin/main -m "Merge main into master for daily release"

echo "Pushing master to origin..."
git push origin master

if [[ "$CURRENT_BRANCH" != "master" ]]; then
  echo "Switching back to $CURRENT_BRANCH..."
  git checkout "$CURRENT_BRANCH"
fi

echo "Release merge complete."
