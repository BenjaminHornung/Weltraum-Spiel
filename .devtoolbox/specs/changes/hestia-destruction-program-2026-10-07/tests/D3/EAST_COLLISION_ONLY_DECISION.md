# Decision required: collision-only derivatives for unused East renders

## Current evidence

Current r31 also passed the complete native functional chain (actual exit0/1PASS): product-r25 Source8ddb83e3/Build933cf998 unchanged, all93HTTP files verified before/after, full East Save parity and real384to352 Applied226ms, both contact routes and eleven zero-disposals including all six new private-Cold retained counters0. Current main cuts332.5/225.4/244.2ms; main/Cold/EastCold SceneReady7925.4/7520.4/16036.6ms and OwnerRPC156.5/184.2ms. n1diagnostic gives no qualification or general gain. The r30 failed pair is preserved separately. Only G0/D1 mechanisms are qualified; later gates and formal42/1400 remain open.

The complete r29 native diagnostic passed with genuine Save/ColdLoad, East384→352, all normal contacts, expected GL failure and eleven zero-disposal receipts. Main cut Render328.4/240.5/228.5ms; main/EastCold SceneReady7613.8/15485.7ms. D2/D3/D4 are not qualified and the formal42/1400 series have not started.

In terrainProducts compileChunks, neighborRaw is built by the combined chunk pipeline at lines400–401. Only neighborRaw.collision is read at line413. East render meshes are neither cached nor adopted. The visible East projection comes from the separate neighborProjection path. An independent source audit confirms that this render work is unused.

Actual saved-input diagnostic `chunk-east-render-attribution-test-r01.json` exited0/1PASS: all256 primary and256 East jobs, same complete512 output SHA `314aa27bf2a0fee5d94ba9b4221a8b717125e2c03a5329cfa71b68574c7af809`. Primary render mesher1095.5091ms, East render mesher831.3062ms; both fixed256 calls/completions. These are test-only active-next elapsed sums including observer/descheduling, not actual browser workerCPU or a proven831ms SceneReady reduction. Full worker transport/checkpoints are outside this mock adapter.

## Authority boundary

Corrected Arbeitsauftraege/Phase_1_G0_D5.md requires: "32³-Arbeitseinheiten, gemeinsames Halo, kombinierter Render-/Collisionjob." Its interface says ChunkProducts contains Render and Collision with exact coverage/version binding. The existing generic collision worker lacks the full World/Session/Epoch/Source/Base/Material/physical-halo/neighbor binding, so switching to it directly would weaken this contract. No such switch has been made.

## Proposed narrow exception, pending user decision

Permit a separately bound private collision-only chunk derivative for neighborRaw work where only collision is consumed. Keep the current combined derivative for primary/ordinary chunk products. Use the same32³ core/34³ halo, complete existing Source/world/epoch/version/neighbor identity and a distinct private job/algorithm binding so combined and collision-only requests/results cannot be replayed as each other. Reuse the existing collision greedy kernel; do not introduce a second mesher. Never adopt an empty render placeholder as a claimed complete render product.

Retain every current manifest field: worldId, renderVersion/collisionVersion, sessionId, epoch/generation, sourceDigest/baseDigest/materialDigest, chunk/coreOrigin/coreDimensions/haloWidth, originMeters/sourceOrigin, haloBinding/physicalHalo/haloNeighbor. Retain the original chunk input-digest checks, fixed34³ raw-slot bundle and material-domain0..4 validation, and the existing inside-or-confirmedNeighbor physical mask before collision meshing. Only render meshing/packing may be omitted after these checks; a binary-only request lacking authenticated raw Source/halo derivation is outside this exception.

Preserve all256 East collision chunks and native coverage, visible EastLOD and AO, existing public Source/World/Save schemas and hashes, caps, admission/custody/error/cancellation rules, two-worker limit and gate thresholds. This exception grants no phase2 or phase3 work.

Acceptance for the exception: forged/wrong-purpose/stale/cancelled result rejection; complete primary packet equality and complete East collision equality against the sealed current path; logical old/new/transfer/resource receipts; native XYZ/contact/save/cold/recut/disposal and normalUI/screenshots in freshly Source/build/HTTP-bound AB runs. Then measure the same workload again before any performance-gain or D3 claim. This saves a verified unused computation but does not by itself solve the other Ready/Owner/CPU misses.

Decision alternatives: authorize this scoped exception and implementation; or keep the combined contract, retain this finding as deferred, and continue only optimizations inside that contract. The overall goal remains incomplete either way.
