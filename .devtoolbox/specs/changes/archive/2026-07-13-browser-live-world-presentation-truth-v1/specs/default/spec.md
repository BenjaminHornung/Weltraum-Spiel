# Capability: browser-live-world-presentation-truth-v1

## Scope

### Allowed implementation scope
- `apps/weltraum-browser/src/world/worldPresentation.ts` (new)
- `apps/weltraum-browser/src/render/three/worldPresentationRenderer.ts` (new)
- `apps/weltraum-browser/src/render/three/debugScene.ts` (existing)
- `apps/weltraum-browser/tests/unit/worldPresentation.test.ts` (new)
- `apps/weltraum-browser/tests/unit/worldPresentationRenderer.test.ts` (new)
- `apps/weltraum-browser/tests/e2e/live-world-presentation-truth.spec.ts` (new)
- `apps/weltraum-browser/evidence/browser-live-world-presentation-truth-v1*`
- `apps/weltraum-browser/evidence/live-world-*.png`
- `.devtoolbox/specs/changes/browser-live-world-presentation-truth-v1/**`
- `docs/browser-mainline/live-world-presentation-truth-v1.md`

### Forbidden scope
- `src/ui/**`
- `src/runtime/**`
- `src/main.ts`
- planner map modules, planner HTML/CSS/controls, planner specs
- `Assets/**`
- package manifests/lockfiles
- `flight/planner/executor` core, proving-ground flight logic

## Requirement 1 — NavigationMapSnapshot is the only spatial truth
The system SHALL provide `WorldPresentationSnapshot` via a pure adapter that requires `TelemetrySnapshot.navigationMap`. The adapter MUST NOT execute renderer mutations and MUST remain side-effect free.

- Ship transform, selected target geometry, route geometry, obstacles, entity positions, chunk residence, and render LOD MUST come only from the navigation map snapshot.
- Raw telemetry MAY enrich velocity, executor lifecycle/progress, preview admission, and arrival metadata only.
- No raw-telemetry, proving-ground, world-streaming, or renderer spatial fallback is allowed.
- Normal runtime without a navigation map snapshot is a contract failure.
- `signature` is computed from canonical snapshot fields excluding `renderFrameRevision`.
- `selectedTarget.selected`, `selectedTarget.locked`, and `selectedTarget.truthBacked` MUST be present.
- `route.truthBacked` MUST be true.

## Requirement 2 — Stable frame/revision contract
- `frameId` is derived from `navigationMap.absoluteFrameId`.
- `renderFrameRevision` is a renderer-only revision token.
- Changing `renderFrameRevision` MUST NOT change `signature`.
- `frameId` remains stable across semantic-identical regenerations and does not rotate for equivalent snapshots.
- `signature` changes when semantic snapshot data changes.
- Floating-origin frame and revision changes may change projection revision, but MUST NOT alter semantic signature or `frameId`.

## Requirement 3 — Canonical serialization and hashing
- Deterministic string form MUST use `stableStringify`.
- Hash generation MUST use `fnv1aHash(stableStringify(canonicalSnapshotPayload))`.
- Canonical hash/signature payload MUST include `sourcePlanHash`.
- `planHash` (legacy field) is removed only when it appears as exactly `planHash`.
- Hash and signature must stay deterministic for unchanged semantic input.
- Every different `sourcePlanHash` replaces route identity and must be treated as a route change even if segment geometry and count are identical.

## Requirement 4 — Ordered IDs and numeric safety
- Unordered collections (obstacles, world entities, and residency IDs) MUST be sorted by stable source ID.
- Route segment order MUST exactly match canonical source plan order.
- All numeric fields in signatures/projections MUST be finite; `-0` must normalize to `0`.

## Requirement 5 — Target contract and focus separation
- `selectedTarget` and `navigationFocusTarget` are distinct fields.
- `selectedTarget` remains stable and explicit even if focus changes.
- Target position is source-projected truth (including floating-origin alignment), not renderer offsets.
- `selectedTarget` and `navigationFocusTarget` MAY point to same source in normal mode; when they diverge, `selectedTarget` remains the gameplay intent source.
- The adapter must expose exact target coordinates (source truth coordinates) and cannot emit target-specific render offsets.

