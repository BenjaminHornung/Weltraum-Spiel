# ExecPlan: RD-10 native capability probe, Phase 1

## Goal
Deliver the real `createRendererProbeExperiment: LabExperimentFactory`, native
HTML, CAP01/CAP02/CAP03 behavior tests, capability report and source-bound
comparison freeze. Terminal state is READY_FOR_HEAD_WIRING, not RD10 acceptance.

## Context
START `4788520ef7cecc5db62da8d51f0daaa8ac8bdd09`, tree
`6df6382bfcd596c464828b7938ad9ac5036aca05`; immutable product read base
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Read original RD10/SO02 cards,
package documents 01–04, own AGENTS/README/status, SO01 handoff and HEAD's
immutable RD03 integration receipt. All 18 freeze bytes verified before edits.
No delegation; one sequential heavy job, sole RD10 writer, no benchmark lease.

## Non-goals
No shared registration/config/contract edits, product changes, dependency or
lock changes, physics initialization, publication, global configuration,
foreign checkout/process access, target-GPU/performance/art qualification.
DevToolbox tracking is not authorized in this leaf; use equivalent scoped
checks, not new specs/executions or shared task toggles.

## Architecture decision
Native WebGL2 and WebGPU probes use separate task-owned fresh canvases, no
fallback and no loop. Await adapter/device/pipeline and bounded render
submission. A diagnostic triangle is NOT a canonical fixture scene. The
factory uses mountExperiment and validates imported fixture/frame identity;
it owns only its GPU objects. Unavailable metrics have no numeric value.
Limits are reported caps, not performance/memory-use measurements. Do not
extend RD03's borrowed scene/camera/root/ownerPose seam or invent channels.

## Implementation phases
1. Permanent focused unit/browser tests first; implement native factory/page.
2. Retain behavioral RED via controlled own-code faults with task-local
   guarded doubles only; restore implementation, unchanged oracle GREEN.
3. Verify bounded official sources and b3 APIs; freeze F01/F04/F06 and C0/C1/C2.
4. Run own-lab types, focused RD10 unit/types, existing-entry root build and
   native source inspection. Optional DEV browser diagnosis is explicitly
   unqualified; optimized browser gate stays NOT_RUN_PENDING_WIRING.
5. Self-review, fresh byte/scope/guard checks, narrow local commit and handoff.

## Tests and evidence
Only `tests/RD-10`; never inherited broad unit suites. Commands use RUN.json's
C-tree binaries, process-local PATH/TEMP/cache, own external RD10 output.
Retain command/exit/log/source/test hashes, RED faults, denominator, resource
cleanup, double mount, abort/late device and fixture/frame checks.
Native page/browser captures, if run, belong only in own new run directories.
The root build currently builds RD00/RD03, NOT an optimized RD10 page.

## Risks
Context-fixed canvases cannot change backend; unknown identity or software is
never target-qualified. Late init must release devices before publication.
Timer availability is not GPU time. Three TSL material port and backend are
separate axes; shadow/sky/water parity is not implemented by this probe.

## Rollback / safe stop
Stop only the affected unavailable mode. Shared public-contract/wiring changes
belong to HEAD. Retain logs and original evidence; no deletion or foreign
service cleanup. Stop only a service actually started by this leaf.

## Progress log
- [x] START/tree and 18 shared freeze files verified; scope read.
- [x] Tests, real factory and native page implemented.
- [x] Behavioral RED/GREEN and focused verification recorded.
- [x] Source evidence and comparison profiles frozen.
- [x] Self-review, fresh scope/hash checks and terminal handoff prepared.
  Authoritative local commit/SHA/tree/parent/paths are recorded externally in
  `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10/candidate.json` after
  commit (avoids a self-referencing committed receipt).
- [ ] Phase 2: HEAD real wiring/new START/freeze, optimized served tests/final report.

## Definition of Done
Phase 1 code/tests/reports exist under the three RD10 allowlists, original
bytes and shared files remain unchanged, fresh scoped guard has no violations,
and a full local candidate SHA/tree/parent and exact HEAD import/HTML delta are
reported. ProductIntegrated=false throughout. Phase 2 remains unexecuted.
