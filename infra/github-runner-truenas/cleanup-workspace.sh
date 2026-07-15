#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly expected_work_root="/runner-state/_work"
readonly marker="/runner-state/.job-running"
readonly lock_file="/runner-state/.cleanup.lock"
readonly log_file="/runner-state/_diag/workspace-cleanup.log"
readonly mode="${1:---manual}"

mkdir -p "$(dirname "${log_file}")"
exec 9>"${lock_file}"
if ! flock --nonblock 9; then
  echo "Workspace cleanup is already running." >&2
  exit 1
fi

actual_work_root="$(readlink -f "${expected_work_root}")"
if [[ "${actual_work_root}" != "${expected_work_root}" || "${actual_work_root}" == "/" ]]; then
  echo "Refusing cleanup for unexpected work root: ${actual_work_root}" >&2
  exit 1
fi

case "${mode}" in
  --hook)
    if [[ ! -f "${marker}" ]]; then
      echo "Job-completion cleanup was requested without an active job marker." >&2
      exit 1
    fi
    ;;
  --startup)
    if [[ ! -f "${marker}" ]]; then
      echo "Startup cleanup was requested without a stale marker." >&2
      exit 1
    fi
    if pgrep -f '[R]unner.Worker' >/dev/null; then
      echo "Refusing startup cleanup while Runner.Worker is active." >&2
      exit 1
    fi
    ;;
  --manual)
    if [[ -f "${marker}" ]] || pgrep -f '[R]unner.Worker' >/dev/null; then
      echo "Refusing manual cleanup while a job may be active." >&2
      exit 1
    fi
    ;;
  *)
    echo "Usage: cleanup-workspace.sh [--manual|--hook|--startup]" >&2
    exit 2
    ;;
esac

started_at="$(date --iso-8601=seconds)"
find "${actual_work_root}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +

printf '%s mode=%s work_root=%s result=clean\n' \
  "${started_at}" "${mode}" "${actual_work_root}" >> "${log_file}"

if [[ "${mode}" != "--manual" ]]; then
  rm -f -- "${marker}"
fi
