# W09 Domain composition handoff — read-only, 2026-10-11

Read against Domain WT HEAD `1f2c568ec9db7b6b2895eb2a3b4f37797030dac8`: accepted W02/W08/W03; W04 is sealed, **independent gate pending**, Step SHA`f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449`. This note authorizes no W09 product/test/CPU work or source changes. Paths below are relative to `apps/weltraum-browser/src/factory/`.

## Exact import boundaries

```ts
import { createFactoryMaterialView, prepareFactoryMaterialStep, commitFactoryMaterialStep,
  type MaterialView, type MaterialIntent, type MaterialRecipeRef } from "./material/reservations";
import { assertExactContainerCapacity, readMaterialMassMg } from "./material/resourcesAdapter";
import { prepareFactoryPowerSources, type FactoryPowerSourceSnapshot } from "./power/sourceAdapter";
import { stepFactoryPower, type FactoryPowerState, type FactoryPowerInput,
  type FactoryPowerRequest, type FactoryPowerSuccess } from "./power/factoryPower";
import { createFactoryProductionState, readFactoryProductionRequest, stepFactoryProduction,
  commitFactoryProductionStep, type ProductionState, type ProductionStepInput,
  type ProductionCommand } from "./production/productionStep";
import { type ProductionHostFacts, type ProductionStart } from "./production/recipeAdmission";
import { advanceFactoryBelt, commitFactoryBeltStep, assertFactoryBeltState,
  type BeltState, type BeltStepInput } from "./conveyor/beltReference";
import { type BeltInstallation } from "./conveyor/beltPorts";
```

Actual types, not DTO copies: `MaterialView={catalog,revision,containers:ResourceContainerSnapshot[],reservations,receipts}`. All amounts remain native `containers[].state.contents`; mg/piece/mm are exact catalog units. `createFactoryMaterialView` initializes revision0/empty history **once**; do not call it each frame or load to discard claims/receipts. Subsequent W02 intent/plan commits preserve exact current history and native source custody. W10 must restore the whole validated view.

## One confirmed interval, one shared proposal/adoption

Only common Host authority turns six confirmed60Hz native ticks into `[tickStartUs,tickEndUs]`, exactly100000us. No rAF, UI, renderer, elapsed wall time or offline catch-up. Read current native installation/tool/player/container/network facts and source-locked catalog. Build all demands deterministically from current admission; call `prepareFactoryPowerSources(catalog,snapshot)` and `stepFactoryPower(powerState,{binding,tickStartUs,tickEndUs,confirmed:true,supply,requests})` **once for the whole interval**. Stable consumer IDs and source priority/restart policy stay W03-owned.

Pass the **complete successful FactoryPowerSuccess object**, including nextState/balance/canonicalJson/digest, into each production and belt step. W08's structural Power type does not mean stripping unknown W03 fields: its full-body canonical check requires retaining them. Evaluate/verify complete pairs in a deterministic order against successive **private** Material candidates, with each production/line advanced once for that same interval. A plan/proposal rejection or conflicting admission holds the whole proposed authority; never publish a partial Power debit, WIP transfer, packet move or job advance. Demand/claim conflicts need a coherent deterministic preparation before accepting the single Power proposal, not repeated independent allocators. Actual World CAS must revalidate all native/Material/Power/component bindings and adopt **one** Power nextState, final sole Material view and all component nextStates together. UI projects the adopted read views. Component commit helpers only return verified values; they do not install them into the live World.

`FactoryPowerBinding={sessionId,epoch,netRevision,catalogDigest,sourceProfileDigest}`. The Power source profile is `fp01-fixed-net-observation-v1`, distinct from the accepted terrain/start-site profile. W03 supply uses actual finite C01/C02/C03 installed Resources instances and current ports/links/confirmed net observation; unknown/pending generation is0, not nameplate. Avoid inventing a new filled battery or rebuilding consumer restart state. Native consumer port.assetId must match request.deviceInstanceId. W04 permits forward current net revisions with exact current receipt; W08 requires its installation/line/input binding exactly equal, so graph/reinstall changes need an explicit reviewed state binding transition, not silent UI edits.

## Production, WIP and separate cassette targets

`ProductionStepInput={confirmed,binding,tickStartUs,tickEndUs,material,facts,power,command?}`. `facts` is `ProductionHostFacts`: version`fp06-production-host-facts-v1`, binding, confirmed, tickEndUs; installation contains instanceId, definitionRef, installationRevision, confirmed/supported/serviceClear, **five distinct** installed/input/output/offcut/WIP container IDs, powerConsumerId/powerPortId, and actual tool{partId,sourceItemId,revision,condition}. interaction is null or actual actorId/actorRevision/confirmed/serviceReachable plus reachable `{containerId,revision}` entries. Derive these from W07 native/readback facts, paid BOM and damaged surviving parts; no camera coordinates, DOM flags or synthetic booleans.

