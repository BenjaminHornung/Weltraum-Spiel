# Codex Review Gate

`codex-review-gate.yml` requires Codex evidence for the exact current pull-request head instead of accepting a review of an older commit.

## Trigger and security boundary

The workflow handles pull requests targeting `main` when they are opened, reopened, marked ready or updated with a new head commit.

It uses `pull_request_target`, so GitHub loads the trusted workflow from the base branch. The workflow must never check out, build, test, restore caches from, or otherwise execute pull-request content.

The default `GITHUB_TOKEN` reads PR metadata and writes the custom status directly to `github.event.pull_request.head.sha`. `CODEX_REVIEW_TOKEN` is exposed only to the authentication and request-creation steps. The verifier never receives the secret.

## Request setup steps

For every non-draft head, the gate runs separately named steps:

1. `Initialize exact-head Codex status`
   - writes `Codex Review / current head` as pending;
2. `Find existing exact-head request`
   - reuses only a request containing the hidden marker for this full head SHA;
3. `Authenticate CODEX_REVIEW_TOKEN`
   - proves the secret represents a valid GitHub user;
4. `Create exact-head Codex request`
   - posts one marked `@codex review` comment using that user identity;
5. `Report request setup failure`
   - converts any request setup failure into a failed exact-head status.

This separation makes the failure class visible directly in GitHub Actions. The token value is never printed.

## Exact-head verification

The verifier polls with the read-only default token and accepts one of the Codex formats observed in this repository:

1. a GitHub review from the Codex connector whose `commit_id` exactly equals the full current head SHA;
2. a top-level Codex result comment created after the exact-head request and containing:
   - the full current head in a recognized reviewed-head or reviewed-commit field; or
   - Codex's 10-character SHA in an explicit `Reviewed commit` field, after GitHub resolves that prefix to the full current head;
3. a Codex `+1` reaction created on the exact-head request comment after that request was posted.

PR-level reactions are intentionally not accepted because they are not bound to a specific request comment or commit. A short SHA appearing elsewhere in prose or findings is not accepted. Author, timestamp and exact-head checks prevent an older review or reaction from satisfying a newer commit.

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

For the issue-comment endpoint used by PR conversation comments, grant either:

```text
Issues -> Read and write
```

or:

```text
Pull requests -> Read and write
```

Store it as a repository Actions secret:

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
