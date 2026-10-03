# RD11 bounded type repair — real root/focused gates PASS

Same leaf, sole writer, no delegation. This repairs only the two owning type
findings on unintegrated Phase1 `eb7fe140f0d6d49be4e1b19764e211fd1ade8b88`
(tree `f8fbd60e42fc6614b144e8aed334534c7dac0cf1`). The local repair commit is a
direct child on `feature/hestia-rd-rd11-2026-10-02`; its exact SHA/tree/delta and
closing receipts are external to avoid a commit self-reference:

`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/repair-node-defaults-eb7fe140-20261003/FINAL-TYPE-REPAIR.json`

ProductIntegrated=false. HEAD's accepted freeze remains
`e42bf9e771e651306b6cece5e4116d4e4e25af9c`; product read base remains
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. No shared wiring or whole-Phase1
acceptance is implied.

## Owning repair and evidence

Installed Three and @types/three remain exactly 0.185.1; TypeScript remains 7.0.2.
All assignment sites/callers were traced before editing. Pinned NodeMaterial.js
`setupDiffuseColor` at834 selects stock `materialColor` when colorNode is null;
838–840 multiply vertex colors once; 864 retains the material opacity path.
`setupLighting` at1109–1113 selects `materialEmissive` when Lambert's emissive
Color exists, then adds it to outgoing light. Lambert's constructor copies stock
MeshLambertMaterial defaults and declares no emissiveNode; its pinned declaration
inherits NodeMaterialNodeProperties plus MeshLambertMaterialProperties. HEAD's
isolated emissive assignment really failed TS2551. Compiler internals are not
proved, but the structural colorNode assignment is the isolated timeout trigger.

Removed only the redundant colorNode assignment/import and unsupported Lambert
emissiveNode assignment/import. Kept `material.emissive.copy(material.color)` and
supported explicit `opacityNode = materialOpacity`. Exact linear colors,
vertex/AO buffers, normals, indices, opacity, depth, sides, F01 profile and
F04/F06 emission/replays remain checked. No full-color/shader substitute, new
cast/any/shim/augmentation, pin change or gate weakening. The diagnostic
colorNode boolean now honestly reports no custom override, not missing color.

## Explicit oracle correction, not unchanged-oracle evidence

The two old identity/non-null assertions were implementation overconstraints,
not REN12 material semantics. They now check null colorNode and absence of the
unsupported emissiveNode property. All other original16 assertions are preserved
exactly; the binding check compares that prefix after only these two corrections
and necessary imports. One appended permanent check inspects the **real imported**
NodeMaterial diffuse/lighting expressions for native color, one vertex-color
multiplication, opacity and Color emission. It is a pinned-source/API check,
not native shader compilation, GPU readback or image evidence.

- Original16 SHA256: `5869b242b1a22c93090ddcdec9b9819bd5b51cf4c5c8ff6782b11b78725fbba3`.
- Corrected17 SHA256: `31def227fd4f4d129bb5173276524bbfdb7520aedd3cca90630b2e26ad9c1918`.
- Frozen ROI SHA256 unchanged: `4a194e1269db4b873eb1a87da94afea9a0f4dd9ba574c7ebbfe27c34761067da`.
- Fresh corrected-oracle RED:17 tests,15 pass, exactly2 property failures on old
  projection; pinned native-default expression check passed. Identical corrected
  oracle GREEN after the repair:17/17. This is new API/default evidence, not a
  claim that the original14/15/16 oracle hashes or prefixes are still unchanged.

Before edits,146 original source/oracle/command/raw/result/HEAD diagnostic records
were copied into the fresh admitted repair root. `ORIGINAL-SNAPSHOT.json` SHA256
`35bdb4a913bba70db3fad80e3cfe118e89e29db603f268b7ebf942d463d4d854` binds them.
Original14/15/16 behavioral RED/GREEN histories remain valid for their old source.
Old HANDOFF, phase1 report, compiler-smoke, original gate helpers, failed attempts,
trace/temp/media/baselines are retained, never overwritten or reissued as fresh.

## Fresh verification

