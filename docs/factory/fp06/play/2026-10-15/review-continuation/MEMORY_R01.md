# Factory post-startup memory admission v1

Decision: memory cause candidate 1 of at most 3, 17 October 2026.

The fifth paid facility fails admission at 268,626,378 bytes against the unchanged
268,435,456 byte cap. The existing scene ledger contains 149,622,408 bytes of
startup mesher scratch although startup publication has finished before Factory
extension admission. Factory construction pauses the existing Native owner;
its busy barrier excludes simultaneous terrain/structural/neighbor work.

Reuse the adjacent `estimateHvpStageCpuBytes` lifetime calculation. Factory CPU
admission is:

```
estimateHvpStageCpuBytes(ledger, ledger, 0, physicsPrepareBytes)
  - ledger.factoryCpuBytes + factoryTotals().cpu
```

This keeps live scene storage, the full Native preparation allowance and all
current Factory retained/staged costs, including the already bounded S1 import
peak. It removes only expired initial mesher scratch and replaces the initial
Factory charge with the current charge. Mesh/triangle/draw caps and rollback
remain unchanged. Observed failure terms give 219,667,266 bytes under this rule.
No Clock policy, geometry, material authority, checkpoint format or public
canonical representation changes. All historical failed evidence stays.

Pi plan review supports the formula; parent independently checked its arithmetic
and the startup/busy-barrier callsites. Verification must still prove the change:
observed-number admission with the Native reserve, genuine excess rejection,
unchanged cap, existing resource/Factory tests and the same normal paid five-
facility build. A passing isolated estimator test alone is not gameplay PASS.

Implementation owner: one existing Pi writer; /root alone integrates and accepts.
Allowed product/test files: src/hvp/hvpBootstrap.ts and tests/unit/hvp-bootstrap.test.ts
under apps/weltraum-browser. No other product mutation is authorized in this unit.

## Fresh result

Pi left the one-line product patch and 23 lines of tests before its provider
reported `GoUsageLimitError` (five-hour window). Parent reviewed that exact diff.
TypeScript PASS. Factory/resource selection: 6 PASS, 47 filtered SKIP, 26.23 s.
Unchanged unprofiled original paid-band pair: 2 PASS, 39 filtered SKIP, 6.14 s tests.

The original normal fifth-build stop is now PASS: a fresh real-input browser run
installed the same five paid facilities, consumed Cutter custody and returned
construction Ready / Native Idle. Total mass remains 2,984,400,000 mg. Former
has 13 visible S1 parts, Cutter 12; both modelError null. Tick 5027, no
SimulationHold. Evidence: memory-r01-normal-build-2026-10-17.json and
08-memory-r01-five-paid-facilities-1792240322422.png. The diagnostic distributor offset
still needs a workable cable integration; this is not the full production loop,
15-minute acceptance, combined Save or browser-restart PASS.

Exact-diff independent local review found no blocking issues. Production build
PASS (`npm run build`, 3.87 seconds command, existing chunk-size warning).
The normal-input recording was finalized at
memory-r01-video/page@ab1e850a95020f13b56a97013a7844c7.webm. Closing this unsaved
diagnostic browser finalizes evidence and does not prove combined persistence.
