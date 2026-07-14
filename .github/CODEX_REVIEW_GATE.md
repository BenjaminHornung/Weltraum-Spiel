# Codex Review Gate

`codex-review-gate.yml` requires Codex evidence for the exact current pull-request head instead of accepting a review of an older commit.

## Trigger and security boundary

The workflow handles pull requests targeting `main` when they are opened, reopened, marked ready or updated with a new head commit.

It uses `pull_request_target`, so GitHub loads the trusted workflow from the base branch. The workflow must never check out, build, test, restore caches from, or otherwise execute pull-request content.

The default `GITHUB_TOKEN` reads PR metadata and writes the custom status directly to `github.event.pull_request.head.sha`. The separate `CODEX_REVIEW_TOKEN` is scoped only to the request step, where it authenticates the connected GitHub user and creates one exact-head PR conversation comment. The verification step never receives the secret.

## Two-step workflow

The gate deliberately separates requesting from verification.

### 1. Request step

For every non-draft head, the first step:

1. writes `Codex Review / current head` as pending;
2. reuses an existing request only when it contains the workflow's hidden exact-head marker;
3. verifies that `CODEX_REVIEW_TOKEN` can authenticate;
4. posts exactly one marked `@codex review` comment for the exact head;
5. exposes only the request comment ID and timestamp to the verification step.

Failures are surfaced directly in the commit-status description:

- `CODEX_REVIEW_TOKEN is missing`
- `CODEX_REVIEW_TOKEN authentication failed`
- `CODEX token cannot create PR comment`

The token value is never printed. An EXIT trap converts unexpected request-step failures, including comment lookup and JSON parsing failures, into a failed exact-head status instead of leaving the status pending.

### 2. Verification step

The second step polls using the read-only default token and accepts one of the Codex formats observed in this repository:

1. a GitHub review from the Codex connector whose `commit_id` exactly equals the full current head SHA;
2. a top-level Codex result comment created after the exact-head request and containing:
   - the full current head in a recognized reviewed-head or reviewed-commit field; or
   - Codex's 10-character SHA in an explicit `Reviewed commit` field, after GitHub resolves that prefix to the full current head;
3. a Codex `+1` reaction on the exact-head request, or a PR-level `+1` created after that request.

A short SHA appearing elsewhere in prose or findings is not accepted. Author, timestamp and exact-head checks prevent an older review or reaction from satisfying a newer commit.

Every new push cancels the previous run and starts a new pending status for the new head. Draft PRs receive a successful deferred status and are checked when marked ready.

## Status context

Configure the `main` ruleset to require:

```text
Codex Review / current head
```

Also enable required conversation resolution when unresolved Codex inline findings should block merging. The exact-head status proves that Codex inspected the current commit; conversation resolution controls whether findings remain open.

## Token setup

Create a fine-grained personal access token for the same GitHub user that is connected to Codex.

Use:

```text
Repository access: Only selected repositories -> Weltraum-Spiel
```

For the issue-comment endpoint used by PR conversation comments, GitHub accepts either of these repository permission sets:

```text
Issues -> Read and write
```

or:

```text
Pull requests -> Read and write
```

Granting both is unnecessary. Store the token as a repository Actions secret:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
Name: CODEX_REVIEW_TOKEN
```

Do not commit the token or expose it through repository variables, logs or evidence.

## Manual recovery

A manual request must include the current SHA so a no-findings result can be attributed to the correct head:

```text
@codex review

current head: 0123456789
```

Then wait for the Codex result and re-run the failed workflow if necessary.
