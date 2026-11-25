#!/usr/bin/env sh
# Activates repository-managed Git hooks (including .githooks/pre-push).

set -eu

REPO_ROOT="$(git rev-parse --show-toplevel)"
chmod +x "$REPO_ROOT/.githooks/pre-push" "$REPO_ROOT/scripts/ai_review/run_review.py"
git -C "$REPO_ROOT" config core.hooksPath .githooks

echo "Configured core.hooksPath=.githooks for $REPO_ROOT"

if ! command -v agy >/dev/null 2>&1; then
  echo "WARNING: 'agy' CLI not found in PATH. Install Antigravity CLI before pushing:" >&2
  echo "  curl -fsSL https://antigravity.google/cli/install.sh | bash" >&2
fi
