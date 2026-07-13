# Codex Review Gate

`codex-review-gate.yml` ensures that a pull request is not treated as reviewed merely because Codex inspected an older commit.

## Why this exists

The repository-level Codex integration automatically reacts when a pull request is opened for review or changed from draft to ready. It can also be triggered explicitly with a pull-request comment containing `@codex review`.

Pushing another commit to an already-open pull request is not a documented automatic Codex trigger. The workflow therefore handles `synchronize` as well as open, reopen and ready-for-review events and requires proof for the exact current head SHA.

## Security model

The workflow uses `pull_request_target`, so GitHub loads the trusted workflow from the base repository's default branch. It does not check out or execute pull-request code. Do not add checkout, build, test, cache restore or any command that executes content from the pull-request head to this workflow.

This trusted-base execution is required because the workflow uses a repository secret. A normal `pull_request` workflow can be modified by the pull request itself and must not receive a user personal access token.

The default `GITHUB_TOKEN` is limited to read operations plus writing one commit status to the exact pull-request head SHA. The only PR-comment write uses the separately configured, narrowly scoped `CODEX_REVIEW_TOKEN`.

## Gate behavior

For every non-draft pull request targeting `main`, the workflow:

1. writes a pending `Codex Review / current head` status to the exact PR head SHA;
2. waits briefly for the normal repository-level Codex trigger;
3. checks whether a Codex review names the current head SHA;
4. creates one head-specific `@codex review` request when no current review exists;
5. waits for either:
   - a Codex review submission naming the current head, or
   - Codex's `+1` reaction on the head-specific request when it found no comments;
6. writes success or failure to the same exact-head commit status.

A new push cancels the older run and starts a new check for the new head SHA. Draft pull requests receive a successful deferred status and are checked when marked ready.

## Required token for automatic re-requests

Comments created with the default `GITHUB_TOKEN` are authored by `github-actions[bot]`. Codex cannot associate that bot identity with the GitHub user connected to Codex, so such comments cannot reliably start a review.

Create a dedicated fine-grained personal access token for the same GitHub user that is connected to Codex. Restrict it to this repository and grant only the permissions needed to read pull-request reviews and post pull-request conversation comments. Store it as:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
Name: CODEX_REVIEW_TOKEN
```

Do not commit the token or place it in workflow YAML, repository variables, logs or evidence.

When the secret is absent, the gate does not create a noisy bot-authored request. It writes a failed exact-head status with the recovery action: either configure the secret or comment `@codex review` manually as the connected GitHub user and re-run the workflow.

## Make it a real merge requirement

After this workflow is merged to the default branch and has run for a later pull request, configure the branch rule or ruleset for `main` to require this commit-status context:

```text
Codex Review / current head
```

The workflow job itself runs in trusted base-branch context. The custom status above is deliberately written to `github.event.pull_request.head.sha`, so the required merge signal follows the latest pull-request commit.

Also enable conversation-resolution requirements when unresolved Codex inline findings should block merge. The exact-head gate proves that Codex inspected the current commit; it does not decide whether every finding is valid or resolved.

## Manual recovery

When a run reports a missing token or times out:

1. comment `@codex review` on the pull request as the GitHub user connected to Codex;
2. wait for the Codex review or thumbs-up reaction;
3. re-run `Codex Review Gate` for the pull request.
