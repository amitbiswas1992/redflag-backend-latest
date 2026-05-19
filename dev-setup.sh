#!/usr/bin/env bash

set -e

MARKER="$HOME/.redflag-dev-setup-done"

if [[ ! -f "$MARKER" ]]; then
  npm install --global --yes corepack@latest
  corepack enable pnpm
else
  echo "Dev setup already done. Delete $MARKER to re-run."
fi

pnpm install --yes
pnpm drizzle-kit push


if [[ ! -f "$MARKER" ]]; then
  pnpm ts-node scripts/seed-rules.ts
  touch "$MARKER"
fi