#!/usr/bin/env bash

set -euo pipefail

PROJECT_SLUG="${PROJECT_SLUG:-redflag}"
PROJECT_ROOT="${PROJECT_ROOT:-/opt/projects/${PROJECT_SLUG}}"
DEPLOY_BUNDLE_DIR="${DEPLOY_BUNDLE_DIR:?DEPLOY_BUNDLE_DIR is required}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY is required}"

EXISTING_DEPLOY_ENV="${PROJECT_ROOT}/compose/.deploy.env"
EXISTING_BACKEND_IMAGE_TAG=""
EXISTING_FRONTEND_IMAGE_TAG=""
EXISTING_KEYCLOAK_IMAGE_TAG=""

if [[ -f "${EXISTING_DEPLOY_ENV}" ]]; then
  EXISTING_BACKEND_IMAGE_TAG="$(grep -E '^BACKEND_IMAGE_TAG=' "${EXISTING_DEPLOY_ENV}" | tail -n1 | cut -d= -f2- || true)"
  EXISTING_FRONTEND_IMAGE_TAG="$(grep -E '^FRONTEND_IMAGE_TAG=' "${EXISTING_DEPLOY_ENV}" | tail -n1 | cut -d= -f2- || true)"
  EXISTING_KEYCLOAK_IMAGE_TAG="$(grep -E '^KEYCLOAK_IMAGE_TAG=' "${EXISTING_DEPLOY_ENV}" | tail -n1 | cut -d= -f2- || true)"
fi

IMAGE_TAG="${IMAGE_TAG:-}"
BACKEND_IMAGE_TAG="${BACKEND_IMAGE_TAG:-${IMAGE_TAG:-${EXISTING_BACKEND_IMAGE_TAG}}}"
FRONTEND_IMAGE_TAG="${FRONTEND_IMAGE_TAG:-${IMAGE_TAG:-${EXISTING_FRONTEND_IMAGE_TAG:-master}}}"
KEYCLOAK_IMAGE_TAG="${KEYCLOAK_IMAGE_TAG:-${IMAGE_TAG:-${EXISTING_KEYCLOAK_IMAGE_TAG:-master}}}"
DEPLOY_FRONTEND="${DEPLOY_FRONTEND:-false}"

if [[ -z "${BACKEND_IMAGE_TAG}" ]]; then
  echo "BACKEND_IMAGE_TAG is required for deployment."
  exit 1
fi

CADDYFILE_PATH="${CADDYFILE_PATH:-/etc/caddy/Caddyfile}"
CADDY_SNIPPETS_DIR="${CADDY_SNIPPETS_DIR:-/etc/caddy/sites}"
CADDY_SERVICE_NAME="${CADDY_SERVICE_NAME:-caddy}"

FRONTEND_BIND_PORT="${FRONTEND_BIND_PORT:-18100}"
API_BIND_PORT="${API_BIND_PORT:-18101}"
IDENTITY_BIND_PORT="${IDENTITY_BIND_PORT:-18102}"
KEYCLOAK_BIND_PORT="${KEYCLOAK_BIND_PORT:-18103}"

FRONTEND_DOMAIN="${FRONTEND_DOMAIN:?FRONTEND_DOMAIN is required}"
API_DOMAIN="${API_DOMAIN:?API_DOMAIN is required}"
IDENTITY_DOMAIN="${IDENTITY_DOMAIN:?IDENTITY_DOMAIN is required}"
KEYCLOAK_DOMAIN="${KEYCLOAK_DOMAIN:-}"

trim_value() {
  printf '%s' "$1" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'
}

validate_site_address() {
  local name="$1"
  local value

  value="$(trim_value "$2")"
  if [[ -z "${value}" ]]; then
    echo "${name} is empty after trimming whitespace."
    exit 1
  fi

  if [[ "${value}" == "{" || "${value}" == "}" ]]; then
    echo "${name} is invalid: '${value}'."
    exit 1
  fi

  printf '%s' "${value}"
}

