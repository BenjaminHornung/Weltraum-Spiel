# Local Verification Orchestrator V1

The standard-library package uses the explicitly authorized underscore source path `tools/local_verification`, required by `python -m tools.local_verification`; its tests remain under `tools/local-verification-tests`. It plans and runs bounded local verification. It does not install dependencies, start product services by itself, write to GitHub, or run a product matrix unless that exact argv is present in an approved plan.

## Profiles

`desktop-heavy` permits four concurrent worktrees, four Vitest workers per worktree, two Playwright workers per focused run, one globally concurrent full matrix, and ports 5201-5299. `laptop-safe` limits all four concurrency values to one and uses the same port range. Profile JSON is versioned and is the source of truth. Planning adds and validates `--maxWorkers` for Vitest and `--workers` for focused Playwright commands. Full matrices reserve the single global matrix slot.

Full-matrix serialization prevents two orchestrated full matrices from overlapping. It cannot coordinate processes that bypass the orchestrator. Port reservation plus pre/post bind probes narrows collisions but cannot eliminate the inherent TOCTOU interval between a probe and the child binding the port.

## Plan

Run `plan` from the Git worktree that will later execute the plan. `--repository`, `--worktree`, and `--cwd` may be supplied as host paths at the CLI boundary, but they must resolve to the same actual attached Git worktree. The expected branch and SHA are checked while planning. Detached HEAD, missing identity, unrelated repositories, escaped working directories, and mismatched branch/SHA are rejected.

The canonical JSON always stores `repository_root: "."`, `worktree: "."`, a repository-relative `working_directory`, and a deterministic SHA-256 `worktree_fingerprint` derived one-way from nonpersistent filesystem identities for the resolved root and its Git worktree-local directory. It stores neither the host path nor raw filesystem/Git identity data. Runtime recomputes this opaque binding before spawn, so a plan created in one clone/worktree cannot run in another at identical branch/SHA and is intentionally invalidated when that directory instance is replaced. Identity that is unavailable, unsupported, or zero fails closed. Resolved symlink aliases and Windows path-case aliases retain the concrete instance identity. Absolute machine paths are also rejected in command argv, literal environment values, and allowed changed paths.

Supply argv as literal trailing arguments, never as a shell string:

```powershell
python -m tools.local_verification plan --profile laptop-safe --repository . --worktree . --branch feature/example --sha 0123456789abcdef0123456789abcdef01234567 --node-version v22.17.0 --npm-version 10.9.2 --cwd apps/weltraum-browser --timeout 120 --port 5201 --allow-path apps/weltraum-browser/evidence --expected-count passed=42 npm run test -- --run
```

Canonical environment entries may be simple non-secret, non-absolute literals through `--env KEY=VALUE`. Common inline secret argv options (`--token value`, `--token=value`, and password/secret/API-key/auth/bearer/credential variants), Basic/Bearer and API-key headers including safely percent-decoded forms, known high-confidence token prefixes, every URL userinfo form, and decoded sensitive query keys/signatures are rejected without echo. The same shared classification applies to literal environment values even under innocuous keys and to runtime structured-output redaction. Secret and machine-local values must use an existing host variable through `--host-env KEY` or `--host-env TARGET=SOURCE`; the plan stores only that host variable name. Every value obtained through host-env indirection is explicitly redacted regardless of source or target name, including inherited source-variable output. Any referenced nonempty value shorter than four characters is rejected generically because blind replacement of short strings could corrupt test-parser input. Structured secret material and longer referenced values are redacted from console output, runtime logs, and summary derivation.

Write redirected plan JSON as UTF-8 without a BOM. On Windows PowerShell, use an explicit encoding API when the shell version would otherwise add a BOM.

## Run

Invoke `run` from the same concrete Git worktree instance represented by the plan. The runtime discovers that worktree with read-only Git queries, recomputes its root and worktree-local filesystem binding, resolves the canonical working directory beneath it, and verifies attached branch, SHA, and allowed dirty paths before spawning. It inspects branch/SHA and dirty paths again after execution. A plan created for worktree A cannot execute from worktree B even if both are clones of the same repository, and an old plan cannot execute after A is replaced in place.

```powershell
python -m tools.local_verification run --plan .local-verification-plan.json
```

Execution validates schema and plan hash and launches `command_argv` with `shell=False`. On Windows the root process starts suspended, is assigned to a per-attempt Win32 Job Object configured with kill-on-close, and is then resumed. Timeout and Ctrl-C call `TerminateJobObject`; normal handle closure removes surviving owned descendants. Create, assignment, resume, termination, and `CloseHandle` failures are surfaced as `InfrastructureFailure`. A failed close retains ownership long enough to attempt owned-job termination and a close retry, and the run is never reported successful. The implementation never enumerates or terminates unrelated PIDs.

