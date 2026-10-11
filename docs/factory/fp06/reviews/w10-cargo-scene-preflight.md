> Quelle: `/workspace/.cloud-setup/fp06-w10-cargo-scene-preflight.md`; originale SHA256 `c8f7217df442a9a78af6372d4c01af551c12da5e71da70475c5a88f1da9ccc5a` (32122 Bytes). Kopie am 2026-10-11T14:45:54.477304+00:00; ausschließlich Markdown-Zeilenenden/Leerzeichen normalisiert. Read-only Vorprüfung, W10 bleibt bis W09-PASS gesperrt; kein Produktwrite und kein Save-PASS.

# W10 Cargo/native-scene preflight after W07

Prepared by `/root/w00_architecture`, read-only. This adds the actual W07 Cargo/facility source and native-scene facts to `/workspace/.cloud-setup/fp06-w10-preflight.md`; it does not replace that earlier complete SaveStore/domain analysis.

**Status: PREPARATION_ONLY / W10 NOT_RUN.** W10 depends on actual W09 PASS and a later exclusive integration grant. No product files, tests, builds, browser/native sessions, profiler jobs, verifier CLI, commits, or subagents were created. This report neither accepts an owner decision nor invents a public API. Method names below refer to actual current source; future behavior is labeled required connection or open technical closure.

## Bound actual source

Actual Integrator worktree is `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, W07 base `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. The four native runtime files have remained unchanged since historical third-seal `d1e463f86c9cb6dd2fe8d27eb187532a9c27333963bf2cdc14a3d28ec728f6b4`; the later FactorySession initialization fix and E2E harness changes do not add native checkpoint/restore capability.

Source/card read completely: W10 brief; FP01§13; FP02§12; FP03§13; FP06§8.4–8.6 and complete W10 card. FP06 lines473–477 require an explicitly designated valid Legacy-HVP component plus complete fixed Facility/Factory component, exhaustive/disjoint owners, common time/source, one native candidate World, unchanged old V1 decoders. Card lines1184–1243 depends on W09 and requires T041–T044. FP01§13.7 and FP02§12.5 require actual installed-device, links, Resources/WIP/work/energy/receipt facts; FP03§13.7–13.8 require actual installed parts and physical Cargo/packets exactly once. Planned TypeScript sketches in those documents remain sketches, not existing product APIs.

At 2026-10-11T14:33:30.680031+00:00, actual bytes were:

| Path relative to app | SHA256 | Bytes |
| --- | --- | ---: |
| `src/hestia-prototype/physics/session.ts` | `e21fd44869c96350212f62ad33c11066029de646760fd74caa1ad2752b6797fd` | 37128 |
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | `620a60b3d7d1e5edfef558fe07fac9af78cd9fc13385f9c45ad5fde1279d2eee` | 18339 |
| `src/hestia-prototype/physics/client.ts` | `b95cc8da27241962e8f3114efb797c38d4fdabbce435d9efe9c4afda75d929ee` | 32403 |
| `src/hestia-prototype/physics/physicsWorker.ts` | `1809dc32d0107d96bdb55a13e09bd386a58094c45c350c3a10bef7b42ab4f5fa` | 15865 |
| `src/hestia-prototype/physics/worldReplacement.ts` | `334d33a970b7b200ebdadffeaae4843fce4d83d0beb31728b7b70f4a3a5c7a47` | 3341 |
| `src/hestia-prototype/persistence/worldCheckpoint.ts` | `7c066fa278c124d2080acfff6a5316ec6434c08c446f44946192bce9f58f0664` | 11632 |
| `src/hestia-prototype/persistence/gameCheckpoint.ts` | `71335a3b25493145e7abb12f02fe6a31f46f7861d9da65b3d741ffef4dde990f` | 12487 |
| `src/hestia-prototype/persistence/sceneReplacement.ts` | `91ffd8be5c64dd090f9761f3a656681c170ce7b4d9ac7a918e05d00f0759518b` | 2110 |
| `src/hestia-prototype/persistence/saveStore.ts` | `3bc2e7c043b21f491b53082929652f7da3940dfe64003b92182c9435806094c7` | 3273 |
| `src/hestia-prototype/terrain/cutPlan.ts` | `d422da50cb9152a7c0e103e57071f1e2826463d279db5e7c7fac1149f4f95ac1` | 21771 |
| `src/hestia-prototype/player/input.ts` | `279ca6184a84a1376eb0a0a3a610a336457a7e9374c44bd3397ca49ece651889` | 10833 |
| `src/hvp/hvpBootstrap.ts` | `4de5d525722ee6bcf18c94a091d6f8d33f0b937708465188fd1b65c52d528b55` | 164186 |
| `src/hvp/hvpCoastSource.ts` | `13128d7ad3151da644ae909af0dbb0e2df0e91066c01f55ee566f7eedc1fdaca` | 38423 |
| `src/factory/session/factorySession.ts` | `7f1e342aecac3525bcc1b0a0f6ea579a1db2172af6f98d00d7289b7087a3a00f` | 5378 |
| `src/factory/session/hostPort.ts` | `8db32270b8a9fdadf70a6a838838bedfe02a09b1451516fb41a25fe75cd25118` | 2518 |
| `src/factory/construction/buildStep.ts` | `4e5db5b1bb70921a8ee4cfbd91da48c66f4e5686b2228805b5b0ab6ae2f8ea17` | 5734 |
| `src/factory/construction/placement.ts` | `89194437192f2788e4ea7458af06f760583f8250ccce494a89e0cc225debd09e` | 11255 |
| `src/factory/fixtures/startSite.ts` | `53725bbf06af6be92ac1b3b3e250ee6548e37bb6abf8500b4cd50e09b1ec1a29` | 2121 |
| `src/factory/fixtures/cargoSite.ts` | `83fa38b62b88c8f0c7f9351a1d30617b2704d4c04a21bb64fcc5084e8739ef0c` | 4071 |
| `src/factory/material/reservations.ts` | `4f5c1d17db3c5167dc42b23e0ab6b0a63f3a9b441684bc5140c367dd7d4d483e` | 22417 |

