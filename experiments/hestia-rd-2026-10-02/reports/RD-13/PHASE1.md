# RD13: actual bounded voxel-ray prototype, CPU phase

**Result:** real `createVoxelRayExperiment`, real dense WebGL2 projection and
real greedy-mesh control authored and optimized-entry compiled. Focused CPU
checks **PASS (23/23)**. Native rendering/qualification is **NOT RUN**.
`productIntegrated=false`; no runtime/provider/reasoning attestation.

## Scope and source

Only lab-relative `src/experiments/voxel-rays/**`, `tests/RD-13/**` and
`reports/RD-13/**` are changed. No product, shared API, registration, root Vite,
package/lock, original fixture/profile/threshold/test/evidence or historical
source is rewritten. HEAD owns integration. No new dependency, agent,
DevToolbox execution/change, server, browser, port probe, GPU job, benchmark,
publication, deletion or global configuration action was used.

- Direct-parent START: `d17d970403440ccbf02d378998f69a92c87d8f09`;
  START tree: `b9ea6706b3435b659e018f96d99d80ceffc89fe1`.
- Read-only product source: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
- Immutable launch freeze SHA256:
  `9b115c1bc4d67b8afabd18d449a218638614016ded861344bbffd2ff57101d22`.
- Executable refinement brief SHA256:
  `97fac44b60d07560fbad013f533c114314766391ed15684583aa1111c8e871e7`.
- Package SHA256:
  `616955627dbfe5f645387da33adafb1b6e61e737874660b1ace2688944bedb5f`;
  unchanged lock SHA256:
  `b550953c353dacbe7cc8f869fb28d66fdf85e2e2d85827d08dd9e8812fb40404`.
- Original inventory SHA256:
  `26bf86bba1cbd1955d069ab2eac8d491b6cade59d16a004f1d094cc117ebc9c6`.

