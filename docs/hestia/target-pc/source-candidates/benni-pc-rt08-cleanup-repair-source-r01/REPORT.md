# RT08 cleanup source repair
**SOURCE_IMPLEMENTED_PENDING_REVIEW_RUNTIME_NONE_HOLD**

Standalone repaired source candidate only. Root must independently review/accept before source application. No product/renderer adoption or runtime authority.

Actual same A0 Appthread01a13648-c55b-7250-bf07-34921d70b43b; Appturn01a14fe8-80e8-72e1-a5ad-e4493a4d7a75. Current App read_thread observed start **2026-10-18 16:46:39UTC**, precision seconds. Fixed absolute endpoint **17:06:32.0610711UTC /19:06:32Vienna**, including checks/freeze/final report, never reset. FREEZE.json records elapsed-to-freeze; full completed turn duration needs Root post-turn readback.

Original: C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-RT-08-2026-10-09/spikes/rt-08-photo
Candidate: C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-rt08-cleanup-repair-source-r01
The candidate was proven absent. Only five necessary files were copied with their original relative layout; session.mjs/package.json remain byte-identical. No tsconfig/declaration copy was required for parse-only checks.

## Change
The existing import-free photo-operations.mjs now exports cleanupPhoto. It attempts each supplied synchronous cleanup callback once in order, captures every thrown value, preserves exact single-error identity, and uses AggregateError in deterministic primary-first/cleanup order when more errors exist. The cause is the first preserved value. Rest-argument presence distinguishes no primary from a real null/undefined throw; no nullable sentinel is used.

Both actual main.ts call sites use it:
- Normal driver.dispose preserves **device -> tracer -> resources -> renderer**.
- Initialization catch captures the failed owned resources, clears the shared resources reference BEFORE fallible cleanup, then preserves **tracer -> resources -> renderer -> device**, passing the actual caught value as primary.

Live-mode/adapter guards, DOM, snapshot/source/provenance, deadlines180s, dispatch limit8192, sampling, save/export and all other main.ts text remain unchanged. The TypeScript/source check reverses exactly the two caller edits plus import edit and compares the entire restored main.ts to the original. Existing operations functions and three original mock regressions are retained. No dependency/configuration/unrelated feature change or new production module; added scripts serve verification only.

## Original -> repaired SHA256
| Relative file | Original | Repaired |
|---|---|---|
| src/main.ts | aa8c74c1064f2240c9eee8aa04da7ef0ed5c54b652f911bbc76b3ec2a95a5d6f | 570f5ad8b173b2e73d35ba1edb42fb40f6f767d27a409c4a82925c7a36a4f40d |
| src/photo-operations.mjs | 9707fa577656180c64ebfee7a4cdbaab0ab1a129b6f2e863ab16bfc8197c74ca | f19708bf4820c638e7aecc69ab09415622a31d75458245142d3ac04baa02ef83 |
| tests/operations.test.mjs | 54aca0f8696c0059bb5002a6922531e5c39459b2f357aac24d9dd168475c7a08 | 468541098c76173537030a6d6b0ac276815d143a03896c3a218e90072917e0ba |

EXACT_CHANGES_AND_PRESERVATION.json contains exact reversible changed segments and original/repaired absolute paths, lengths and hashes. **Two production files and one test file modified; five original copied inputs rehashed unchanged.** This is not an exhaustive hash inventory of the external producer package. No original/producer/product/M5 file or lock/D2 write occurred; M5 files/locks were not accessed and no unrelated M5 tests ran.

## Evidence
All invocations use pinned CIFI Node22.23.2 (SHA0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4) under explicit CIFI pwsh. The managed outer Codex wrapper remains outside CIFI; no blanket CIFI-only claim.

- RED: direct 'node tests/cleanup-red.test.mjs', exit1, **12 cases/3PASS/9FAIL**, hostPID38676/creation134368158767197931;657ms including closure. This is a bounded mock projection of the exact hash-bound original literal catch/driver bodies (each under256characters, VM timeout50ms), not evaluation/import of main.ts as an application. It demonstrates skipped cleanup, lost primary/earlier error and uncleared resources; no missing-export-only RED.
- GREEN_FINAL: direct 'node tests/operations.test.mjs', exit0, **39PASS/0FAIL**, hostPID25604/creation134368162244519105;672ms inclusive. It imports actual repaired operations/session and Node builtins only, executes actual helper with mocks, covers first/second/third/fourth errors in both orders, multiple failures, Error/null/undefined and other falsy throws, normal success, optional absent resources and actual PhotoSession one-shot failing disposal. No --test child isolation.
- PARSE_MAIN: direct 'node parse-main.mjs', exit0, hostPID61164/creation134368160785848625;859ms. Qualified existing TypeScript **5.9.3**, C:/IFI_SourceCode/Utils/paseo-opencode-guard/node_modules/typescript/lib/typescript.js, SHA **3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675**. Only createSourceFile/AST traversal runs: **0syntax diagnostics, exactly2wired helper calls**, both exact orders, primary argument, failed-resource capture/clear before cleanup, exact original reversal. Three removal/order mutants rejected. This uses only that existing parser library, not a Paseo/OpenCode provider or agent.
- Syntax: separate direct node --check for operations/session/tests, all exit0, each750ms inclusive. Hosts58780/57916/22808. The parser entry itself executed successfully. All selected paths/lengths/SHA in command receipts are unchanged after each invocation.
- Every process reports actual terminal, full stdout/stderr, bounded output and actual SafeHandle.IsClosed after Dispose; no kill was needed. All <=60s including startup/streams/terminal/handle closure. FINAL_SOURCE_CLOSURE verifies all current source hashes still match passing mock/parser/syntax receipts and original inputs.

## Limits
**Real GPU, renderer, main application, browser, physics, Native24, family/fixture, WASM, Save/export, server, build and semantic full typecheck NOT_RUN.** TypeScript parsed source only; it neither resolved product imports nor emitted/evaluated main.ts. The minimal candidate intentionally does not copy the renderer/application dependency tree, input assets or binding files. These mocks/source checks do not prove real GPU cleanup behavior or product acceptance.
No installation, provider changes, new dependencies, Git/commit/push, Root authority/lease/runner/clock/output records, DLL/native method/interop execution or further delegation. Preserve the original candidate/local work; no automatic live continuation.