Root Source-Lock SHA256 then was `e22b305068146e72b89175c5d38e365475e43cf7b27c4bbe799fdb75eadc6833`. Root's accepted D11 cap is16 TOTAL fixed Facility owners including initial Cargo, under unchanged global budgets. Root explicitly accepted the15mask/70m² Factory-only source profile and zero material credit; D11 alone is not a source replacement permission. The planned W10 paths in the brief are not active write grants. At the end recheck,2026-10-11T14:38:55.165957+00:00, all20 bound product paths still matched their exact SHA256/size; zero mismatches. Later E2E-only phases do not change this source binding.

## The current complete scene cannot yet be exported/restored

| Actual surface | Current behavior / precise W10 gap |
| --- | --- |
| Native `physics/session.ts:234`–`:253` | `checkpoint()` checks disposed FIRST at235; at236 rejects whenever `facilities.read().cargo` exists OR installed owners exist. Even a fresh Factory session with zero paid machines is rejected. The method afterward encodes only legacy Drop/Inertia/moving/branch/parked bodies, player/tick/collision/coverage/receipts. It is intentionally not a complete Factory export and cannot be called from a new wrapper to silently omit Cargo. |
| `physics/factoryFacilitySession.ts:15`–`:28`,`:116`–`:188` | `FactoryFacilityRead` exposes current Cargo, revision/phase, owners and optional prepared owner. It is a read projection. Returned capability has read/open/prepare/commit/publish/rollback/finalize; it has NO checkpoint/export/restore operation. Its `completed` command Set is private. Serializing this read alone neither preserves the full runtime verifier nor restores logical state. |
| `physics/client.ts:48`–`:53`,`:65`–`:70`,`:278`–`:312` | Client has old `checkpoint()` and legacy `prepareRestore(id,HvpWorldCheckpoint,replacements)`, plus narrowly bounded live facility install/open commands. No joint legacy+Cargo+Facility capture/restore reply type exists. Calling normal install after legacy publish would create a period of incomplete World and reset/reconsume paid BOM. |
| `physics/physicsWorker.ts:21`–`:40`,`:109`–`:134` | Messages contain only old Checkpoint/PrepareRestore payloads and separate live Facility commands. Checkpoint delegates to the rejecting native method. PrepareRestore creates the old legacy transaction. Held snapshot/finalize protocol exists and is reusable in principle, but carries no complete Factory part. |
| `physics/worldReplacement.ts:9`,`:24` | Transaction first calls rejecting A.checkpoint(). Candidate B calls `createHvpPhysicsSession(...,c.sessionId,c)` with factoryEnabled default false and no initial Cargo. It cannot replace Factory A, and B has no Factory/Cargo capability. The old function must not be described as a working combined restore. |
| `persistence/sceneReplacement.ts:11`,`:19`–`:25` | Requires a real issued `HvpDecodedGame`, then stages/commits/publishes/finalizes legacy World and renderer only. A Factory object cast to that type cannot pass its WeakSet-issued guard. Its rollback/facts comparison is a useful existing lifecycle pattern, not a completed Factory scene transaction. |
| Bootstrap `:1013`,`:1995`–`:2001`,`:2077` | Factory profile explicitly rejects legacy cold load and all old Save/Load/new-session routes. There is no alternate actual combined Factory save UI/capture route yet. Correct W07 fail-closed behavior remains until W10 integration is completed. |
| FactorySession `:29`–`:33`,`:38`–`:40` | Fresh mount recreates original FP02 Cargo fixture, material revision0/no reservations/no receipts, empty installations, and Factory steps/remainder0. This is only legal fresh scenario initialization, not restore. Loaded state must be validated/adopted through a narrow joint path without calling the fixture to reset stock or battery. |

