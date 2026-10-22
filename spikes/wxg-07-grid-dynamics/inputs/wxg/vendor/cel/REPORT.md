# CEL-01-WXG-00 report

Implementation: COMPLETE finite code candidate. Code/oracle: PASS (72/72, exit 0). Independent read-only review: PASS after both binding fixes. Environment: LOCAL_WINDOWS_ISOLATED. Recommendation: CANDIDATE for WXG/ATM contract consumers. Product integration: NO. Reference/cross-device/ARM/deployment: NOT_RUN. Hardware/GPU/scene changes: not applicable to this pure slice. Exact final dirty/index/patch bytes are in the detached seal.

## Demonstrated behavior

Six physics/optics/weather candidates validate and export with exact references and provenance. Units/ranges/gases, body/star/ephemeris/frame, profile digests, sample species, immutable records and full epochs/events are checked. Hestia has missing gas/substance data; Methane lacks saturation; both are deliberately Unsupported. Airless has no fabricated weather sample/rain; gas giants use pressure levels without ground. TidallyLocked matches the unchanged source orbit through existing orbitalPeriodSeconds.

Same-tick profile/event/source/checkpoint changes produce new WeatherSnapshotId. A-B-A and real one-worker query reorder preserve full canonical bytes. Stale or forged results fail. Fractional/negative/unsafe ticks, nonfinite values, invalid ranges/units/refs, camera/microsecond inputs, unbound precipitation/species and source/tool/fixture byte drift reject. Catalogue Storms hazard never creates an active storm.

## Fresh verification

`scripts/repro.mjs --run-id local-functional-04` exits 0: tool bytecheck, TypeScript strict single-thread build, independent Python oracle and 72 focused tests all exit 0. Node test isolation none keeps a single real worker active for the reorder case. Actual adapter and GPU timer are NOT_APPLICABLE/NOT_REQUESTED, not numerical zero. Host load was concurrent/uncontrolled; durations are diagnostics, not acceptance measurements.

Initial independent read-only review found two real binding gaps: a receipt could reuse old PASS inputs and declarations were not included in build hashes. Both fixes are implemented and covered by three new receipt regressions. Run 04 captures all tested own/snapshot/vendor sources, fixtures and emitted outputs; receipt checks them plus raw log bytes before writing. 32 runtime modules and 31 declarations are bound. Initial findings remain in tests/review-initial.json; final confirmation is recorded separately.

DevToolbox execution `58898e9d784c4029b38f22628e566d4e`: Specs PASS/exit 0; inherited Pinned Node22 full typecheck FAIL/exit 1 because `apps/weltraum-browser/node_modules/typescript/bin/tsc` is absent. Raw result is in `tests/devtoolbox-verification.json`. No product dependency repair or qualification was attempted. Completion preflights returned degraded/advisory with canProceed true; this is not a product PASS or approval.

The scoped manual evidence and final independent review are sufficient for these four finite spike tasks under that advisory preflight. Task checkboxes may be completed without changing the inherited failed execution/product check or overriding any gate. No archive is requested/performed.

## Preserved failures/corrections

Initial own control expected authored hazard order instead of the existing catalogue's canonical sorted order. The failed log remains `tests/original-control.log`; the corrected canonical expectation passes. Initial contract oracle failed MODULE_NOT_FOUND before implementation (`tests/initial-red.log`). Initial full run remains 61/64/exit 1; its three deepStrictEqual failures compared null-prototype frozen objects with JSON/worker normal objects. Tests now compare exact canonical bytes, preserving every value assertion. Its original fixture/golden bytes remain with that run. The preliminary TidallyLocked arbitrary rotation was corrected to the existing source orbital period, with a new rejection regression; older bytes remain historical, not accepted final fixtures.

Sandbox-only Node child-process EPERM and Git-LFS signalpipe failure were resolved through scoped approved execution; no configuration/daemon/process changes. Tool collector first-create/check passed; overwrite refusal exited 1 without changing outputs. Source/scope checks retain normal LFS filters, avoiding false hydrated-image changes.

## Limits

This is an authored diagnostic read contract and validator package, not ClimateCompiler/W1 dynamics/precipitation/saturation/atmospheric flight physics. Synthetic gas/heat/optical constants do not establish natural values. Macro-geography is a frozen synthetic projection binding, no seed or product PlanetaryMacroData mutation. Events are opaque bound inputs, not a second event authority. PLT WASM is only its original load/byte probe; no weather kernel or throughput conclusion. Structured encoding is existing finite canonical JSON, distinct from PLT NM bytes.

Product adoption needs actual data and A0-owned Core/Save/Flight regressions; performance/hardware acceptance needs the single runner and authorized free window. No source/schema/save/solver/renderer/product package change. No human review approval, commit, push, merge or publication is implied.
