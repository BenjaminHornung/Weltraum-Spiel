# Codex Review Gate

`codex-review-gate.yml` ensures that a pull request is not treated as reviewed merely because Codex inspected an older commit.

## Why this exists

The repository-level Codex integration automatically reacts when a pull request is opened for review or changed from draft to ready. It can also be triggered explicitly with a pull-request comment containing `@codex review`.

Pushing another commit to an already-open pull request is not a documented automatic Codex trigger. The workflow therefore runs for `synchronize` as well as open, reopen and ready-for-review events and requires proof for the exact current head SHA.

## Gate behavior

For every non-draft pull request, the workflow:

1. waits briefly for the normal repository-level Codex trigger;
2. checks whether a Codex review names the current head SHA;
3. creates one head-specific `@codex review` request when no current review exists;
4. waits for either:
   - a Codex review submission naming the current head, or
   - Codex's `+1` reaction on the head-specific request when it found no comments;
5. fails after the bounded polling window instead of accepting a stale or missing review.

A new push cancels the older run and starts a new check for the new head SHA. Draft pull requests pass without requesting a review and are checked when marked ready.

The workflow does not check out or execute pull-request code. Its default `GITHUB_TOKEN` is read-only. The only write operation uses the separately configured, narrowly scoped `CODEX_REVIEW_TOKEN` to post the review-request comment.

## Required token for automatic re-requests

Comments created with the default `GITHUB_TOKEN` are authored by `github-actions[bot]`. Codex cannot associate that bot identity with the GitHub user connected to Codex, so such comments cannot reliably start a review.

Create a dedicated fine-grained personal access token for the same GitHub user that is connected to Codex. Restrict it to this repository and grant only the permissions needed to read pull-request reviews and post pull-request conversation comments. Store it as:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
Name: CODEX_REVIEW_TOKEN
```

Do not commit the token or place it in workflow YAML, repository variables, logs or evidence.

When the secret is absent, the gate does not create a noisy bot-authored request. It fails with the exact recovery action: either configure the secret or comment `@codex review` manually as the connected GitHub user and re-run the job.

## Make it a real merge requirement

After the workflow has run at least once on `main`, configure the branch rule or ruleset for `main` to require this status check:

```text
Codex Review Gate / Current head reviewed
```

Also enable conversation-resolution requirements when unresolved Codex inline findings should block merge. The review gate itself proves that Codex inspected the current head; it does not decide whether every finding is valid or resolved.

## Manual recovery

When a run reports a missing token or times out:

1. comment `@codex review` on the pull request as the GitHub user connected to Codex;
2. wait for the Codex review or thumbs-up reaction;
3. re-run `Codex Review Gate / Current head reviewed`.