Therefore current World membership includes actual initial Cargo and installed owners, but **the combined checkpoint does not yet exist**. “read shows all owners,” “one Rapier World,” “member handles present,” or “old export has bodyCount” is not a Save PASS.

## Initial Cargo is physical source access, not another material ledger

`fixtures/cargoSite.ts:5`–`:18` is the closed `fp06-initial-cargo-s0-v1` technical fragment: stable owner `fp02_wreck_owner`, sole stock container `fp02_wreck_cargo`, sourceDigest/sourceRefs, immutable center/size/body/access/spawn geometry, profileDigest and canonicalJson. It owns NO quantity/mass/stock field, no salvage/platform/flight admission and no mining credit. `:21`–`:28` checks exact closed profile bytes; `:30`–`:37` checks source125mm support/body/service/initial hull in the original Factory baseline.

Actual private native construction in `factoryFacilitySession.ts:88`–`:95` creates exactly one fixed Cargo body and one cuboid collider in the SAME World after support/clearance/budget checks. The installed machines share that supplied private World (`physics/session.ts:65`,`:141`). Cargo appears separately in `FactoryFacilityRead.cargo`; paid owners[] excludes it. It is not a free paid storage/building BOM.

Required saved/reconstructed consistency follows current actual fields, not a guessed crate replacement:

| Cargo fact | Required joint relationship; no new API implied |
| --- | --- |
| Site version, sourceDigest, canonicalJson/profileDigest, immutable owner/container/body/access/spawn geometry | Validate against the accepted Factory initial source profile and pinned technical fragment. Do not accept a user-supplied pose or recalculate site digest from current cut terrain. Fixed source geometry is derived from the validated closed profile, not UI or packed inventory volume. |
| opened boolean and original openReceipt | Must preserve together: native initializes false/null at `:54`–`:55`; first actual open sets true/stores intent/increments revision at `:125`. A later restore must not call normal Open to “recover” state, because actual player may be far away and normal command rightly rejects out-of-reach. Closed initial Cargo must remain closed; opened saved Cargo must remain opened. |
| openReceipt.ownerId/profileDigest and original expected revisions | Validate exact shape/identity/version and historical relationship. `:122`–`:125` preserves the FIRST intent; further valid fresh open intents do not overwrite it. Its expectedRevision and expectedTerrainRevision are HISTORICAL pre-open values and can differ from today's facility/terrain revision after valid builds/cuts. Forcing current equality or rewriting the receipt would reject/corrupt valid saves. The exact history validator must be closed with actual W09 receipt/state model; this preflight chooses no new replay policy. |
| Native Cargo body/collider handles and current accessible | Handles identify actual current World objects only. Candidate B must derive new handles and verify their exact membership/profile/pose; saved A handle equality is not portable provenance. accessible is recomputed from current actual actor/LOS/support/clearance, not restored as authoritative boolean. A saved opened Cargo may correctly remain currently inaccessible after the player walks away. |
| sole Resources stock state | Saved actual `fp02_wreck_cargo` current contents/owner/revision/stack/provenance belongs to the complete Resources MaterialView. Cargo-site recreation must neither mint C01–C28 nor replace consumed C26 or partially used battery. Physical shell geometry and stock mass are different responsibilities. |