On POSIX each attempt owns a new session/process group, and cleanup addresses that group even when the direct child has exited. POSIX real process-group behavior is not verified by the Windows test run. Windows resume currently uses `NtResumeProcess` because Python's `Popen` does not retain the suspended primary-thread handle needed by documented `ResumeThread`; replacing that boundary without weakening pre-assignment containment remains an acknowledged platform risk.

Filesystem reservations atomically bind worktree/global-matrix concurrency and reserve the requested in-profile port. Every owner record stores both PID and a process-birth identity (`GetProcessTimes` creation time on Windows, `/proc/<pid>/stat` start time where available on POSIX). Authority requires both current process liveness and an exact birth-identity match; an exited process remains stale even if its creation token is still queryable, and PID reuse or unverifiable identity is likewise stale. Reservations and running markers release in `finally` for owned runs.

There is no automatic retry. Exactly one diagnostic retry occurs only when the canonical plan explicitly contains `cleanup_policy.retry_count: 1` and `cleanup_policy.diagnostic_retry: true`, and only after an ordinary nonzero exit. Timeout, Ctrl-C, reservation, identity, port, spawn, and containment failures never retry. A diagnostic retry cannot erase the first failed attempt.

## Evidence Separation

Canonical plan, noncanonical runtime log/local state, and normalized summary are separate. Absolute paths, timestamps, PIDs, streamed output, and process details may exist in local runtime records and logs under `%TEMP%/weltraum-local-verification` or `LOCAL_VERIFICATION_STATE_DIR`. Normalized summaries and `status` use repository-relative paths, redacted placeholders, or opaque worktree-binding hashes; they do not expose machine paths or secret values.

Every execution infrastructure failure, including plan/hash rejection, target mismatch, reservation conflict, spawn failure, Job setup/resume/termination/close failure, and pre/post port conflict, writes a new failed runtime record and `latest-summary.json`. An older pass therefore cannot remain the latest status after a failed launch. Pass claims derive from a valid plan hash, all actual attempt results, expected counts, attached branch/SHA, dirty-path allowance, and port checks; input `passed` fields are ignored.

```powershell
python -m tools.local_verification summarize --run $env:TEMP\weltraum-local-verification\runs\RUN_ID.json
```

## Git Safety

Git inspection is read-only: worktree root, branch, SHA, porcelain-v1 `-z` dirty paths, and upstream ahead/behind. Rename/copy records retain and enforce both destination and original source. A rename or detected copy fails `verify-git` and execution as `DirtyEvidence` when either side is forbidden, including a forbidden source moved or copied into an allowed destination.

```powershell
python -m tools.local_verification verify-git --repository . --branch feature/example --sha 0123456789abcdef0123456789abcdef01234567 --allow-path tools/local_verification --allow-path tools/local-verification-tests
```

The tool never invokes restore, reset, clean, stash, checkout, switch, commit, push, fetch, branch movement, or GitHub writes.

## Stale Recovery

Cleanup is dry-run only. `status` reports stale running/reservation records and exact repository-relative state paths in `cleanup_plan.actions`; it never deletes them. Missing legacy process identities and identities that cannot be corroborated remain stale/unverified and continue to block their reservation.

Manual recovery requires an operator to confirm that no matching orchestrator process with the recorded PID and process-birth identity exists, inspect the reported state record, and then remove only the exact stale path listed by `status`. If identity cannot be corroborated, do not infer ownership from a live PID and do not terminate that process. No Git cleanup, evidence deletion, service stop, or unrelated process action is part of recovery.

## Status And Limits

```powershell
python -m tools.local_verification status --repository . --format json
python -m tools.local_verification status --repository . --format markdown
```

Failure classification is evidence-driven and emits `AssertionFailure`, `TestTimeout`, `HookTimeout`, `ProcessCrash`, `PortConflict`, `DirtyEvidence`, `DependencyMismatch`, or `InfrastructureFailure`. Fix the reported cause and create a new explicit plan when command, identity, counts, resources, or policy changes. Do not silently replan or retry.

Unit coverage uses mocked Ctrl-C delivery because deterministic console control-event injection is not safe across test runners. Real Windows timeout and harmless multi-level descendant containment are tested; real interactive Ctrl-C delivery remains a documented residual.
