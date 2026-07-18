# Local Verification Orchestrator V1

## Motivation

Local verification across several isolated worktrees currently risks unbounded CPU use, port collisions, conflicting evidence, unsafe cleanup, and unverifiable pass claims. A versioned, standard-library-only Python orchestrator is needed for controlled Windows desktop execution while remaining portable enough to test path and process behavior on POSIX.

## Outcome

Provide a deterministic CLI that plans, runs, inspects, and summarizes local verification with explicit machine profiles, resource tokens, safe subprocess argv, Git read-only defaults, normalized evidence, and auditable plan hashes.

## Scope

- `.devtoolbox/specs/changes/tools-local-verification-orchestrator-v1/**`
- `tools/local_verification/**` (authorized Python source path required by `python -m tools.local_verification`)
- `tools/local-verification-tests/**`
- `docs/tools/local-verification-orchestrator-v1.md`
- Commands: `status`, `plan`, `run`, `verify-git`, `summarize`
- Versioned `desktop-heavy` and `laptop-safe` machine profiles
- Canonical plans, noncanonical runtime logs, normalized summaries
- Fake-process and temporary-Git unit tests only

## Non-goals

- Product, package, lock, CI, generated evidence, or Unity asset changes
- Running real product test matrices in unit tests
- GitHub writes, PRs, merge, or change archive
- Automatic destructive Git cleanup or retry
- Secret persistence or absolute machine paths in canonical artifacts