`repair-node-defaults.mjs <operation> <fresh-label>` records actual binary/argv/cwd,
source/test/binary SHA, raw output and observed close/exit. All programs/caches/temp
use explicit C-owned paths. Type checks spawn native tsc.exe directly, one
sequential job, with a90s watchdog; no wrapper-child timeout or syntax/build
substitute. Original root/focused strict configs and inherited skipLibCheck are
unchanged. No diagnostic path mapping or narrowed replacement root gate.

| Check / label | Actual result | Wall seconds |
| --- | --- | ---: |
| types-smoke / native-default-smoke-01 | PASS exit0,702 files | 0.129 |
| types-smoke-single / native-default-smoke-single-01 | PASS exit0,702 files | 0.350 |
| types-focused / focused-types-repaired-01 | PASS exit0,782 files | 0.185 |
| types-root / root-types-repaired-01 | PASS exit0,869 files | 0.380 |
| unit / corrected-oracle-red-01 | expected FAIL exit1,15/17 | 34.023 |
| unit / corrected-oracle-green-01 | PASS exit0,17/17 controlled CPU | 36.292 |
| syntax / final-01 | PASS nine TS files; syntax only | — |
| Node --check repair-node-defaults.mjs | PASS exit0 | — |
| source bindings / precommit-01 | PASS622 original /18 shared /429 public bytes | — |
| guard / scope-precommit-01 | PASS exit0,52 inputs,zero violations | 2.849 |

HEAD's original committed smoke timed out with SIGTERM/empty output at its90s
watchdog (observed wall90.971s). Its same-config isolated color assignment timed
out25.313s; omission0.204s and explicit opacity0.203s passed. The repaired smoke
also passes with the original smoke's singleThreaded/extendedDiagnostics flags
in0.350s; it retains the supported TSL opacity and emission Color operations.
Mapped isolation and full public-import smoke are distinct diagnostic workloads,
not a benchmark or a GPU/performance claim. The original probe was not repeated.

Source19 accounting is explicit: only projection and unit oracle changed; the
other17 files remain byte-identical. Original622, shared18, public429, all52
inputs, source profiles, scenarios, cameras, locks, runtime-owner/lifecycle code
and frozen ROI remain unchanged. Closing staged/postcommit guard and final
binding receipts supplement the precommit checks. Original all-files gate stays
`FAIL_ACCEPTED_NARROW_EXCEPTION` solely for automatic untracked regular
throughput logs; they were never manipulated, staged or published.

## Exact repair delta (lab-relative)

- `src/experiments/three-webgpu/projection.ts` — use stock color/emission defaults.
- `tests/RD-11/unit.test.ts` — two justified property corrections and one real-source default check.
- `reports/RD-11/native-default-smoke.ts` — supported native-default/TSL smoke.
- `reports/RD-11/tsconfig.native-default-smoke.json` — unchanged inherited strict diagnostic config.
- `reports/RD-11/repair-node-defaults.mjs` — guarded preservation, real checks and child receipt.
- `reports/RD-11/TYPE-REPAIR-HANDOFF.md` — this bounded repair and oracle disposition.

## Review, remaining gates and cleanup

Self-diff review covers exact material/test delta, supported defaults, guards,
watchdog/receipts, immutable history and scope. SO02's immutable **original eb7**
static review (`HEAD/reviews/SO-02-eb7fe140-rd11-static.md`) identified only these
two P2 findings and agreed with documented oracle correction; it reported zero
additional fixture/replay/lifecycle/admission findings. Its declarations were
unavailable and it relied on HEAD's diagnostics/pinned-source evidence. This is
not independent review or acceptance of the new child. HEAD must freshly verify
and independently review the exact repair before integration.

Build, browser, native C1/C2, screenshots/ROI, GPU qualification, performance,
art and product checks are NOT_RUN under this grant, not passing CPU surrogates.
Original missing-feature/quality inventory remains unchanged. HEAD alone owns
shared registration/Vite wiring and the new immutable Phase2 snapshot. Do not
resume Phase2 from mutable CURRENT_FREEZE or old evidence.

All new spawned jobs have observed close/exit receipts. No browser/server or
managed long-lived service was started. Artifacts/caches/temp and failed evidence
are retained; no deletion, foreign cleanup, delegation, DevToolbox execution,
package/lock/global/product/save/DB/golden change, push, PR, deploy or release.
