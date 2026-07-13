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

The workflow does not check out or execute pull-request code. Its write access is limited to posting the review-request comment.

## Optional token for fully automatic re-requests

The workflow first uses the repository secret `CODEX_REVIEW_TOKEN` when present and otherwise falls back to the normal `GITHUB_TOKEN`.

A dedicated fine-grained token is recommended when GitHub or the Codex integration ignores comments authored by `github-actions[bot]`. Restrict the token to this repository and grant only the permissions needed to read pull-request reviews and post pull-request conversation comments. Store it as:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
Name: CODEX_REVIEW_TOKEN
```

Do not commit the token or place it in workflow YAML, repository variables, logs or evidence.

Without the optional secret, the gate remains fail-closed. If the automatic comment is ignored, it reports the exact manual recovery action: comment `@codex review` on the pull request and re-run the failed job.

## Make it a real merge requirement

After the workflow has run at least once on `main`, configure the branch rule or ruleset for `main` to require this status check:

```text
Codex Review Gate / Current head reviewed
```

Also enable conversation-resolution requirements when unresolved Codex inline findings should block merge. The review gate itself proves that Codex inspected the current head; it does not decide whether every finding is valid or resolved.

## Manual recovery

When a run times out:

1. comment `@codex review` on the pull request;
2. wait for the Codex review or thumbs-up reaction;
3. re-run `Codex Review Gate / Current head reviewed`.
