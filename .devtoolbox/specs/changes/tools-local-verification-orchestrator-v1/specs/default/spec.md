# Capability: Local Verification Orchestrator V1

## CLI and Profiles

The package source SHALL use the explicitly authorized underscore path `tools/local_verification/**`, required to expose `python -m tools.local_verification` with `status`, `plan`, `run`, `verify-git`, and `summarize`; tests SHALL remain under `tools/local-verification-tests/**`. Profile values SHALL be loaded from versioned JSON without hidden defaults. `desktop-heavy` SHALL allow 4 concurrent worktrees, 4 Vitest workers per worktree, 2 Playwright workers per focused run, global full-matrix concurrency 1, and ports 5201-5299. `laptop-safe` SHALL allow one concurrent worktree and one Vitest/Playwright worker.

## Canonical Plan

A plan SHALL contain portable repository-relative identifiers for repository root, worktree, and working directory; root/worktree SHALL normally be `.` and SHALL NOT contain an absolute machine path. It SHALL contain a deterministic opaque fingerprint of the exact resolved local worktree without serializing that path. It SHALL also contain non-empty expected branch/SHA, Node/npm versions, command argv, environment, timeout, resource tokens, port, allowed changed paths, expected output counts, cleanup policy, and a canonical plan hash. Planning and execution SHALL reject detached/unavailable identity and every unrelated clone/worktree, including one with identical branch/SHA; runtime SHALL recompute and match the fingerprint before spawn. Hashing SHALL be deterministic across equivalent local inputs and SHALL exclude noncanonical machine/runtime data.

## Safe Execution

Execution SHALL resolve the canonical target against the invocation worktree, verify its exact local fingerprint and expected branch/SHA before spawn and branch/SHA again after execution, use list argv with `shell=False` and the child environment/working directory, stream stdout/stderr to console and a runtime file, record exit code, duration, timeout, and signal, and own an isolated process group/session. On Windows, execution SHALL resolve only native `.COM`/`.EXE`; explicit or discovered `.CMD`/`.BAT` SHALL be rejected before `Popen` with a constant sanitized anticipated exception, and an unresolved command SHALL never be passed through. Windows child PATH resolution SHALL strip balanced quotes around entries, ignore empty and non-absolute entries, and preserve PATH directory priority by checking each directory before its native candidates. It SHALL NOT fall back to the current working directory or parent-process PATH. Separator-containing relative argv SHALL resolve only beneath the child working directory; absolute argv SHALL resolve only when it names an existing native executable, while canonical plan validation MAY independently restrict absolute commands. Runtime resolution SHALL NOT change canonical argv, plan hash, run records, or summaries. Windows SHALL retain its per-attempt Win32 Job Object containment. Timeout and Ctrl-C cleanup SHALL stop only processes started by that run. Owner records SHALL include PID plus a corroborated process-birth identity, and authority SHALL require both process liveness and an exact birth-identity match. Ports SHALL be checked before and after execution. No retry SHALL occur unless the plan explicitly authorizes exactly one diagnostic retry after ordinary command failure.

## Parsing and Classification

The orchestrator SHALL parse Vitest and Playwright test counts, compare expected counts, and classify failures as one of `AssertionFailure`, `TestTimeout`, `HookTimeout`, `ProcessCrash`, `PortConflict`, `DirtyEvidence`, `DependencyMismatch`, or `InfrastructureFailure` when evidence supports the classification.

## Git Safety and Status

Git operations SHALL be read-only by default and SHALL never automatically invoke restore, reset, clean, stash, checkout, switch, branch movement, or GitHub writes. Cleanup SHALL only emit a dry-run plan. `verify-git` SHALL parse porcelain-v1 `-z`, retain both destination and source for rename/copy records, and enforce allowed changed paths against both with destination authoritative. `status` SHALL emit Markdown or JSON containing branch/SHA, dirty paths, ahead/behind when remote data is available, DevToolbox changes, corroborated running owned runs, reserved ports, stale/unverified state, and the latest local run summary.

## Evidence and Redaction

Canonical plan, noncanonical runtime log, and normalized summary SHALL be separate. Common inline secret argv options, bearer/auth material, credential-bearing URLs, sensitive query parameters/signatures, and secret-bearing literal environment values SHALL be rejected without echo and SHALL require existing host-environment references. Secrets SHALL be redacted from logs. Absolute machine paths MAY appear only in local runtime logs; canonical artifacts and normalized summaries SHALL use repository-relative, opaque, or redacted values. Pass/hash claims SHALL be derivable from canonical plan identity, actual exit codes, and expected counts.

## Verification Scenarios

Unit tests SHALL use fake child processes and temporary Git repositories and cover argv escaping, exact-worktree binding across same-SHA clones, secret rejection without disclosure, exited-owner staleness, rename/copy source and destination enforcement, owned-group timeout termination, port reservation, concurrent token scheduling, absence of destructive Git calls, dirty-path detection, expected counts, failure classification, deterministic hashes, path redaction, Ctrl-C cleanup, Windows native resolution and batch rejection, and unchanged POSIX behavior. The focused direct Vitest argv SHALL be `node node_modules/vitest/vitest.mjs run tests/unit/spatialUniverseClock.test.ts`. Unit tests SHALL NOT start real product matrices.
