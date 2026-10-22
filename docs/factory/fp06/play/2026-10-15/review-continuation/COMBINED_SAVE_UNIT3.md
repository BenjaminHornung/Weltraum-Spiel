# Combined Save Unit3 — Factory owner capture and initial seeds

Root decision, 2026-10-17. Unit1 and BeltAdmissionR01 source/focused tests are accepted. Unit2 Native source exists and passed its first TypeScript check; its focused Native roundtrips are in verification. The stable Unit1 DTO permits disjoint Unit3 SOURCE work in parallel on writer2. This explicitly revises only implementation sequencing: acceptance still requires Unit2 before Unit3 and common quiescent type/build/review gates. Root remains sole shared-runtime integrator; two writers, no Native path overlap.

## Boundary and internal load result

Add mountFactorySession(host,catalog,restore?:FactoryDecodedCheckpointV1), optional second restore argument on FactoryHostExtension, forward it in factoryEntry.ts. Use planned persistence/restoreFactorySession.ts for the narrow seed admission/extraction. Before registering a mount require an issued decoder object, current confirmed Paused Host with the saved logical session/epoch, exact tick/terrain and actual initialized Native owners. host.current() remains separate mount liveness. No embedded identity/receipt rewriting.

The pure Unit1 decoder currently has no issued-object guard. Register its frozen result in one private WeakSet and export assertFactoryDecodedCheckpoint. Preserve that object across load: factorySaveStore.load returns {decoded: originalIssuedResult, metadata}, following the existing HVP saveStore's nested game result. This is only a new internal return wrapper; saved bytes/schema/signatures and16MiB/64MiB/256MiB caps stay unchanged. Current repository-wide callers are only the new Store test; adapt it and prove copied/fabricated wrappers are rejected. No second full Terrain decode, cast bypass or re-issuance helper.

## Seeds and no progress on restore

Initialize directly from decoded.material, logical installations, domain/lastPower/paid links, selectedRecipes/selectionRevisions, waitingStarts, complete commandReceipts/lastReceipt/publicationRevision, Host nativeTick/remainderTicks/steps (elapsedMs=steps*100). Fresh cargo only on the existing fresh branch. Do not dispatch build/pickup/production/material commands or adopt a fresh inventory into the saved one.

buildStep.ts construction constructor gets optional initialInstallations with Ready state; no mutating Restore method. dryFactorySlice.ts command history gets optional initialReceipts and readAll(), preserving insertion order, exact bytes and existing replay/conflict semantics. MaterialAuthority already accepts validated material. Before publication prove ordinary reconciliation is an exact no-op: missing buffers/machines/SOC reject rather than reinitializing resources or energy. Current Native WAIT_SUPPORT/WAIT_SERVICE observations may be derived without work at the same paused tick; no offline catchup.

## Capture barrier and witness

Expose beginFactoryCheckpoint on the session and optional extension handle, returning {host:FactoryHostCursorV1,factory:FactorySessionCheckpointV1,assertCurrent(),release()}. Read confirmed Paused/neutral admission BEFORE the private capture barrier. Require matching observed Native tick; no recovery/construction/handling/command/pendingDomain/pendingBelt. Committed waitingStarts are progress and remain saveable. Capture complete committed material/domain/history/maps/cursor and set barrier in the same synchronous turn, without renderer state.

Witness compares liveness/identity/tick/terrain/Native revision/Idle/Paused, private immutable material/installation/domain/power refs and mutable link/map/history/publication/receipt state. Do not compare the entire public Header: its confirmed=false under this barrier is honest. Pause observe() during capture so ordinary busy publications cannot advance/rewrite the captured owner. A real mutation invalidates the witness; identical old command replay remains a pure no-op. Release is idempotent and creates no tick. Dispose invalidates a held read-only capture and cleans its own subscriptions/registration.

DO NOT add pendingDomain to general isQuiescent(): the existing queued-paused-Start Resume contract deliberately needs Play to deliver its six ticks. Strict checkpoint eligibility is separate. Only an ACTIVE capture barrier extends ordinary quiescence/recovery/end-session blockers. Failed mount cleans own listeners/focus/mountedHosts; registration follows successful validation. Existing uncertain Native-transaction holds remain intact.

## Exact scope and verification

Writer2 source: factory/persistence/{factoryCheckpoint,factorySaveStore,restoreFactorySession}.ts; factory/session/{factorySession,hostPort,dryFactorySlice}.ts; factory/construction/buildStep.ts; factory/factoryEntry.ts. Preserve C02 canonical cache, accepted layouts, closed cable source refs, port projection and admittedHeader belt fix. No Unit2 Native file or Bootstrap/UI Save wiring.

Tests: unit/factory/{hostLifecycle,dryFactorySlice,factoryCheckpoint,factoryOwnerRestore}.test.ts. Reuse the existing paid checkpoint/owner fixture; a minimal extraction to tests/fixtures/factory/combinedCheckpoint.ts is allowed if required to avoid duplicating its expensive setup. Preserve all old assertions/Goldens and default timeouts. Prove paid WIP/SOC/belt packets-credit/cables/recipe revisions/waitingStarts, manual LAID_OUT/ASSEMBLED, saved remainder2+four new Native ticks=one step/no paused work, historical replay/conflict without mutation, capture versus queued Resume, witness invalidation, copied issued handle rejection, failed mount/dispose cleanup. No broad suite, global tsc or build until parent coordinates with Native Unit2. Report source quiescence first; Runtime/actual restart remain open.