FRONTEND_DOMAIN="$(validate_site_address "FRONTEND_DOMAIN" "${FRONTEND_DOMAIN}")"
API_DOMAIN="$(validate_site_address "API_DOMAIN" "${API_DOMAIN}")"
IDENTITY_DOMAIN="$(validate_site_address "IDENTITY_DOMAIN" "${IDENTITY_DOMAIN}")"
KEYCLOAK_DOMAIN="$(trim_value "${KEYCLOAK_DOMAIN}")"

SUDO_BIN=""

prepare_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then
    return
  fi

  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    SUDO_BIN="sudo"
    return
  fi

  echo "This deployment requires root-level access to manage Caddy files and service reload."
  echo "Run as root, or configure passwordless sudo for the deploy user."
  exit 1
}

run_root() {
  if [[ -n "${SUDO_BIN}" ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

sync_project_files() {
  mkdir -p "${PROJECT_ROOT}/compose" "${PROJECT_ROOT}/env"

  cp "${DEPLOY_BUNDLE_DIR}/deployment/redflag/docker-compose.vps.yml" "${PROJECT_ROOT}/compose/docker-compose.yml"

  for env_name in backend frontend keycloak keycloak-db; do
    local target_file="${PROJECT_ROOT}/env/${env_name}.env"
    if [[ ! -f "${target_file}" ]]; then
      cp "${DEPLOY_BUNDLE_DIR}/deployment/redflag/env/${env_name}.env.example" "${target_file}"
      echo "Created missing env file: ${target_file}. Fill values and rerun deployment."
      exit 1
    fi
  done

  cat >"${PROJECT_ROOT}/compose/.deploy.env" <<EOF
IMAGE_REGISTRY=${IMAGE_REGISTRY}
BACKEND_IMAGE_TAG=${BACKEND_IMAGE_TAG}
FRONTEND_IMAGE_TAG=${FRONTEND_IMAGE_TAG}
KEYCLOAK_IMAGE=${IMAGE_REGISTRY}/keycloak:${KEYCLOAK_IMAGE_TAG}
FRONTEND_BIND_PORT=${FRONTEND_BIND_PORT}
API_BIND_PORT=${API_BIND_PORT}
IDENTITY_BIND_PORT=${IDENTITY_BIND_PORT}
KEYCLOAK_BIND_PORT=${KEYCLOAK_BIND_PORT}
EOF
}

pull_and_deploy_stack() {
  local pull_services=(redis keycloak-db keycloak redflag-core redflag-identity)
  local up_services=(redis keycloak-db keycloak redflag-core redflag-identity)

  if [[ "${DEPLOY_FRONTEND}" == "true" ]]; then
    pull_services+=(redflag-frontend)
    up_services+=(redflag-frontend)
  fi

  if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
    echo "${GHCR_TOKEN}" | docker login ghcr.io --username "${GHCR_USERNAME}" --password-stdin >/dev/null
  fi

  docker compose \
    --project-name "${PROJECT_SLUG}" \
    --env-file "${PROJECT_ROOT}/compose/.deploy.env" \
    -f "${PROJECT_ROOT}/compose/docker-compose.yml" \
    pull "${pull_services[@]}"

  docker compose \
    --project-name "${PROJECT_SLUG}" \
    --env-file "${PROJECT_ROOT}/compose/.deploy.env" \
    -f "${PROJECT_ROOT}/compose/docker-compose.yml" \
    up -d --remove-orphans "${up_services[@]}"
}

ensure_caddy_import() {
  if [[ ! -f "${CADDYFILE_PATH}" ]]; then
    echo "Caddyfile not found at ${CADDYFILE_PATH}. Install/configure host Caddy first."
    exit 1
  fi

  run_root mkdir -p "${CADDY_SNIPPETS_DIR}"
  run_root chmod 755 "${CADDY_SNIPPETS_DIR}"

  local import_line="import ${CADDY_SNIPPETS_DIR}/*.caddy"
  if run_root grep -Fqx "${import_line}" "${CADDYFILE_PATH}"; then
    return
  fi

  run_root cp "${CADDYFILE_PATH}" "${CADDYFILE_PATH}.bak"
  run_root sh -c "printf '\n%s\n' '${import_line}' >> '${CADDYFILE_PATH}'"
}

render_caddy_site_and_reload() {
  run_root mkdir -p "${CADDY_SNIPPETS_DIR}"
  run_root chmod 755 "${CADDY_SNIPPETS_DIR}"

  local snippet_file="${CADDY_SNIPPETS_DIR}/${PROJECT_SLUG}.caddy"
  local backup_file=""
  local tmp_file

  tmp_file="$(mktemp)"
  trap 'rm -f "${tmp_file:-}"' EXIT

  if run_root test -f "${snippet_file}"; then
    backup_file="$(mktemp)"
    run_root cp "${snippet_file}" "${backup_file}"
  fi

  cat >"${tmp_file}" <<EOF
${FRONTEND_DOMAIN} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:${FRONTEND_BIND_PORT}
}

${API_DOMAIN} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:${API_BIND_PORT}
}

${IDENTITY_DOMAIN} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:${IDENTITY_BIND_PORT}
}
EOF

  if [[ -n "${KEYCLOAK_DOMAIN}" ]]; then
    cat >>"${tmp_file}" <<EOF

${KEYCLOAK_DOMAIN} {
  encode zstd gzip
  reverse_proxy 127.0.0.1:${KEYCLOAK_BIND_PORT}
}
EOF
  fi

  run_root cp "${tmp_file}" "${snippet_file}"
  run_root chmod 644 "${snippet_file}"

  local caddy_validate_output
  if ! caddy_validate_output="$(run_root caddy validate --config "${CADDYFILE_PATH}" 2>&1)"; then
    if [[ -n "${backup_file}" ]]; then
      run_root cp "${backup_file}" "${snippet_file}"
      run_root chmod 644 "${snippet_file}"
    else
      run_root rm -f "${snippet_file}"
    fi

    echo "${caddy_validate_output}" >&2
    if grep -q "server block without any key is global configuration" <<<"${caddy_validate_output}"; then
      echo "Hint: ensure the global options block '{ ... }' appears only in ${CADDYFILE_PATH} and is the first block in that file." >&2
      echo "Also check ${CADDY_SNIPPETS_DIR}/*.caddy for accidental standalone '{ ... }' blocks." >&2
    fi

    echo "Caddy validation failed. Existing project snippet has been restored."
    exit 1
  fi

  if run_root systemctl status "${CADDY_SERVICE_NAME}" >/dev/null 2>&1; then
    if run_root systemctl is-active --quiet "${CADDY_SERVICE_NAME}"; then
      if ! run_root systemctl reload "${CADDY_SERVICE_NAME}"; then
        echo "Failed to reload ${CADDY_SERVICE_NAME}. Showing recent status and logs:" >&2
        run_root systemctl status "${CADDY_SERVICE_NAME}" --no-pager -n 50 >&2 || true
        run_root journalctl -xeu "${CADDY_SERVICE_NAME}" --no-pager -n 50 >&2 || true
        exit 1
      fi
    else
      if ! run_root systemctl restart "${CADDY_SERVICE_NAME}"; then
        echo "Failed to restart ${CADDY_SERVICE_NAME}. Showing recent status and logs:" >&2
        run_root systemctl status "${CADDY_SERVICE_NAME}" --no-pager -n 50 >&2 || true
        run_root journalctl -xeu "${CADDY_SERVICE_NAME}" --no-pager -n 50 >&2 || true
        exit 1
      fi
    fi
  else
    echo "Caddy service ${CADDY_SERVICE_NAME} is not managed by systemd. Reload it manually."
  fi
}

main() {
  prepare_sudo
  sync_project_files
  pull_and_deploy_stack
  ensure_caddy_import
  render_caddy_site_and_reload

  echo "Deployment completed for ${PROJECT_SLUG} with backend tag ${BACKEND_IMAGE_TAG} and frontend tag ${FRONTEND_IMAGE_TAG}."
}

main
