# Public Repository Security Controls

This document records the required GitHub settings for `BenjaminHornung/Weltraum-Spiel` after conversion to a public, source-available repository.

Repository files cannot enforce every GitHub setting. The controls below must be configured in GitHub immediately after the public-hardening pull request is merged.

## Main Ruleset

Create an active branch ruleset named `Protect main` targeting the default branch `main`.

Enable:

- Restrict deletions.
- Block force pushes.
- Require a pull request before merging.
- Required standard review approvals: `0`.
- Require conversation resolution before merging.
- Require status checks to pass.
- Require branches to be up to date before merging.
- Require linear history.
- Do not allow bypassing, including administrators, except for a separately documented emergency process.

Do not require a normal GitHub approval or CODEOWNER approval while the sole repository owner also authors integration pull requests. GitHub does not allow authors to approve their own pull requests. The repository therefore uses the exact-head custom status `Owner Approval / current head` as the mandatory owner confirmation.

Required status contexts:

- `Browser mainline verification`
- `Dependency review`
- `Codex Review / current head`
- `Owner Approval / current head`

After enabling CodeQL default setup, add the CodeQL JavaScript/TypeScript status shown by GitHub to the required checks.

## Owner Approval Procedure

Every non-draft pull request head starts with `Owner Approval / current head` pending. After reviewing the final diff and successful checks, `BenjaminHornung` posts exactly:

```text
/approve-head <full-40-character-head-sha>
```

Any new push creates a new pending status, so approval of an older commit cannot authorize a later one.

Revoke an approval with:

```text
/revoke-head <full-40-character-head-sha>
```

## Pull Request and Merge Settings

Under General settings:

- Enable squash merging.
- Disable merge commits.
- Disable rebase merging unless a future workflow explicitly needs it.
- Disable auto-merge.
- Enable automatic deletion of merged head branches.
- Enable always suggesting branch updates.

## Actions Settings

Set Actions permissions to GitHub-owned actions only, or the narrowest allowlist compatible with current workflows.

Enable the policy requiring actions to be pinned to a full-length commit SHA when the option is available.

Set workflow permissions to:

- Read repository contents permission.
- Do not allow GitHub Actions to create or approve pull requests.

For workflows from forks, require approval for **all external contributors** before running pull-request workflows.

The `Browser Mainline CI` workflow runs untrusted pull-request code only on a fresh GitHub-hosted `ubuntu-24.04` VM and receives no repository secret. The `Codex Review Gate` uses `pull_request_target` without checkout and withholds `CODEX_REVIEW_TOKEN` from fork pull requests.

## Remove the Self-hosted Runner

A persistent self-hosted runner must not remain registered to this public repository.

1. Stop and remove the TrueNAS Custom App/container.
2. Remove `truenas-weltraum-browser-01` under Settings → Actions → Runners.
3. Delete or invalidate its persisted `.runner`, `.credentials`, and registration state on TrueNAS.
4. Remove any runner-specific deploy key, PAT, webhook, GitHub App grant, or repository secret that is no longer required.
5. Confirm that no workflow contains `runs-on: self-hosted` or the label `weltraum-browser`.

Keep `CODEX_REVIEW_TOKEN` only while same-repository Codex re-review requests are required. It must remain repository-scoped and minimally privileged.

## Security and Analysis Settings

Enable:

- Dependency graph.
- Dependabot alerts.
- Dependabot security updates.
- CodeQL default setup for JavaScript/TypeScript.
- Secret scanning.
- Push protection for secrets.
- Private vulnerability reporting.

Review and resolve all existing secret-scanning and Dependabot alerts before accepting external contributions.

## Access Audit

Audit and remove anything not explicitly required:

- collaborators with write, maintain, or admin access;
- deploy keys, especially write-capable keys;
- repository and environment secrets;
- webhooks;
- installed GitHub Apps and OAuth integrations;
- environments and deployment approvals;
- stale Actions runners;
- branch and tag rules with bypass actors.

The repository owner account must use a passkey or hardware-backed two-factor authentication and retain recovery codes offline.

## History and Privacy Audit

The public-hardening change removes current tracked Unity logs containing a local username, machine identifier, session identifiers, and local filesystem paths. Those values remain in existing Git history until history is rewritten.

Before treating the repository as fully sanitized:

1. Run secret scanning across the complete Git history.
2. Rotate any credential that has ever been committed, even if deleted later.
3. Decide whether historical local paths and Unity machine identifiers justify a coordinated `git filter-repo` rewrite.
4. If history is rewritten, invalidate old clones, tags, Actions caches and release artifacts, then force-push only during a documented maintenance window.

A normal pull request removes files from the current tree but cannot erase prior commits.

## Licensing

This is a public **source-available** repository, not an OSI open-source project. Original project material is provided under PolyForm Noncommercial 1.0.0. Commercial use requires a separate written license from Benjamin Hornung. Third-party material remains under its own terms.