InitialCargo.sourceDigest binds **terrain baseline**: planner `placement.ts:64` compares it to `binding.baseDigest`. TerrainRoot `cutPlan.ts:119` keeps baseDigest while `:120`–`:121` changes current sourceDigest with overlay leaves. A combined save must preserve both correctly. The natural96-column support outside approved15masks remains baseline source geology; no extra terrain mask, free paid platform or material credit is implied by restore.

The Cargo owner collision fix is present at `placement.ts:58` and native `factoryFacilitySession.ts:129`. Validation must preserve its reserved identity across native, logical installation and renderer registries. A forged Facility with owner/instance `fp02_wreck_owner`, duplicate cargo container, duplicate projection identity, omitted Cargo owner or second Cargo body is rejected before candidate activation.

## Actual Facility state and membership; counts alone are insufficient

Each saved paid installation must match actual `FactoryInstallation` (`placement.ts:16`–`:20`) and sole installed Resources container, while native facts are `FactoryFacilityOwner` (`factoryFacilitySession.ts:15`–`:19`): stable owner/instance/build transaction, exact definitionRef version/digest, installation profile/sourceDigest, massMg, original complete materialBinding, centerMm/q and actual runtime body/collider handles. The source-bound closed collision recipe is regenerated from the exact accepted installation profile, not an arbitrary saved cuboid list or unknown legacy family.

`materialBinding` is historical admitted POST-INSTALL complete MaterialView evidence (`buildStep.ts:43`–`:44`, native `:155`–`:158`). Later transfers/production/installations change current Resources. It must not be replayed as present stock, used to mint quantities, or required to equal the entire current MaterialView byte-for-byte. W10 must prove the paid installed container/provenance/build-receipt relationship without replacing current Resources with that historical snapshot.

Actual native verifier `factoryFacilitySession.ts:30`–`:43` captures object identity, full body properties, collider geometry/pose/density/friction/groups and cached shape identity for all existing members. `:68`–`:72` proves exact candidate fixed body, each owned collider/parent/object/shape/bytes/enabled phase, exact member delta and unchanged old scene. This ephemeral in-memory Map is not a serializable DTO. W10 can derive a validated closed recipe/membership representation, but must explicitly prove that actual candidate B's members form the complete disjoint owner partition. No generic raw World or arbitrary body creation may be passed to UI.

Source-mandated partition of a complete paused candidate: unchanged legacy primitive component (Drop/Inertia/branch/moving/parked/player/static collision products) + initial source Cargo + each accepted fixed paid Facility, each actual body/collider covered exactly once by its correct component. Static terrain collision products remain represented by artifact-derived collision sectors/digest, not fake paid bodies. Player/parked/neighbor ownership and collision bookkeeping retain existing distinct forms. Native member counts are supplemental, not the proof; reject omitted/orphan/shared members and owner collisions.

`completed` at native `:51` is populated on finalized build `:187` and denies duplicate build transaction `:129`. A restore resetting this Set would erase native replay protection. At current fixed, no-deconstruction W07 scope all finalized owners persist; derivation from complete owner/build IDs may suffice if independently proved. No separate unbounded ledger is required by this preflight; actual W09 history decides minimal deterministic reconstruction. Material receipt history also remains intact and source-bound; it cannot be reset to revision0.

The native read revision increments on first Cargo Open and on each published Facility; exact finalized-owner/open-receipt/revision consistency must be validated before activation. Pending/prepared/CommittedHeld/PublishedHeld/recovery state is not a safe new snapshot. Existing save already refuses unconfirmed/recovery worlds, so capture waits for accepted joint operations to settle or fails honestly; it must not erase pending uncertainty.

## Required single combined capture/restore connection

This is a source-required call sequence, **not an existing public method or a write grant**:

