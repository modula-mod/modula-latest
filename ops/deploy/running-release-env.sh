#!/usr/bin/env bash
# GF-OPS-01: print the non-secret release identity of the running production
# API container as shell exports, so ad-hoc `docker compose -f
# ops/docker/compose.production.yml <ps|logs|exec|run ...>` commands interpolate
# the same values the deploy used. compose.production.yml has no defaults for
# these values and refuses to start without them.
#
#   eval "$(ops/deploy/running-release-env.sh)"
#
# Read-only: docker inspect only. Prints labels, never environment secrets.
set -euo pipefail
CONTAINER="${MODULA_API_CONTAINER:-modula-production-greenfield-api-1}"
label() {
  docker inspect --format "{{ index .Config.Labels \"$1\" }}" "${CONTAINER}"
}
sha="$(label org.opencontainers.image.revision)"
built="$(label org.opencontainers.image.created)"
release_id="$(label org.opencontainers.image.version)"
migration="$(label org.modula.migration.expected)"
[[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || { echo "running ${CONTAINER} has no exact revision label" >&2; exit 1; }
[[ "${migration}" =~ ^[0-9]{3}_[a-z0-9_]+$ ]] || { echo "running ${CONTAINER} has no expected-migration label" >&2; exit 1; }
[[ -n "${built}" ]] || { echo "running ${CONTAINER} has no build timestamp label" >&2; exit 1; }
printf 'export SOURCE_RELEASE_SHA=%q\n' "${sha}"
printf 'export SOURCE_BUILT_AT=%q\n' "${built}"
printf 'export SOURCE_RELEASE_ID=%q\n' "${release_id:-${sha}}"
printf 'export SOURCE_EXPECTED_MIGRATION=%q\n' "${migration}"
