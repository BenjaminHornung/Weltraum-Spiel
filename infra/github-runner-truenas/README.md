# TrueNAS GitHub Runner deployment

This directory defines the repository-scoped Browser CI runner for
`BenjaminHornung/Weltraum-Spiel`. It is deployed as the TrueNAS Custom App
`github-runner-weltraum`; it is not a standalone Docker installation.
The runner initiates outbound GitHub connections only, so a dynamic public IP
needs neither inbound port forwarding nor a Cloudflare tunnel.

## Execution trust boundary

This runner is persistent and is not a sandbox for pull-request or other
untrusted code. Browser Mainline CI may execute only the current main commit:

- push on refs/heads/main
- repository_dispatch with the fixed type browser-mainline-ci

The workflow has no pull_request, pull_request_target, workflow_dispatch,
workflow_call, issue_comment, tag, custom-ref, or custom-SHA execution path.
Its fail-closed checkout guard verifies the event, refs/heads/main, exact
checkout SHA, origin/main ancestry, and current main-head equality for
repository_dispatch before npm or product scripts run. Cleanup of _work does
not make the persistent runner ephemeral.

## Owner-only trust model

The repository configuration includes an image-owned pre-job hook that checks
the exact repository, event, main ref, workflow path, workflow SHA, job SHA,
and webhook payload before any job step. This runner-wide check blocks another
branch-controlled workflow even if it requests the same labels. It does not
require GitHub to report main as technically protected.

This guarantee applies only after the updated image has been deployed. Keep
Browser Mainline CI disabled until the immutable hook is live, previously
PR-exposed runner credentials and state have been rotated/reinitialized, and a
live repository audit confirms that the owner is the only write-capable
principal and no write-capable deploy key exists. Deleting only `_work` is
insufficient.

This is an explicitly accepted owner-only trust model, not equivalent to
technical branch protection. Compromise of the owner account, a future
write-capable collaborator, token, deploy key, or GitHub App can place code on
main and therefore execute it on the persistent runner. Re-audit write access
before adding any collaborator, deploy key, or integration.

## Pinned components

- Playwright `1.61.1`, official Noble image pinned to its Linux x64 digest.
- GitHub Actions Runner `2.335.1`, official release archive and SHA-256.
- Node.js `22.23.1`, official Linux x64 archive and SHA-256.
- Runner user `runner`, UID/GID `1000:1000`.

`compose.yaml` contains no secret and is self-contained for the dedicated
runner structure `/mnt/Storage/apps/github-runner-weltraum` inside the existing
`Storage` dataset. `.env.example` is reference documentation only.

Before submitting the Custom App, run `prepare-deployment.sh` in the deployment
directory. It downloads the pinned official runner archive with resume support,
verifies SHA-256, and atomically installs the gitignored build input. This keeps
the TrueNAS App build below its lifecycle timeout without using another Docker
daemon or an unpinned artifact.

Preload the digest-pinned Playwright base image through the supported TrueNAS
Apps API before `app.create`:

```sh
midclt call -j app.image.pull \
  '{"image":"mcr.microsoft.com/playwright@sha256:cf0daee9b994042e011bc29f20cdff1a9f682a039b43fcd738f7d8a9d3bcd9d6"}'
```

The service uses `pull_policy: build`, so Compose never tries to pull the
local-only `github-runner-weltraum` image from a registry.

## Repository validation

Run the repository-owned validation before deployment or review:

```powershell
py -3 infra/github-runner-truenas/validate-config.py
```

It parses the workflow and Compose YAML, parses every infra JSON file, checks
all shell scripts with `bash -n`, verifies pinned versions/digests, labels,
mounts, hooks, cleanup scope, documentation consistency, trigger/ref policy,
and scans for credential patterns. It installs no package or system
dependency; the validation environment must already provide Python, PyYAML,
and Bash.

## Deployment contract

Copy the files in this directory to the dedicated structure's `deployment/`
directory and
submit the compose document through TrueNAS `app.create` with:

```json
{
  "app_name": "github-runner-weltraum",
  "custom_app": true,
  "custom_compose_config_string": "<contents of compose.yaml>"
}
```

The one-time registration token is an exact read-only file bind from
`secrets/runner-registration-token`. It must be mode `0600`, is never an
environment variable, and is truncated on the host after successful
registration.

The image distribution under `/opt/actions-runner-dist` is copied to persistent
state only when no installation exists. Official runner updates therefore
survive app restarts and are not overwritten on every container start.

## Security invariants

- No privileged mode, host networking, published port, or Docker socket.
- No mount of `/mnt`, the pool root, TrueNAS configuration, or personal data.
- All capabilities are dropped and `no-new-privileges` is enabled.
- The official Playwright seccomp profile is used without custom Chromium
  command-line flags.
- One non-root listener handles at most one job at a time.
- The persistent runner executes only current main and never PR heads, merge
  refs, arbitrary branches, tags, or caller-supplied SHAs.
- Cleanup is limited to `/runner-state/_work`; runner state and caches are not
  automatic deletion targets and the cleanup is not ephemeral isolation.

Operational lifecycle, registration, verification, update, troubleshooting,
and rollback instructions live in
`docs/operations/truenas-self-hosted-github-runner.md`.