1. Existing Host stops player input/new mutating commands and owns the same Save/Factory lease. Pause ACK must include final actual native ticks; drain or reject pending joint material/production/belt/facility work. RecoveryHold/epoch drift/unknown native outcome cannot produce a success snapshot.
2. A bounded private-native combined capture returns the valid legacy primitive part plus initial Cargo/Facility facts from ONE confirmed paused generation. The present rejection at session236 remains on independent legacy export. TerrainRoot/source/plants/receipts/view + complete Resources/production/power/belts/manual phase/clock are captured under the same pause/epoch/CAS boundary.
3. Validate all component versions, sizes, canonical IDs, catalog/source/profile bytes, exact quantities/reservations/history, common native tick/Factory clock, exhaustive native owner partition and full resource conservation before writing ONE complete record with the existing repository expectedRevision transaction. No asynchronous second Factory sidecar save; no UI success until actual write commit.
4. On load, reject invalid bytes before large decode/native allocation. Keep A paused/owned. Reconstruct a **single hidden candidate B World containing legacy owners AND source Cargo AND all paid Facilities before B is committed or published**. Actual B's internal stable-instance→body/collider mapping must be freshly proven; no sequence “legacy B visible, then late install Cargo/machines.”
5. Stage all B terrain/fragment/branch/Cargo/facility render artifacts in the shared frame hidden, actual source/Root, receipts/input view and validated complete Factory material/production/power/belt/clock state. Never re-run build BOM consumption or initial Cargo fixture. Native B commit, Factory/Root adoption and render projection publication form one closed joint transition; the paid source geometry/budget must be admitted before allocation.
6. Finalize B publication and retire A only after valid joint publication; proven prepublication failure destroys B and retains A's exact members/domain state. Unknown postpublication/finalization stays held, no optimistic refund/empty-world fallback. Existing worker restore barrier freezes timer advance while the transaction owns A+B (`physicsWorker.ts:90`,`:130`–`:132`), and previous-time reset follows finalize/rollback at128; preserve that no-offline behavior.

Actual legacy lifecycle `worldReplacement.ts:24`–`:50` already owns paused A and prepared B, checks unchanged A facts, disposes B on proven rollback, retires A only after commit, and tears down both on terminal disposal. Its generic function currently rejects Factory A and constructs only legacy B. Reuse the lifecycle pattern through a narrow private combined adapter; do not weaken closed legacy decoder/admission merely to call it unchanged.

## Source-profile and scene-codec closure

The full old `HvpGameCheckpoint` has exact version/profiles, terrain, plants, world, terrain/structural/moving receipts, view, progress, signature and optional neighbor (`gameCheckpoint.ts:20`–`:33`). Its decoder insists on current old `HVP_SAVE_PROFILES` at59–62 and calls `restoreHvpCoastSource` at106. That function wraps bytes with the OLD coast version/seed at `hvpCoastSource.ts:579`. Factory pages have different version/seed digest; a Factory baseline is **not** valid whole Coast-v1 game data. A valid old World/terrain/plant/view primitive can remain a designated component, but wrapping it as whole valid `HvpDecodedGame` is false.

The new combined scene wrapper must close these actual bindings:
- Factory source version `hvp-factory-startsite-v1`, seed `hestia-factory-layout-a-001`, existing material registry digest, normative256×128×256 cells/origin[-16,-8,-16]/0.125m and the approved initialized-baseline digest/profile; current leaves retain their own version/revision/source digest.
- Approved15mask initialization and zero material credit are baseline geology. Decode saved canonical source bytes and verify their pinned profile/digest; do not call the generator to fill missing cells, reinitialize changed terrain, or accept any valid slot array solely because it has a Factory label.
- Factory vegetation profile/source bindings and actual remaining plants/source digests. Old `HVP_SAVE_PROFILES.vegetation` is the normal coast profile; current Factory initialization deliberately has its own version/coherent vegetation. Reload uses saved validated actual plant data; no regeneration of removed wood.
- Existing closed look/effects/player/solver/view/command histories and legacy static collision product/source relationships remain unchanged primitives. Source-bound terrain material and dynamic-fragment ownership checks from `gameCheckpoint.ts:113`–`:141` remain necessary for Factory baseline too.
- Factory catalog/W01 content, installed technical geometry and Cargo-site version/profile digests; no generic profile substitution or unknown-definition fallback.

`createHvpFactorySourceSnapshot` at `hvpCoastSource.ts:570` can wrap supplied validated slot bytes under the correct version/seed. It is an actual available primitive, not by itself a complete Factory checkpoint decoder or an approval for arbitrary geology. `restoreHvpTerrainRoot` at `cutPlan.ts:289`–`:297` restores closed terrain DTO/overlay relationships but alone is not a Factory baseline-profile check. Existing Source/Plant/World/View component validators should be reused where valid; old top-level game decoder/Goldens remain untouched.

