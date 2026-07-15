#!/usr/bin/env bash
set -Eeuo pipefail

umask 077
readonly marker="/runner-state/.job-running"

if [[ -e "${marker}" ]]; then
  echo "A previous job marker still exists; refusing to start with an unverified workspace." >&2
  exit 1
fi

printf 'started_at=%s\n' "$(date --iso-8601=seconds)" > "${marker}"
