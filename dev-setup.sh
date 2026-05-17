#!/usr/bin/env bash

set -e

MARKER="$HOME/.redflag-dev-setup-done"

if [[ ! -f "$MARKER" ]]; then
  npm install --global --yes corepack@latest
  corepack enable pnpm
  pnpm approve-builds --yes
  pnpm install --yes
  touch "$MARKER"
else
  echo "Dev setup already done. Delete $MARKER to re-run."
fi