## Requirement 6 — Route contract and mismatch handling
- `WorldPresentationRoute.sourcePlanHash` is derived from the active route plan source and remains equal across preview/locked mode when semantics are equal.
- `activeSegmentId` MAY remain null in preview and transition to executor-owned progression for the same route identity.
- preview/locked geometry for the same `sourcePlanHash` MUST be identical and segment order must remain source-order.
- Route-relative `distanceToTarget` and `offRouteDistance` MUST be `null`/absent unless the presented route is associated with the current executor route by either current `planHash` or `completedPlanHash`.
- If current selection is null or preview `sourceTargetId` mismatches current selection target, proxy visibility MUST be `hidden`; if preview is same-target-ready but non-admissible, proxy visibility MUST be `blocked`.
- Executor lifecycle/progress fields (`completed`, `arrived`, `holding`, etc.) may only be inherited from executor sources when the executor plan hash OR completed-plan hash matches the presented route.
- Visible or blocked route geometry MUST match a canonical navigation map route by `sourcePlanHash`, target ID, and exact segment order.
- Stale or hidden routes without canonical map geometry MUST remain `hidden` with an empty segment list.
- The adapter MUST NOT guess, recalculate, or silently remap route geometry.

## Requirement 7 — Truth obstacle contract
- All truth obstacles from runtime/world descriptors MUST be retained as projection entries.
- Each truth obstacle must include `sourceObstacleId`, geometry, and `renderEligible`.
- `runtimeTruthObstacleCount` MUST count all runtime truth obstacle source entries.
- `truthBackedObstacleProxyCount` MUST count only render-eligible truth-backed obstacle proxies.
- Equality of `runtimeTruthObstacleCount` and `truthBackedObstacleProxyCount` is required only for fixed proving-ground v1 where every truth obstacle is resident.
- `visualProxyStyle` MUST be explicit for each truth obstacle proxy.

## Requirement 8 — World entity and decorative metadata contract
- Each map-backed world entity MUST include source ID, absolute position, chunk ID, residence, render LOD, presentation key, and role `Ambient` or `Landmark`.
- The eight gates/beacons MUST be `Landmark` world entities and the six base asteroids MUST be `Ambient` world entities.
- These fourteen entries MUST NOT contribute to decorative counts.
- Only the starfield, distant planet, and 150-object cinematic belt are renderer-only.
- `decorativeAsteroidCount` MUST equal `150`.
- Each renderer-only entry MUST include all flags:
- `truthBacked` = false
- `renderOnly` = true
- `radarVisible` = false
- `collisionRelevant` = false

## Requirement 9 — Renderer contract
`worldPresentationRenderer` SHALL:
- support `add`, `update`, `remove`, and `dispose` operations,
- treat identical hash with different geometry as a hard mismatch and reject replacement,
- treat any different `sourcePlanHash` as route replacement regardless of geometry.
- Snapshot builder returns readonly snapshot data; renderer must not mutate snapshot inputs.
- Unit tests must deep-freeze fixtures to assert non-mutation.
- At most one semantic navigation beacon may exist from `navigationFocusTarget`; it must be truth-backed and distinct from landmarks/decorative entries.
- The existing fourteen low-poly instance slots MUST bind by exact map entity ID every frame.
- Missing, dormant, or `Culled` entities MUST receive zero scale.
- Visible residents MUST retain configured scale and deterministic rotation.

## Requirement 10 — Visual contract
- Route visualization MUST include more than color-only cues. Use dash/gap styling, opacity, geometry/endpoint markers, and layering in place of line width.
- Debug overlays may add visuals but must not alter base proxy identity, target ID, obstacle IDs, or active segment IDs.
- Mismatched preview and locked state must block overlay replacement.

## Requirement 11 — Debug and instrumentation
- `TestBridge` must be exposed only via explicit query (`?testBridge=1`).
- Normal `/` run must not expose TestBridge.
- `fullIds` evidence fields are query-gated and visible only in instrumentation mode.
- Normal canvas attributes MUST expose state and counts only; complete IDs, hashes, segments, and signatures MUST remain query-gated.

## Requirement 12 — Evidence of semantic and render decoupling
Evidence snapshots MUST include at least:
- `selectedTargetProxyVisible`
- `selectedTargetProxyId`
- `routeProxyVisible`
- `routeProxyPlanHash`
- `routeProxySegmentCount`
- `activeRouteProxySegmentId`
- `truthBackedObstacleProxyCount`
- `runtimeTruthObstacleCount`
- `decorativeObjectsExcludedFromRadar`
- `decorativeAsteroidCount`
- `rendererOwnsWorldTruth` (MUST be `false`)
- `worldPresentationSignature`
- `renderFrameRevision`
- `renderFrameDelta`
- `routeProxyVisibility`
- `navigationFocusBeaconCount`
- `selectedTargetProjectedPosition`
- `worldEntityCount`
- `residentWorldEntityCount`
- `landmarkWorldEntityCount`
- `ambientWorldEntityCount`
