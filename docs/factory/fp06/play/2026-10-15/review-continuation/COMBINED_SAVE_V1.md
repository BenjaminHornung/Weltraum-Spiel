# Combined Factory checkpoint v1

Integrator decision, 17 October 2026. This implements the user's existing W10
request; it does not amend legacy formats, Clock policy, receipt history or caps.
The native read-only W10 plan and independent discovery were reviewed before
this decision. One delegated writer; /root integrates shared Runtime paths.

## Format and identity

Use a separate `fp06-combined-checkpoint-v1` envelope and gameVersion, separate
IndexedDB namespace `weltraum-hestia-factory-v1`, slot `factory-primary`, reusing
the existing repository's atomic payload/metadata transaction and CAS. No legacy
slot migration, export UI, settings system or changes to legacy V1 decoders.

Persist the existing logical Host session ID and epoch exactly. Derive the
Domain ID again with bindFactoryDomainSession(saved terrain.sessionId) and
verify all embedded bindings. Keep receipt bytes/IDs unchanged. The fresh
myEpoch/hvpMountEpoch remains a separate liveness generation; Factory Host
publication and input surface binding use the restored logical epoch. Worker
World sessionId remains its separate persisted UUID, as in existing core restore.
No stored Rapier handle is an identity; reconstruct handles from semantic owners.

The envelope binds and validates these complete parts:

1. Exact source V5 base bytes/digest plus current Terrain root/leaves, revisions,
   Terrain/Structural/Moving receipts, Plants and Neighbor. Reuse existing bounded
   grid/terrain decoders; a regenerated initial V5 world is not a saved world.
   Bind current catalog, source, solver and policy versions to installed constants.
2. Native Core V1 fields, confirmed tick, Player pose/velocity and View. Add Native
   Factory revision, cargo site/open receipt, semantic installed profiles/poses/
   masses/material containers, Carrying/Deposited custody and completed txn IDs.
3. Every Material container definition/state, reservation and receipt; logical
   installations; complete DryFactoryState including lastStep, rational SOC,
   control/restart state, machines/jobs/WIP/energy/replays, belts/packet/position/
   credit/cursors/receipts; lastPower and all paid links/routes.
4. UI command history and lastReceipt, recipe selections/revisions, waitingStarts,
   publication revision and confirmed Host cursor/restticks/Factory steps.

Reconstruct resource snapshots with existing factories. Expose narrow pure
checkpoint validation wrappers over existing material assertView and production
state/job-material validators. Reuse assertFactoryBeltState. Extract pure power
state validation from the existing step rather than advancing time to validate.
Reject unknown/duplicate IDs, invalid canonical bytes, missing state or malformed
cross-bindings; a JSON parse plus type assertion is not checkpoint validation.

Require bijection of Native/logical installations with paid BOM/profile/mass/
pose, current custody/material ownership and WIP/belt reservation facts. Validate
paid cable routes/endpoints/millimetres against their actual paid containers.
Historical materialBinding strings remain historical snapshots. Prove normal
installation reconciliation would be an exact no-op: missing battery SOC,
buffers or machines must reject instead of creating initial resources/energy.

## Atomic capture and cold restore

Save is available only in already confirmed Paused state, neutral acknowledged
input, no pending RPC/prepare/finalize, pendingDomain, pendingBelt or RecoveryHold;
Factory observed nativeTick must equal Native tick. Committed waitingStarts/WIP
are saveable progress. Synchronously capture held Factory DTO/root/header and
raise the Save barrier in the same JS turn. Then request one synchronous Worker
capture of Core+Factory plus checkpointAsync Terrain capture. Recheck the held
witness before CAS. Public confirmed=false during saveBusy stays honest; no
general bypass or temporary confirmed=true. Ordinary validation/CAS/storage
failure retains slot and scene. Worker deadline failure or unproved Native
state requires RecoveryHold and forbids Resume; the saved slot remains intact.

Factor the existing Native core serializer privately. Preserve public legacy
checkpoint()'s Factory refusal. Add FactoryCheckpoint RPC/client method and its
recoverable-command allowlist entry; retain the existing 20-second deadline.
Do not expose a general restore/teleport command or create a second World owner.

Continue performs a cold navigation to `/factory.html?factoryLoad=primary`.
Validate the entire bounded record before sole-World allocation. Initialize
semantic Native Factory owners and seed construction/session/history owners
from validated state; do not replay build/pickup transactions or fresh resources.
Recompute support, service, access and handles from Native geometry. A legitimate
saved WAIT_SUPPORT/WAIT_SERVICE state remains legitimate; do not impose fresh
placement/reach admission on it. Fresh-game checks remain unchanged. Stage the
existing GLB/S1 assets and publish only the complete coherent scene. On failure,
dispose candidate resources and show an error with the saved slot preserved.
Restore is Paused, no offline progress; only explicit Play starts simulation.

## Limits, scope and acceptance

Keep 16 MiB transport payload, 64 MiB decode budget, 256 MiB CPU cap, Native
64-body/4096-collider limits and existing <=16 Factory membership limits. Bound
lengths/RLE before large allocations. Reserve capture's existing 64+16 MiB
working set against actual retained memory (exclude retired startup scratch,
retain Native preparation reserve), following MEMORY-R01's measured accounting.
Before enabling Save UI, measure the complete built scene plus actual payload
against the same cap; an excess is a blocker, never a reason to drop reserves.
Never shorten receipts, silently migrate old Goldens or raise timeouts to fit.

Five sequential writer/review units: pure validation wrappers/full codec/store;
Native capture/initial hydrate/RPC with Native cleanup tests; Factory owner seeds;
Bootstrap Save/Cold Continue UI with staging cleanup tests; real restart evidence.
No codec may be called validated before its complete pure validators exist.
Planned new W10 files remain
factory/persistence/{factoryCheckpoint,factorySaveStore,restoreFactorySession}.ts
and hestia-prototype/persistence/factoryWorldParts.ts. Extend only actual owner
and protocol seams required by those units; no unrelated engine/settings work.

Verify codec/tamper/CAS/cap failures, WIP/manual phases/belt credit/custody,
Native hydration cleanup, unchanged legacy guards, TypeScript and build. Parent
must then Save normal paid production, close the actual browser process, reopen
its dedicated persistent profile, Continue, compare saved progress BEFORE Play,
and finish once with no duplicate output. Paused state must not grow. Actual
rendered UI/input evidence and clean-copy startup remain mandatory, not implied
by passing tests or this decision.

## Unit 1 accepted separately, 2026-10-17

Full pure codec/store run: 11/11 PASS, 28.55 s test / 30.04 s total; paid immutable fixture setup 7541 ms. TypeScript PASS. Final exact review additionally found missing Native Facility ownerId===instanceId/equality required by live prepare. The minimal validator condition and one newly signed paid-W09 identity counterexample were added by writer2 with disjoint ownership. The affected paid group then passed 5/5 (7 filtered SKIP), 15.53 s test / 16.90 s total, including both happy roundtrip and new rejection. Root checked the final condition/diff; earlier review findings and failed logs remain. No timeout was raised and no old assertion/Golden was changed.

This accepts only pure Unit1 DTO/codec/atomic store and its validators. Native capture/hydration/RPC, Factory owner seeds, Bootstrap Save/Continue, capture memory coexistence and actual persistent browser restart are still open. Unit2 follows only after the bounded contact-motion candidate is quiescent and accepted. No extra public restore API or new World owner is implied.
