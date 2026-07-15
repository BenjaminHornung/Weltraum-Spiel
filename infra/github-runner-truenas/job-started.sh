#!/usr/bin/env bash
set -Eeuo pipefail

umask 077
readonly marker="/runner-state/.job-running"
readonly expected_repository="BenjaminHornung/Weltraum-Spiel"
readonly expected_ref="refs/heads/main"
readonly expected_workflow_ref="BenjaminHornung/Weltraum-Spiel/.github/workflows/browser-mainline-ci.yml@refs/heads/main"

fail() {
  echo "Refusing job before execution: $1" >&2
  exit 1
}

for required in \
  GITHUB_REPOSITORY \
  GITHUB_EVENT_NAME \
  GITHUB_REF \
  GITHUB_REF_PROTECTED \
  GITHUB_SHA \
  GITHUB_WORKFLOW_REF \
  GITHUB_WORKFLOW_SHA \
  GITHUB_EVENT_PATH; do
  [[ -n "${!required:-}" ]] || fail "required GitHub context is missing: ${required}"
done

[[ "${GITHUB_REPOSITORY}" == "${expected_repository}" ]] || \
  fail "unexpected repository: ${GITHUB_REPOSITORY}"

case "${GITHUB_EVENT_NAME}" in
  push|repository_dispatch) ;;
  *) fail "unsupported event: ${GITHUB_EVENT_NAME}" ;;
esac

[[ "${GITHUB_REF}" == "${expected_ref}" ]] || fail "unexpected ref: ${GITHUB_REF}"
[[ "${GITHUB_REF_PROTECTED}" == "true" ]] || fail "main ref is not technically protected"
[[ "${GITHUB_SHA}" =~ ^[0-9a-f]{40}$ ]] || fail "github SHA is not a lowercase 40-character commit ID"
[[ "${GITHUB_WORKFLOW_REF}" == "${expected_workflow_ref}" ]] || \
  fail "unexpected workflow ref: ${GITHUB_WORKFLOW_REF}"
[[ "${GITHUB_WORKFLOW_SHA}" == "${GITHUB_SHA}" ]] || \
  fail "workflow SHA does not match job SHA"
[[ -f "${GITHUB_EVENT_PATH}" && -r "${GITHUB_EVENT_PATH}" ]] || \
  fail "GitHub event payload is not a readable file"

jq -e --arg repository "${expected_repository}" \
  '.repository.full_name == $repository and .repository.default_branch == "main"' \
  "${GITHUB_EVENT_PATH}" >/dev/null || fail "event payload repository metadata does not match"

case "${GITHUB_EVENT_NAME}" in
  push)
    jq -e --arg ref "${expected_ref}" --arg sha "${GITHUB_SHA}" \
      '.ref == $ref and .after == $sha and .deleted != true' \
      "${GITHUB_EVENT_PATH}" >/dev/null || fail "push payload does not match main SHA"
    ;;
  repository_dispatch)
    jq -e \
      '.action == "browser-mainline-ci" and
       ((.client_payload == null) or
        (.client_payload | type == "object" and length == 0))' \
      "${GITHUB_EVENT_PATH}" >/dev/null || \
      fail "repository_dispatch type or payload is not allowed"
    ;;
esac

if [[ -e "${marker}" ]]; then
  echo "A previous job marker still exists; refusing to start with an unverified workspace." >&2
  exit 1
fi

printf 'started_at=%s\n' "$(date --iso-8601=seconds)" > "${marker}"
