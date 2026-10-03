# RD10 first-terminal-failure repair — ready for HEAD recheck/wiring

Bounded repair of the confirmed P2 on candidate
`5bd233c8f950423f4bbf73c872aca6610792c377`, tree
`32ae82a0d46ca7044dffc50b069fd8321005cf19`. New candidate must be its direct
child. Original task START remains `4788520ef7cecc5db62da8d51f0daaa8ac8bdd09`;
source base remains `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Sole writer, one sequential heavy lease, no delegation or GPU/browser work.
ProductIntegrated=false.

## Root cause / smallest repair

Traced all factory callers and writers: native main.ts and unit mounts consume
the same factory; WebGL2 loss, WebGPU device-loss and uncaptured-error callbacks
call `fail()`. Initialization catch is the other failed-state/reason writer.
`release()` loses the owned GL context with its listener still registered.
The queued cleanup event overwrote compile failure, and async device failure
could separately be overwritten by initialization catch.

Both writers now preserve an already-failed status/reason. Catch still releases
partial allocations and handles abort; real loss from a previously supported
state still reports failed and cleans. No listeners disabled, lifecycle/channel
refactor, new API, material port, normalization or geometry change.
The catch status assertion widens TypeScript's narrowing because asynchronous
callbacks can change the factory-owned state during awaited initialization.

## Permanent oracle and real RED/GREEN

All original 14 test cases/assertions retained. Existing partial-compile oracle
now explicitly queues cleanup loss, delivers it through native EventTarget,
and checks original report reason plus `readFacts().errors`. Added supported
context-loss cleanup and async WebGPU device-loss-versus-catch checks.
No real GPU, timing, browser, global configuration or product writes.

- RED: actual old factory,16 observed,2 assertion failures,14 passed,0 skipped,
  exit1. Compile reason became loss reason; device-loss reason became secondary
  pipeline rejection. No import/build/binary failure was counted as RED.
- GREEN: same new oracle,16 observed/passed,0 failed/skipped,exit0.
- Native EventTarget callback delivery and actual factory were exercised; GPU
  objects are guarded doubles. Cleanup verifies owned resources0, mounted0,
  shader deletion/context loss/device destroy/unconfigure once, double dispose.

Old factory SHA256 `b74bec31f5a21ccee00e325ea12999854e700926d427bf8605bc582b5ec25578`;
repaired factory `e2828ce924d798306f530656c6a102af4c86ab868125bbb4f8df4ebce7bc628d`.
Unchanged RED/GREEN oracle `44f82c11b4e85b7dbbdab16dafec6f740812274e480566168a94c3c81868c24b`.
RED raw log `45e24e9ca086faba8b68c2dc7d3d55f11d75fe830bbf4fb6c839f27f1220ad7f`;
GREEN raw log `71ea6fd4a1ed040f1f8e27a47c5e241d0170faec6344674a7e0d3e1e5135f14a`.

## Fresh commands / evidence

All run from the own Lab working directory with explicit
`C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`:

```text
reports/RD-10/repair-first-failure.mjs preflight
reports/RD-10/run.mjs repair-first-failure-red unit
reports/RD-10/run.mjs repair-first-failure-green unit
reports/RD-10/run.mjs repair-first-failure-check check
reports/RD-10/run.mjs repair-first-failure-types types
reports/RD-10/run.mjs repair-first-failure-build build
reports/RD-10/run.mjs repair-first-failure-boundary guard
reports/RD-10/repair-first-failure.mjs verify
reports/RD-10/repair-first-failure.mjs commit
reports/RD-10/repair-first-failure.mjs receipt
```

Types/root/focused checks PASS. Build PASS **existing RD00/RD03 entries only**,
not RD10 optimized evidence; original >500k chunk warning retained.
Boundary uses `--task RD-10 --start 4788520ef7cecc5db62da8d51f0daaa8ac8bdd09
--base b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Final boundary/diff/commit
and exact SHA/tree/parent/paths are verified in the new external receipt:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/repair-first-failure-20261003/receipt.json`.
New raw command logs/exit/hash records use unique `commands/repair-first-failure-*`
directories. Original candidate.json/reports, private fixture/comparison/source
records, shared18 and reference cards7 remain byte-bound and unchanged.
Self diff review only; repair independent review NOT_RUN.

## Original HEAD reproduction and remaining limits

HEAD's unchanged `rd10-first-failure-probe.mjs` was read and script-hash bound,
not executed by this leaf. HEAD may rerun it against the repaired factory:

```powershell
& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd10-first-failure-probe.mjs'
```

Prior HEAD runtime FAIL is user-reported with retained tool transcript; no
raw-log hash fabricated. The permanent unit regression now reproduces the
same actual-factory compile failure and explicit queued cleanup-loss ordering.

Original DEV/browser proof remains **historical for 5bd/b74**, NOT current
evidence for the repaired factory. Browser rerun NOT_RUN; optimized RD10 stays
NOT_RUN_PENDING_WIRING until HEAD applies the original HANDOFF.md's real
factory/HTML wiring and supplies this leaf the actual new START/tree/freeze.
No target GPU, art, performance, native gameplay or product qualification.
No new service/listener/native browser context; test-owned handles/globals
cleaned; no foreign cleanup, network/refetch, install, publication or source/
shared Root changes. Automatic throughput files remain untracked/unstaged;
original all-files gate remains the accepted narrow exception, not clean.
