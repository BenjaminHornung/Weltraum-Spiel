# Native cold Factory startup – independent prechange review

Reviewer `/root/current_native_closure_review`, read-only, no writes/tests/jobs. Bounded source verdict: sound correction. Proposed condition is exactly factoryEnabled + finiteinitialCargo + noCheckpoint; pause synchronously immediatelyaftercreateHvpTick and before worker timercreation.

Current unsaved ticks start Running. PhysicsWorker starts timer after Session returns, while Factory Start modal requestsPause later after renderer/assets. A delayed advance can exceed the unchanged foursteps and enterSimulationHold; laterpause changes onlyRunning, so it cannot repairthat hold. With the proposed Nativeowned initialpause, advance returns before accumulatingbacklog; arbitrary finitewarmup causes no step and no clockcatchup. Existing player starts disabled/neutral. NativePlay enables player, resumesclock and resets Workerelapsedorigin. TrustedResume/Drop APIs still exist; no Play-only NativeAPI claim.

Factory withoutinitialCargo, ordinaryHVP and anycheckpoint retain currentpolicy. No newargument/protocol/clockalgorithm/60Hz/rate/budget/queue/timeout/sourcegeometry/material/recipe/save change. InitialFactorycargo is geometryonly; no new inventoryconstructor or credits.

Prechange session39221B SHA2560255e1c83ac0428326dcc90408568a10183add31725a50ebc0e6ef09dd063e3d; tickSHA2565dfb07ec90136f55ee771d941d97837fc53caa4c17bb7c7047263cf5d55e83b2; workerSHA2564516a3978ac10b0996fa9c48f6a5a0bf3d3cb297a34cf414c05408cf1bb2d4c4. LateractualRootRED/GREEN and normalbrowser have separate receipts; thisreviewalone is notruntimeclosure.
