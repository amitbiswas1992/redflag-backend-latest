#!/usr/bin/env bash

set -e

export DOCKER_PNPM_STORE="$HOME/.docker-pnpm-store"
export DOCKER_COREPACK="$HOME/.docker-corepack"

if [[ " $* " == *" up "* ]]; then
  docker compose -f docker-compose-dev.yml run --rm redflag-core bash dev-setup.sh
fi

docker compose -f docker-compose-dev.yml "$@"