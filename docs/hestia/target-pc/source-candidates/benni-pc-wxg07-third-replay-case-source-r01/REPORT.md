# WXG07 third replay gap: isolated source candidate

Status: ISOLATED_FUNCTIONAL_PASS / ROOT_REVIEW_PENDING. Product adoption and broader source acceptance remain HOLD.

## Scope and provenance

Same existing A0, App thread 01a13648-c55b-7250-bf07-34921d70b43b, actual turn 01a1500b-e66e-7ce1-8264-64e21e1d8d46. Actual App start 2026-10-18T17:25:19Z; fixed absolute endpoint 2026-10-18T17:34:32Z. Freeze timestamp and elapsed App time through freeze are in FREEZE.json. Freeze is not the full App turn; Root must read the actual turn end after return.

Task and finite test dispatch: E:/DEV/Weltraum-Spiel/TARGET_PC/WXG07_THIRD_REPLAY_CASE_SOURCE_TASK-20261018.md and WXG07_THIRD_REPLAY_CASE_DISPATCH-20261018.md, dispatch issued 2026-10-18T17:24:32Z. No clock reset, subagents, new owner or automatic continuation.

Original producer: C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-WXG-07-2026-10-09/spikes/wxg-07-grid-dynamics. New output directory was absent before creation. The only new regression is tests/replay-seven-day.test.mjs. Its 44 context files are byte-identical copies required by imports or by loadFixture's implementation/fixture bindings. No production API/source, original test, package, lockfile or fixture was edited. The original replay.test.mjs remains SHA256 7999213f79749cf683cc785ea33517c0cadc7a2d7d7474e3cb9362f24d2d5c20; its Worker suite was not imported or executed.

This closes missing isolated regression coverage, not a demonstrated production defect. No production RED is claimed. Existing M5/RT08/D2 packages were untouched.

## Exact test and closure

The test uses actual loadFixture(32), model.replay, encodeCheckpoint/decodeCheckpoint, CatchUp.read/pump and canonical Buffer comparison. Profile: n32, 6144 cells, two channels, dtTicks 72000 at 120 ticks/s. It encodes and decodes the checkpoint at tick 432000 (one hour), pumps a tail of 72576000 ticks (seven days), and asserts Ready at the fixed target 73008000. Pending reads expose no substitute checkpoint. FullReplay starts from the same frozen initial state and reaches the same target.

Executed steps: prefix 6, tail 1008, FullReplay 1014, total 2028. Eight finite pumps of at most 127 steps complete the tail. Final canonical bytes match exactly: 98615 bytes, SHA256 0abd51b9e12389229475bf45883ef88fbe8cf4efe9ed9d74d1ed96dc6cccb327. The final bytes differ from the one-hour checkpoint, and the initial canonical bytes remain unchanged.

IMPORT_CLOSURE.json lists 32 actual imported modules. Primary executable paths and import-time initializers were inspected; the called paths use deterministic arrays/bytes and frozen fixture reads/hashes. No dynamic import, require, child_process, worker_threads, network or realtime wait was found in that import closure. Existing prepareFixtures/keep and bindings.save definitions are imported but never called; authoring/climate/weather generation functions remain dormant. scripts/build.mjs is copied solely because loadFixture hashes it, never imported or run. No compiler or fixture generation ran.

## One functional invocation and custody

Exact entry: pinned C:/IFI_SourceCode/Temp/WeltraumSpiel/artifacts/hestia-other-pc-restored/Tooling/PortableNode/node.exe tests/replay-seven-day.test.mjs, using the absolute entry path and this package as CWD. Direct in-process node:test registration; no --test or test-worker child isolation. Node version assertion 22.23.2 passed. Node SHA256 before and after: 0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4.

Run-OnePureTest.ps1 was invoked once through explicit C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe. That interpreter's inspected SHA256 was db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f. The managed outer Codex tool wrapper is outside that CIFI interpreter; no blanket CIFI-only ancestry claim is made.

RUN_RECEIPT.json preserves exact argv/CWD, PID 18700, process creation 2026-10-18T17:29:59.4051775Z, stdout/stderr, exit 0, terminal true and actual SafeHandle.IsClosed after Dispose true. Elapsed from controller process setup through SafeHandle close: 1350 ms, within work cutoff 48000 ms and total 60000 ms. TAP: one test passed, zero failed, skipped or cancelled; test body 1191.162 ms. These are functional execution receipts, not benchmark/reference-performance evidence. No retry or profile reduction occurred.

INPUTS_BEFORE.json and INPUTS_AFTER.json prove 44 selected original/copied files retain the same path, length and SHA256. Node and test entry hashes also match before/after. This proves selected input preservation; it is not a whole producer repository audit or a Git/index cleanliness claim.

## Static receipt correction and remaining boundaries

One metadata-writing command initially used PowerShell true instead of $true and failed before writing CLOSURE_REVIEW.json. It ran no functional test. The metadata command was corrected before the sole functional invocation; the correction is recorded in CLOSURE_REVIEW.json. Controller PowerShell parse errors: zero. A prior JavaScript orchestration quoting error also ran no shell or test.

Mandatory i-have-adhd and Ponytail FULL applied. Requested Ponytail 5.2.0 path was absent; installed 5.3.2 was read and used.

NOT_RUN: original Worker suite, build/compiler, browser, engine, physics, GPU, WASM, server, real Save, weather cross-device/reference/adoption. No source integration, commit, merge or publication. Native24, all30/original18/R0-R5/phases and M5 qualification remain open. Independent Root review and any separately authorized one verification are subsequent work; do not rerun this invocation automatically.

Next action: Root reviews this isolated candidate and its receipts before any application to the producer.
