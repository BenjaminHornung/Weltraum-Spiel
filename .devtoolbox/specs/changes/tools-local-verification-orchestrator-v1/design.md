# Design: Local Verification Orchestrator V1

## Architecture

Use a Python standard-library package under the explicitly authorized underscore source path `tools/local_verification`, required by `python -m tools.local_verification`, with narrow modules for CLI, profile loading, canonical plan modeling/hashing, Git inspection, resource/port coordination, subprocess execution, parsing/classification, evidence normalization, and status reporting. Tests remain under the hyphenated path `tools/local-verification-tests` and invoke fake Python child processes and temporary Git repositories.

## Determinism and Evidence

The canonical plan is JSON with stable key ordering and portable repository-relative paths: repository root and worktree are `.` and the working directory is relative beneath that root. CLI host paths are resolved only while planning and represented by a deterministic one-way local worktree fingerprint; runtime recomputes that opaque binding and rejects every other clone/worktree before spawn, even at identical branch/SHA. Its hash is SHA-256 over canonical bytes excluding the hash field itself. Runtime-only machine paths, timestamps, PIDs, streamed output, and process details belong only to noncanonical local state/logs. Summaries derive plan identity and pass/fail claims from the plan plus recorded exit codes and expected counts, and never expose machine paths.

## Resource Control

Machine profiles are explicit versioned JSON, with no hidden scheduling defaults. A filesystem-backed reservation registry coordinates worktree tokens and ports between processes. Reservations are acquired atomically, owned by a run identifier, and released in `finally`/Ctrl-C cleanup. Ports are probed before and after execution. Full Playwright matrix concurrency is globally serialized where the profile requires it.

## Process Safety

Commands are argv arrays, use `shell=False` with the child environment and working directory, and never become shell strings. On Windows, resolution accepts only native `.COM`/`.EXE`; explicit or discovered `.CMD`/`.BAT` is rejected before `Popen` with a constant sanitized anticipated exception, and unresolved commands are never passed through. Child PATH lookup strips balanced entry quotes, ignores empty and non-absolute entries, and checks absolute directories in PATH order with native candidates inside each directory. It never falls back to the current working directory or parent-process PATH. Separator-containing relative argv resolves only beneath the child working directory, while absolute argv resolves only when it is an existing native executable; canonical plan validation may independently restrict absolute commands. Runtime resolution leaves canonical argv, plan hash, run records, and summaries unchanged. The focused direct test command is `node node_modules/vitest/vitest.mjs run tests/unit/spatialUniverseClock.test.ts`.

Inline secret options, bearer/auth material, credential-bearing URLs, sensitive query parameters/signatures, and secret-bearing literal environment values are rejected without echo; secrets must remain in existing host-environment references. Child processes start in their own process group/session. Timeout and Ctrl-C termination target only the process group created by the run and never scan or kill unrelated processes. Run metadata tracks owned PIDs/groups. Output streams to console and file with environment/key and value redaction. No automatic retry exists; one diagnostic retry is permitted only when explicitly authorized by the plan.

## Git Safety

All Git integration is observational: branch, SHA, dirty paths, ahead/behind, and allowed-path verification. The implementation must not invoke restore, reset, clean, stash, checkout, switch, or branch movement. Cleanup output is a dry-run plan only.

## Portability

Windows retains the per-attempt Win32 Job Object boundary for native children, including suspended start, assignment before resume, kill-on-close, and targeted job termination. POSIX behavior remains unchanged and uses a new session and group signals. Path normalization uses `pathlib`/`os.path` semantics and tests both Windows-style and POSIX-style inputs without changing the host filesystem.

## Tradeoffs

A local JSON reservation registry is simpler and auditable but requires careful atomic replace/locking behavior. Reservation/running owners are authoritative only while the PID is live and its exact process-birth identity matches; exited, reused, or unverifiable identities are stale and remain manual dry-run recovery only. V1 favors deterministic bounded scheduling and clear failure over automatic recovery. No third-party dependency is accepted, so streaming and process control use threads/selectable standard-library mechanisms appropriate to the host.
