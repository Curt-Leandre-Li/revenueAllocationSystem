#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/Users/apple/Desktop/data-revenue-allocation-system-v2"
WORKTREE_ROOT="/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees"

cd "$REPO_ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: $REPO_ROOT is not a git repository."
  echo "Initialize or clone the repository before creating agent worktrees."
  exit 1
fi

echo "Repository: $REPO_ROOT"
echo
echo "Current git status:"
git status --short
echo

mkdir -p "$WORKTREE_ROOT"

create_agent_worktree() {
  local branch="$1"
  local path="$2"

  echo "==> $branch -> $path"

  if git worktree list --porcelain | grep -Fxq "worktree $path"; then
    echo "SKIP: worktree already registered at $path"
    return 0
  fi

  if [ -e "$path" ]; then
    echo "SKIP: path already exists and will not be overwritten: $path"
    return 0
  fi

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    echo "Branch exists; reusing local branch $branch"
    git worktree add "$path" "$branch"
  else
    echo "Creating branch $branch"
    git worktree add -b "$branch" "$path" HEAD
  fi
}

create_agent_worktree "agent/pm-strategy" "$WORKTREE_ROOT/pm-strategy"
create_agent_worktree "agent/prd" "$WORKTREE_ROOT/prd"
create_agent_worktree "agent/ui-designer" "$WORKTREE_ROOT/ui-designer"
create_agent_worktree "agent/frontend" "$WORKTREE_ROOT/frontend"
create_agent_worktree "agent/backend" "$WORKTREE_ROOT/backend"
create_agent_worktree "agent/qa" "$WORKTREE_ROOT/qa"
create_agent_worktree "agent/docs" "$WORKTREE_ROOT/docs"
create_agent_worktree "agent/compliance-audit" "$WORKTREE_ROOT/compliance-audit"

echo
echo "Registered worktrees:"
git worktree list

echo
echo "Next steps:"
echo "1. Open each worktree in a separate Codex session only after PM assigns a scoped task."
echo "2. Keep each agent within its assigned file boundaries."
echo "3. Inspect diffs before any merge."
echo "4. Do not push, merge, or commit without explicit user approval."
