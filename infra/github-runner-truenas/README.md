# TrueNAS GitHub Runner deployment

This directory defines the repository-scoped Browser CI runner for
`BenjaminHornung/Weltraum-Spiel`. It is deployed as the TrueNAS Custom App
`github-runner-weltraum`; it is not a standalone Docker installation.

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
- Cleanup is limited to `/runner-state/_work`; runner state and caches are not
  automatic deletion targets.

Operational lifecycle, registration, verification, update, troubleshooting,
and rollback instructions live in
`docs/operations/truenas-self-hosted-github-runner.md`.
