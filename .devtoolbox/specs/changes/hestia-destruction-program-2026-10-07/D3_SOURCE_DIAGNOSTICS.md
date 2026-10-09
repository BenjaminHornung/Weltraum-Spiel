# D3 optional Source and Hold diagnostics

These private diagnostics distinguish contiguous synchronous elapsed work from task-yield waiting. Elapsed work includes GC and OS descheduling; it is not independently proven processor CPU time. Existing timer, solver, Hold and recovery policy are unchanged.

The measured producer retains totals/counts and only one maximum work span and one maximum yield-wait span. Trusted generator labels are bounded to 32 characters. A zero count emits no sample. Disabling measurement during a yield drops these fields and stops the coarse hooks; required scheduler clocks and recipe duration remain active. Four recent Running-to-SimulationHold transitions retain exact numeric Prepare request IDs, with an overflow count. The first historical Hold remains preserved.

## Controlled storage allowance

The existing eight-pending-reply/three-copy model is conservative coexistence accounting, not an observed count of physical VM copies or exact VM heap size. Base allowance is 418,768 bytes. Four numeric-ID Hold records are charged at 320 bytes each, and both Source timing objects are charged independently at 2,560 bytes per reply. Two incremental clock projection strings are charged at 5,120 bytes each:

The closed Neighbor load-operation label/read field and two overlapping serialized-field copies have an additional conservative allowance of 192 bytes:

Four opt-in startup population counters, their source reference and one frozen summary have a further logical allowance of512 bytes, without per-job logs:

Six guarded backend projection timestamps and the actual-key reference add128 bytes of logical scalar allowance:

The shared scene-admission failure or first cut-observation budget-disable scalar record and at most512 stack characters have a1536-byte logical allowance. A call either fails gameplay admission or reaches the later diagnostic-reserve branch; these records are mutually exclusive at that call. The fixed fields expose the current candidate, extras, high-water, cap/reserve and live/neighbor collision charges. No gameplay or diagnostic limit changes.

Five opt-in Neighbor projection wall spans (primary copy, East copy, synchronous input digest, worker wait, decode) add128 bytes for bounded producer clocks/callback state, with no retained history. Startup pool timing adds512 bytes for two borrowed IDs/stage clocks and one fixed queue/transport/acceptance summary, without per-job history. The total controlled model is524176 bytes,112 below524288; VM/DOM and external observer queues remain outside this model. These spans do not contribute to upload/commit CPU totals.

`418768 + 8*3*(4*320+2560) + 2*5120 + 192 + 512 + 128 + 1536 + 128 + 512 = 524176 < 524288`.

Headroom is112 bytes. The serialized shape bound assumes finite numbers need at most25 JSON characters, trusted ASCII command/label tokens at most32 characters and allowed ASCII command IDs at most128 characters. The modeled widest finite numbers and safe-integer counts are separately tested. Serialized JSON sizes and logical object allowances are distinct representations. This allowance excludes JavaScript/DOM heap and external PerformanceObserver queues.

## Evidence and limits

- `tests/D3/source-live-optout-green-r02.json`: actual exit 0, 17 passes. Mid-yield opt-out has the same subsequent clock-read count as the unmeasured control and unchanged complete Source views.
- `tests/D3/source-diagnostic-forwarding-r06.json`: actual exit 0, 25 passes. Exact coarse/maxima forwarding, no-yield absence, throwing sinks, four-Hold overflow and opt-out.
- `tests/D3/source-diagnostic-storage-r07.json`: actual exit 0, 97 passes. Admitted one-recipe real worker handler plus four retained Hold transitions and both timing copies; separately modeled maximal numeric/string fields and reserve arithmetic.
- Maximal-packet r01/r02 used a forbidden Resume while a preparation ticket was live; r03/r04 attempted 32 full recipes and exhausted even the unchanged 96 MiB Prepare cap. r05 exposed the old serialized Hold-size assumption. Failed receipts remain preserved. No 32-recipe/97-span admitted population is claimed by this new diagnostic fixture.

Current built product-r10 and complete diagnostic pilot-r13 prove normal Cut/Source Save/Load/ColdLoad/recut, real East admission/Park/Wake/contacts and manually paused actual GL draw fault with zero End receipts. Native93270 exit0; Source/build/all93HTTP unchanged before/after and all31 raw drop fields per mode zero. Publication breakdowns are nested diagnostics, never additional gate CPU. `diagnostic-storage-publication-green-r08.json` has actual exit0/85 passes for storage, measurement and CPU readers. These are mechanism/diagnostic checks; Ready/ColdLoad, Render and upload CPU budgets still miss. D3/D4, formal42/1400 and overall completion remain open.