External run root throughout this report:
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase1-d17d9704-20261004-a/`.
`source-before-build.json` seals every runtime/test/config input before final
root types and entry build (file SHA256
`994db35d0c89a6eff66991beb9314837bac9d5d1c4a11209f9a345eaaf437865`;
input digest `7059200b02a7215841a26cc9a6672247ce3dfc7a723d7ea2b2034402b6638583`).
The audit checks unchanged inputs again before/after the commit.

## Actual implementation

| Files | Responsibility |
| --- | --- |
| `src/experiments/voxel-rays/volume.ts` | Bounded private recipe/SHA resolver; original slot mapping; admission; packed occupancy/known-coverage/slot texture source; same-input actual product-pure greedy mesher. |
| `src/experiments/voxel-rays/ray.ts` | Frozen production GLSL DDA/fullscreen projection and separate analytical cell-AABB/interval oracle. |
| `src/experiments/voxel-rays/index.ts` | Real LabExperimentFactory, borrowed Three host effect, live caps query, original non-voxel payloads, typed diagnostics and terminal local replacement/driver handling. |
| `src/experiments/voxel-rays/main.ts`, `index.html` | Fixture/variant/camera/tick/seek/reset/pause/step/resolution/DPR/dispose/remount controls; pending/error history; TestBridge only with `?testBridge=1`. |
| `src/experiments/voxel-rays/qualification.ts` | Authored future direct production-kernel MRT numeric/depth readback; real attachment-depth resolve; non-finite/fault/software/extension failures fail closed. NOT RUN. |
| `tests/RD-13/unit.test.ts` | Sealed 12-test RAY01–04 CPU oracle/source/admission/lifecycle suite. |
| `tests/RD-13/pipeline.test.ts` | 11 CPU-only real factory/geometry/texture-descriptor tests with an explicitly fake canvas/driver; comparison and actual canonical ray inputs. No native context. |
| `tests/RD-13/native-cases.ts`, `native.spec.ts` | Twelve explicit synthetic ray inputs and six future browser checks, including the four unchanged RAY gate titles. Authored/typechecked, NOT RUN. |
| `reports/RD-13/{vitest.config.ts,vitest.red.config.ts,tsconfig.json,vite.config.ts}` | Isolated single-worker CPU verification, retained sealed RED implementation and actual standalone optimized-entry build. |
| `reports/RD-13/{EXECPLAN.md,RAY-RULES.md,README.md,PHASE1.md}` | Plan, pre-test rules, truthful evidence and handoff boundaries. |

No SVO/DAG/brick skip, new engine/framework/schema, secondary animation loop or
duplicate original solid meshes. The independent CPU oracle is intentionally
analytical, not an implementation of the GLSL step loop.

### Frozen presentation boundaries

F01 remains the original 192×80×192 fixture. Only terrain window lower-inclusive
`[32,0,16]`, upper-exclusive `[96,64,80]` (64³) is selected. Original native crop
offset is `[96,48,80]`; default original camera is `C02-SHORE`. Outside is Unknown.
Full F01 is rejected, not resized. Other original cameras do not recrop.
Original water presentation remains; vegetation and face AO are omitted. Both
ray and genuine greedy variants use precisely that selected occupancy, original
numeric material slots and no AO. This is **not full F01 parity**.

X-fast addressing is `x + sx*(y + sy*z)`. Slot `n` refers to the bound recipe's
`materialIds[n-1]`, not sorted fixture materials; the mesher's three-bit slot
ceiling rejects values above seven. The private greedy index batching only
groups actual emitted faces by those original slots, preserving actual greedy
rectangles, normals, winding and provenance. Unknown coverage is not air or
clearance. Owner poses already world-composed are applied once. Source IDs
remain recipe-supplied where available, otherwise explicitly owner-coarse.
Canonical Float64 positions (including the exact 1.8 m F05 marker) are retained;
Float32 projection enforces the existing 1e-5 m tolerance.

Production rays retain world-metre parameters after grid transformation, test
the first cell, advance all tied axes, expose contiguous occupied exits, preserve
source sidedness and distinguish traversal overflow from a miss. Shading and
`gl_FragDepth` use actual world hit/camera inputs, not proxy triangle depth.
Shadows/GI/native material hooks/face AO remain unsupported or unqualified.

Replacement synchronously hides/retires old owned roots; only a complete new
generation is exposed. The first failure is terminal, with owned resources
disposed and its cause retained. Native upload/link/FBO failures after allocation
are not misreported as zero-allocation admission passes. Minimal real context
acquisition would not mean zero VRAM; no real context was acquired in Phase1.

## Fresh CPU verification and receipts

All commands are sequential with explicit C-only Node/Git/tsc, working directory,
PATH and external TEMP/cache. Locked install used only
`ci --ignore-scripts --no-audit --no-fund`; package/lock bytes remain pinned.
`commands/<label>.json` binds executable, arguments, CWD, elapsed wall clock,
exit/signal/error and raw stdout/stderr SHA256; logs and failures are preserved.

| Check / exact receipt label | Result | Wall clock, process overhead included |
| --- | --- | --- |
| `red-final-tests` | Expected RED: 12 total, 11 failed, one canonical Float64 check passed | 1203.3 ms |
| `green-unit-07` | PASS: 23 total, 23 passed | 4848.1925 ms |
| `focused-types-08` | PASS: own source, tests, authored native harness/configs | 286.1274 ms |
| `root-types-03` | PASS: unchanged root TypeScript configuration | 934.0318 ms |
| `standalone-build-03` | PASS: actual RD13 HTML entry, 26 modules, external `build-cpu-final/` | 856.5996 ms; Vite reports 573 ms |
| `scope-precommit`, `scope-postcommit` | Inspect raw receipts: 52 original input hashes, zero violations/links, accepted narrow automatic-log exception | Not a port check |
| `precommit-audit`, `postcommit-audit` | Inspect raw receipts: all 986 baseline bytes, all 18 shared pins, all 429 public files, unchanged build inputs and receipt/build/dependency/helper hashes | CPU-only |

Same sealed RED/GREEN unit bytes: 13,781 bytes, SHA256
`6e639a6b8129150aff6dc8447e0a55a3bd5e44d8c880de944710cd800c00ad6a`.
Final GREEN raw stdout SHA256:
`166d1661c3f2371115f4f2f2cff7bd273988aeb9eaadafa41a5933ce2a9ed829`.
Final entry-build raw stdout SHA256:
`d78c3bd4bd4b302bb6b8513af1d5c3a2529c3b7d3074395007600c553083490a`;
stderr SHA256:
`351b524197fb492920789369e7f1a271420c757633fbb553b280a181ac4c31a4`.
The unchanged 500 kB warning is retained: main chunk 598.93 kB (estimated gzip
156.40 kB). No threshold adjustment, benchmark comparison or speedup claim.

Initial wrong-oracle, type, excessive consecutive greedy material-range draw
counts and an incorrect F02 admission-negative assumption are all retained in
the earlier command receipts. The final sealed RED rerun uses the final unit
bytes (only a necessary typed-array type annotation differed from the first
seal). Its deliberately wrong pre-implementation functions still fail those
same assertions. Controlled format/overflow fault inputs are private test
injections, not modifications to canonical fixtures or actual native caps.

Review: own full source/final diff inspection; **no independent/human review**.
Root production build is **NOT RUN** and the unchanged root entry list does
**NOT BUNDLE RD13**. The separate real-entry build above is the RD13 compile
evidence, not a substituted root-build pass.

## Native/art/performance gates and handoff

Native RAY01–04, visible water/depth/shading parity, normal UI actions,
TestBridge absence in an actual browser, native format/link/FBO/upload/readback,
software/device qualification and screenshots/capture are all **NOT RUN**.
The future numeric harness hashes the actual kernel and uploaded source,
reads four RGBA32F attachments and resolves actual native depth; independent
analytical expected results and deliberate wrong slot/normal/miss/Unknown/
stale upload/proxy-depth faults must agree/disagree as declared. Missing float
extension, software/unconfirmed renderer or native faults cannot pass through
a mesh fallback. This geometric witness is not a visible-image parity claim.
Native PNG capture is not implemented or substituted with buffer readback.

GPU timing and native VRAM are **UNKNOWN**, not zero. CPU command wall clocks
are actual execution costs, not accepted performance measurements. RR03/04/05
media remain NOT VIEWED and licences/import permission unknown; cached author
native performance claims are not browser proof. No reference code was copied.

The actual candidate full SHA/tree/direct parent, exact added paths, raw file/
receipt/helper/dependency versions/hashes and cleanup state reside in external
`postcommit-audit.json`. This keeps the commit descriptor truthful rather than
self-referential. Original all-files scope remains
`FAIL_ACCEPTED_NARROW_EXCEPTION` only for the authorized automatic untracked
regular throughput logs; none are manually edited/copied/deleted/committed.

Cleanup: CPU subprocesses exit and fake-host handles are disposed. No agent,
service/browser/native session requires shutdown. Own installed dependencies,
external caches/builds/failure evidence and checkout are safely retained.
HEAD must wire the actual entry, produce a new freeze and grant Phase2 before
any native execution. This CPU leaf stops after its genuine local committed
handoff; no all-programme/core-card/art/performance/product acceptance claimed.