Factory clock `factorySession.ts:38`–`:40` currently resets counters on mount. Saved steps/remainder/elapsedMs/nativeTick/catalog/session/source binding must be validated and adopted rather than recredited; elapsedMs is100×steps and remainder is0..5. Actual native tick is saved by legacy tick primitive. Old timers/callbacks/epoch requests must not target new candidate B. The new Host mount epoch and saved terrain/command epochs have distinct current surfaces (`hvpBootstrap.ts:2168`–`:2172`, `cutPlan.ts:289`–`:297` preserves saved terrain epoch); the combined restore must document/check any live-epoch adoption explicitly instead of silently treating all saved epochs as fresh. The exact W09 assembled clock/state interface is not yet available here.

Material restore must keep complete actual ResourceContainer definition/state canonical bytes, revision, WIP reservations/output capacity claims and ordered request/receipt history. `material/reservations.ts:99`–`:112` validates revision chain/uniqueness/canonical requests/actual snapshots/claims privately; `:115`–`:118` only builds a NEW revision0 material view. A narrow validated whole-view restore is needed after Domain release. Reconstructing through that fresh constructor alone would lose receipts/reservations and permit duplicated jobs. W04 manual assembly unfinished reserve/laid/active/finish sequence must remain source-bound, not changed to time-driven auto-progress.

## Exact path roles requiring later grant

| Path | Reason grounded in present closure |
| --- | --- |
| Planned `src/hestia-prototype/persistence/factoryWorldParts.ts` | Complete combined Factory native/scene component codec/admission; this planned name does not imply a current implementation. |
| `src/hestia-prototype/physics/session.ts` | Private World is only here; bounded combined capture + same-World candidate initialization need a narrow actual hook. Legacy independent checkpoint guard/disposed ordering remain closed. |
| `src/hestia-prototype/physics/factoryFacilitySession.ts` | Full initial Cargo/open/revision and paid fixed-owner state reconstruction/full-membership verification currently absent. No raw World leakage/general createBody API. |
| `src/hestia-prototype/physics/client.ts`,`physicsWorker.ts` | New bounded complete checkpoint/restore transport/held receipt lifecycle; same private worker native World. No generic queue/timeout changes. |
| `src/hvp/hvpBootstrap.ts` | Owns actual source/terrain/plants/input/receipts/Save barriers/renderer/Factory scene registries and budget ledger. Needs one joint capture/publication/rollback/retire integration, actual Factory cold/in-place entry and complete hidden common-frame projection. |
| `src/factory/session/hostPort.ts`,`factorySession.ts` | Narrow complete state/clock adoption/capture coordination; current read/pause/construction port cannot restore private material/installation closure. |
| `src/factory/construction/buildStep.ts` | Actual material/installations are private; a validated restored construction state must preserve existing paid objects without executing live build again. Exact shape waits on W09 integrated state. |
| `src/factory/material/reservations.ts` | Planned narrow complete validated material-view restore after exclusive Domain release. The private assertion can be reused without resetting/replaying history. |
| Planned `src/factory/persistence/factoryCheckpoint.ts`,`factorySaveStore.ts`,`restoreFactorySession.ts` | User-authorized W10 roles for joint versioned codec/own slot namespace/existing repository/CAS and whole Factory restore. Not already granted and no invented extra cargo authority. |
| Planned `tests/unit/factory/persistence.test.ts`,`tests/e2e/factory-save.spec.ts` plus affected native/host/source fixtures | Future genuine REDs and rollback/member/source/history browser checks. Exact test grants must include the actual touched boundary; no tests run in this report. |

A separate Factory adapter can keep old `worldReplacement.ts`, `gameCheckpoint.ts`, `worldCheckpoint.ts`, `sceneReplacement.ts`, old SaveStore and generic repository unchanged. If reuse requires a narrow internal hook, root must grant that actual path; no blanket edit is justified by this table. No source mask/source pages change is needed merely to persist the accepted baseline. Current actual future W09 composition may change the minimal exact path list; inspect its accepted final bytes before dispatch.

## Budgets and newly exposed restore edge

