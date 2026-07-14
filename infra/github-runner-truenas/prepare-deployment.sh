#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

readonly runner_version="2.335.1"
readonly runner_sha256="4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf"
readonly archive_name="actions-runner-linux-x64-$runner_version.tar.gz"
readonly archive_url="https://github.com/actions/runner/releases/download/v$runner_version/$archive_name"

if [[ "$#" -eq 1 ]]; then
  deployment_dir="$1"
elif [[ "$#" -eq 0 ]]; then
  deployment_dir="$(cd "$(dirname "$0")" && pwd)"
else
  echo "Usage: prepare-deployment.sh [deployment-directory]" >&2
  exit 2
fi

readonly archive_path="$deployment_dir/$archive_name"
readonly partial_path="$archive_path.partial"
readonly lock_path="$deployment_dir/.prepare-deployment.lock"

exec 9>"$lock_path"
flock 9

if [[ -f "$archive_path" ]]; then
  echo "$runner_sha256  $archive_path" | sha256sum --check --strict
  echo "Pinned runner archive is already prepared."
  exit 0
fi

curl \
  --continue-at - \
  --fail \
  --location \
  --retry 5 \
  --retry-all-errors \
  --retry-delay 5 \
  --show-error \
  --output "$partial_path" \
  "$archive_url"

echo "$runner_sha256  $partial_path" | sha256sum --check --strict
mv -- "$partial_path" "$archive_path"
chmod 0600 "$archive_path"
echo "Pinned runner archive prepared and verified."