Start is `{kind:"start",commandId,jobId,batchOrdinal,ownerId,actorId,missionId?,recipeRef:{sourceId,version,digest},processKind,sourceLots:[{itemId,containerId,stackId}]}`. Quantities come from the frozen recipe. Read `readFactoryProductionRequest(state,inputWithoutPower)` before allocation. Missing input/full main output/full offcut disables productive demand. Cutter buffers16/22.5/6kg and Former15/21/6kg are separate; keep both machines' main outputs **and** two offcut cassette IDs distinct. WIP must admit both frozen inputs and W02's hypothetical product/offcut finish preflight. Whole output claims are native reservation metadata, not free amounts. CUT consumes8kg once and completes300 paid steps/36kJ; PROFILE/SHEET consumes7.5kg and completes400/80kJ. Receipt device/consumer/job/port/current interval and rational work are exact; power-off retains WIP/work. Full target admission must succeed before paired outputs publish.

REC05/B05 has no electric In-port: omit its manual request from W03; a valid shared success with no matching manual grant is accepted as0work. Real paid C05/basic mechanical bench, reachable sources/sinks and intact tool admit reserve→`LAID_OUT`; `{kind:"manual-work",commandId,jobId,actorId}` records active montage→`ASSEMBLED`; later `manual-finish` atomically emits5.8kg brace+0.2kg offcut. No clock/0J finish,30s timer or C21 requirement. Passive away ticks advance cursor/WIP without work; active commands recheck reach/tool. Historical accepted montage/finish IDs remain inert after a later job; changed bytes conflict.

W04 proposal binds complete base authority core excluding only derived lastStep; `inputBinding` has exact keys authorityCanonicalJson/materialCanonicalJson. Adopted payload has exact proposalCanonicalJson/inputBinding/nextStateCoreCanonicalJson/materialCanonicalJson/materialPlansCanonicalJson. NoOp compares **all** accepted bytes, current core/replay and exact current native Material candidate; changed plans/work/base or empty receipt prefix reject. For immediate replay, retain original interval/Power/Host/command and supply adopted Material; do not replay an old proposal against a later changed view. Handle lost replies through the stored accepted command IDs/history, not by making fresh jobs or manual work.

## Belt admission and custody

`BeltStepInput={confirmed,binding,tickStartUs,tickEndUs,installation,material,power,actorId,sourceLot:null|{stackId,itemId,quantityUnits?}}`. `BeltInstallation` names installed source/target ports (device/versioned digest, source port ID, native container/port, native instance/install revision,250mm placement center, quarterTurns, actual center/normal), lengthMm/moduleInstanceIds, driveInstanceId/powerPortId/consumerId/jobId, bandContainerId/bandInPortId/bandOutPortId and source/catalog binding. Host must prove real paid modules/drive and native geometry; W08 strings alone do not prove installation. One straight line, one native packet/custody slot≤10kg, .75m source **width**, no invented longitudinal spacing.

For4m request100000mW/10J per step with request device=driveInstanceId and job=installation.jobId. Initial credit0; paid steps add100000mg capped10kg, debit once only with actual source→band W02 receipt. Optional exact `quantityUnits:8000000` takes8kg from an actual20kg steel lot after80 supplied steps; default20kg sends two paced10kg children. New packet stays at0; subsequent moves75mm/paid step,4m needs54 moves. Output-full retains its native band lot and packet at end; power-off freezes position/credit. Delivery moves the real child stack, not a shadow quantity. Preserve packetCursor, full injection receipt/native parent-child lineage, native revisions, production recipeRef, clock and credit; don't reset history or coalesce away unique child IDs. Direct product/offcut transfers use the same native authority and exact claims; never route offcuts through main Solid ports.

This is API composition guidance only. W09 must still prove normal player UI/native reach and material loop; W10 combined save/recovery and W11 browser/gameplay/performance remain separate actual gates.

Root delivery copy: only Markdown trailing spaces/final blank lines normalized. Independent original SHA256 `4759367c1db7a3340b027adfe363b46ff6d86e2d8dcdd5fbc066abd01c9d8ec7`, 9404 bytes; original remains `/workspace/.cloud-setup/fp06-w09-domain-api-handoff.md`. Scope, evidence and verdict unchanged.