Unchanged actual limits:
- Initial Cargo creation `factoryFacilitySession.ts:90`: resident bodies+dormant+1≤64 and current colliders+1≤4096.
- Paid fixed candidate `:135`: owners.length+(initialCargo?1:0)<16 BEFORE one additional owner, thus Cargo+at most15paid owners; resident+dormant+candidate body≤64; current dynamic bodies≤32; colliders+whole profile≤4096.
- Native session initial sectors≤4094 (`session.ts:44`), current combined collider budget≤4096 at64/101; static collision digest ≤8MiB/`worldCheckpoint.ts:32`–`:39`.
- Old world DTO bodies≤64/coverage≤128 at `worldCheckpoint.ts:51`; dynamic nonparked bodies≤32 at124; native-resident/dormant totals retain separate actual constraints. Separate Factory part does NOT grant64+16 new native bodies.
- Transport16MiB, decode64MiB (`gameCheckpoint.ts:18`–`:19`). Admission counts source/grid/leaf/body/plant working copies BEFORE allocation at63–88; whole serialized UTF8 bound at101–102. Body-source transport and decoded brick aggregation have own unchanged16/64MiB checks in `worldCheckpoint.ts:98`–`:110`.
- Whole Factory metadata/material canonical strings/historical materialBindings/receipts/source geometry and A+B/hidden renderer duplicates need explicit aggregate accounting within these existing caps. Native `nativeBytes:"unsupported"` is not a measured zero (`session.ts:202`); no native memory/performance PASS claimed.
- Bootstrap existing decode reserveA+64+16MiB at2008–2009, and native collision/renderA+B/source-copy staging admission at1911–1914 are required working-set accounting, not permission to increase limits. Facility costs currently add full historical material bytes and native collision/member staging costs at2223–2224.

Actual new edge: initial native Cargo constructor at `factoryFacilitySession.ts:93` requires source support AND vacant access service space. Current read `:103`–`:105` can legitimately show inaccessible after walking away or an actual body blocks LOS/access; support failure alone changes accessible false but does not itself set recovery (identity/pose loss does at100–101). A valid complete save must not reset opened Cargo or move dynamic blockers to make source initialization fit. An opened saved Cargo away from its actor cannot be restored by a normal Open command. Reusing the fresh initializer against already restored saved blockers may reject even though World is otherwise idle. The minimal combined restore must distinguish unchanged initialized geometry/actual saved-member validation from fresh player reach/open admission; preserve inaccessible state as a recomputed consequence where legal. If the accepted current fixed-support contract genuinely cannot represent a damaged/obstructed saved scene, report the precise rejected relationship and retain A/previous save. Do not silently repair terrain, widen reach, fabricate support or introduce a new destruction policy. The source/card supplies no permissive recovery fallback.

## Concrete future T041–T044 oracles; NOT_RUN

| Oracle | Minimal current-source-grounded witness |
| --- | --- |
|T041 powered Cutter half-work | Actual W09 scene with one paid208kgB06/C26 absent, active Resources WIP and exact18,000J recipe work paid from real allocation; joint save/reload keeps native owner/profile, same WIP lots/reservation/output claims/remaining work/history/Factory tick; no second consume or offline increment. |
|T042 packet/battery/installed part | Actual finite C03 partially discharged and real links/allocation; W08 packet nativeLotRef/position/remaining route/paid rate credit plus material whole-view binding; one installed native/device/render owner, one quantity custody location after reload. Open/closed initial Cargo and its ORIGINAL open receipt persist; away-from-Cargo saved actor does not force reopen or mint stock. |
|T043 failed repository or restore | One full slot generation+metadata expectedRevision atomic; quota/CAS/crash failure reports failure, previous complete generation untouched. Separate native/render/material publication fault proves A still complete or explicit hold; no optimistic successful load with missing Cargo. |
|T044 combined native/source/identity | Forged missing/duplicate Cargo, Facility reusing reserved `fp02_wreck_owner`, omitted/shared colliders, stale/fake definition/profile/material provenance, raw Ahandle treated as Bhandle, impossible opened/receipt/revision relation, counterfeit Factory pages/normal-coast top-level profile, mismatched ticks/epochs, unbounded materialBinding/history/decoded source all reject BEFORE activation. Exact actual B member partition+source/tick validity is required, not counts. |
|Disposed capture and retry/replay | Checkpoint after disposal safely rejects before freedWorld query; failed init does not reserve sameHost forever; reload does not reset completed build IDs/material receipt chain or rerun C26 construction. These current W07 fixes remain regression boundaries. |
|Ghost save | Ghost is discarded or optional UX draft only; no new paid Resource/native owner exists after reload. Renderer common-frame artifacts are derived and staged, not saved as Authority. |

Implementation scope is not blocked by a newly invented owner policy: the concrete work is joint internal capability, closed codec relationships and exact grants after actual W09. The still-open items above are actual missing connections/source closure, not W10 completion claims. This report is sufficient to prepare a narrow integrator brief once W09 and its actual state/port/power/material contracts are accepted.
