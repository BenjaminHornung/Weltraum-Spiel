#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly state_dir="/runner-state"
readonly token_file="${RUNNER_REGISTRATION_TOKEN_FILE:-/run/secrets/runner-registration-token}"
readonly distribution_dir="/opt/actions-runner-dist"
readonly cleanup_script="/opt/runner-hooks/cleanup-workspace.sh"

if [[ "$(id -u)" == "0" ]]; then
  echo "Refusing to run the GitHub runner as root." >&2
  exit 1
fi

for required in RUNNER_REPOSITORY_URL RUNNER_NAME RUNNER_LABELS; do
  if [[ -z "${!required:-}" ]]; then
    echo "Required environment variable is missing: ${required}" >&2
    exit 1
  fi
done

if [[ ! -d "${state_dir}" || ! -w "${state_dir}" ]]; then
  echo "Runner state directory is missing or not writable: ${state_dir}" >&2
  exit 1
fi

cd "${state_dir}"
mkdir -p _work _tool _diag

if [[ ! -x "${state_dir}/bin/Runner.Listener" ]]; then
  echo "Initializing the persistent runner installation from the immutable image distribution."
  cp -R "${distribution_dir}/." "${state_dir}/"
  chmod u+rwX,go-rwx "${state_dir}"
  printf '%s\n' "$(<"${distribution_dir}/.image-runner-version")" > "${state_dir}/.image-runner-version"
fi

if [[ -f "${state_dir}/.job-running" ]]; then
  echo "Recovering workspace left by an interrupted container before starting the listener."
  "${cleanup_script}" --startup
fi

if [[ ! -s "${state_dir}/.runner" ]]; then
  if [[ ! -s "${token_file}" ]]; then
    echo "Runner is not configured and the one-time registration token file is empty." >&2
    exit 1
  fi

  registration_token="$(<"${token_file}")"
  ./config.sh \
    --unattended \
    --url "${RUNNER_REPOSITORY_URL}" \
    --token "${registration_token}" \
    --name "${RUNNER_NAME}" \
    --labels "${RUNNER_LABELS}" \
    --work "_work"
  unset registration_token

  chmod 0600 .runner .credentials 2>/dev/null || true
  chmod 0600 .credentials_rsaparams 2>/dev/null || true
  echo "Runner registration completed."
else
  echo "Using the existing persistent runner registration."
fi

exec ./run.sh
