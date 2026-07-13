# Codex Review Gate

`codex-review-gate.yml` requires Codex evidence for the exact current pull-request head instead of accepting a review of an older commit.

## Trigger and security boundary

The workflow handles pull requests targeting `main` when they are opened, reopened, marked ready or updated with a new head commit.

It uses `pull_request_target`, so GitHub loads the trusted workflow from the base branch. The workflow must never check out, build, test or otherwise execute pull-request content. This trusted-base boundary is required because the workflow can use a repository secret.

The default `GITHUB_TOKEN` reads PR metadata and writes the custom commit status directly to `github.event.pull_request.head.sha`. The separate `CODEX_REVIEW_TOKEN` is used only to post one head-specific PR comment.

## Accepted exact-head evidence

The status context is:

```text
Codex Review / current head
```

The gate accepts one of the Codex formats observed in this repository:

1. a GitHub review from the Codex connector whose `commit_id` exactly equals the full current head SHA;
2. a top-level Codex review-result comment created after the exact-head request and containing either:
   - the full current head SHA in a recognized result format, or
   - Codex's 10-character SHA in an explicit `Reviewed commit` field, after GitHub resolves that prefix uniquely to the full current head;
3. a Codex `+1` reaction on the exact-head request, or a PR-level `+1` created after that request.

Result comments and reactions are additionally constrained by Codex author identity and request timestamp. A short SHA appearing elsewhere in prose or findings is not accepted. These checks prevent an old review or old thumbs-up from satisfying a newer head.

Every new push cancels the previous run and creates a new pending status for the new head. Draft PRs receive a successful deferred status and are checked when marked ready.

## Token setup

Create a fine-grained personal access token for the same GitHub user that is connected to Codex.

Use these settings:

```text
Repository access: Only selected repositories -> Weltraum-Spiel
Repository permission: Pull requests -> Read and write
```

Store it under:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
Name: CODEX_REVIEW_TOKEN
```

Do not commit the token or expose it through repository variables, logs or evidence. Review reads and commit-status writes continue to use the workflow's default token.

## Branch rule

After the status has appeared on a PR, configure the `main` ruleset to require:

```text
Codex Review / current head
```

Also enable required conversation resolution when unresolved Codex inline findings should block merging. The exact-head status proves that Codex inspected the current commit; conversation resolution controls whether findings remain open.

## Manual recovery

A manual request must include the current SHA so a no-findings result can be attributed to the correct head:

```text
@codex review

current head: 0123456789
```

Then wait for the Codex result and re-run the workflow if necessary.
