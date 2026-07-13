# Unity Cleanup Audit

Date: 2026-07-13

## Status

**SAFE STOP - no cleanup deletion or move has been performed.**

The mandatory preflight found a Git LFS object referenced by the current
`origin/main` that is not available from the remote. The initial normal
worktree checkout failed with HTTP 404 while Git LFS attempted to download:

```text
.devtoolbox/specs/changes/archive/2026-05-21-prototype-test-environment-ui-pass/tests/screenshots/environment-overview.png
oid sha256:c03d059b365d570421ef9c8f06abd7f55c2bbc50ce6587afb84b436f02738e53
size 35192
```

This matches the task's explicit safe-stop criterion: an unavailable LFS
object blocks destructive repository cleanup. The cleanup worktree was checked
out a second time with LFS smudging disabled solely so this blocker could be
recorded. Pointer presence is not treated as asset availability.

## Preflight identity

- Source branch: `origin/main`
- Source commit: `8383487f89f6eb6e63140def564052ac86de259a`
- Cleanup branch: `cleanup/browser-mainline-repository-v1`
- Unity legacy tag: `unity-legacy-final-2026-07`
- Unity legacy archive branch: `archive/unity-legacy-final-2026-07`
- Verified remote tag SHA: `8383487f89f6eb6e63140def564052ac86de259a`
- Verified remote archive-branch SHA: `8383487f89f6eb6e63140def564052ac86de259a`

The user's original checkout remains untouched on
`spike/threejs-core-port-v1`; it contained 414 pre-existing dirty entries and
was therefore not used for cleanup edits.

## Baseline inventory captured before the stop

Tracked top-level entries, including hidden entries:

```text
.agent
.ask-pro
.devtoolbox
.gitattributes
.github
.gitignore
.idea
.vsconfig
AGENTS.md
Assets
Packages
ProjectSettings
README.md
UpgradeLog.htm
analysis
apps
art
design-qa.md
docs
uam
weltraum_refactor_strategy_package
```

- Tracked files: 3,835
- Tracked files under `Assets`: 1,586
- Tracked files under `Assets/_Weltraum`: 146
- Tracked files under `Packages`: 166
- Tracked files under `ProjectSettings`: 28
- Git LFS paths: 669
- Active `.devtoolbox/specs/changes` directories: 112
- Archived `.devtoolbox/specs/changes/archive` directories: 66
- Git object database: 14.59 MiB packed plus 791.90 KiB loose

The Git object database size is not the total checkout size and excludes
unavailable remote LFS payloads. A trustworthy before/after repository-size
comparison cannot be completed until all referenced LFS objects are available.

## Required documents read

- `AGENTS.md`
- `.agent/PLANS.md`
- `docs/browser-mainline/adr-0001-threejs-mainline.md`
- `docs/browser-mainline/feature-intent-index.md`
- `docs/browser-mainline/known-unity-bug-traps.md`
- `docs/browser-mainline/port-roadmap.md`
- `docs/architecture/prototype-legacy-boundary-audit-2026-06-15.md`
- `docs/roadmap/spec-sorting-2026-06-15.md`

## Path classification

Classification is intentionally incomplete because the LFS availability gate
failed before content-preservation and incoming-reference analysis could be
trusted.

| Path | Preliminary class | Action while blocked | Reason |
| --- | --- | --- | --- |
| `apps/weltraum-browser` | Keep | None | Product mainline |
| `docs/browser-mainline` | Keep | None | Browser architecture and intent |
| `.github` | Keep | None | Browser CI must remain intact |
| `.agent` | Keep | None | Planning guidance must remain |
| `.devtoolbox` | Review | None | Contains the missing LFS object and mixed-platform records |
| `art` | Keep / Review | None | Original sources require LFS validation |
| `Assets` | Move / Delete candidate | None | Must not be removed until unique assets and all LFS objects are verified |
| `Packages` | Delete candidate | None | Unity project structure; incoming references not yet fully audited |
| `ProjectSettings` | Delete candidate | None | Unity project structure; incoming references not yet fully audited |
| `analysis` | Move / Delete candidate | None | Source evidence move not yet performed |
| `weltraum_refactor_strategy_package` | Archive / Delete candidate | None | Unique-information mapping not yet completed |

No top-level path has been approved for deletion in this blocked run.

## LFS risks

- At least one tracked LFS object is absent from the GitHub LFS store.
- A skip-smudge checkout contains pointer text, not verified binary payloads.
- Asset extraction, evidence classification, file signatures, and before/after
  size claims would be unreliable while the object is missing.
- No LFS history migration, pointer replacement, or evidence deletion has been
  attempted.

## Expected impact while blocked

- CI: unchanged.
- Browser runtime and tests: unchanged and not run, because no product cleanup
  was performed.
- Documentation and specs: unchanged except for this blocker audit.
- Unity project: unchanged on the cleanup branch.

## Resume criteria

Resume only after the exact object
`c03d059b365d570421ef9c8f06abd7f55c2bbc50ce6587afb84b436f02738e53`
is restored to the repository's Git LFS storage and a normal checkout/fetch of
`origin/main` succeeds without `GIT_LFS_SKIP_SMUDGE`.

After restoration, restart the full inventory and classification from the
archived source commit. Do not infer that this was the only missing LFS object;
run a complete LFS availability check before any move or deletion.
