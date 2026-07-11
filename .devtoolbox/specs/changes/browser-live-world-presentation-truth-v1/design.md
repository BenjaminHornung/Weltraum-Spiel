# Design: world-presentation truth proxy layer (v1)

## Change
`browser-live-world-presentation-truth-v1`

## Architecture Decisions

- **Pure telemetry adapter first**: `worldPresentation` is produced by a deterministic adapter from `TelemetrySnapshot`-family runtime descriptors only. No rendering or view logic runs before this adapter produces canonical IDs, hashes, segment order, and geometric intent.
- **Stable frame and revision contract**: adapter output includes stable `frameId` for semantic state and a renderer-only `renderFrameRevision` for projection cycles. `renderFrameRevision` is never part of the semantic signature to avoid false-signature churn.
- **Stable hashing and serialization**: deterministic signatures are generated with `stableStringify` + `fnv1aHash` over normalized source descriptors. The `planHash` key is stripped only when it appears as exactly `planHash`, while `sourcePlanHash` is included as the route identity field.
- **Sorted and strict identifiers**: all unordered collections use stable sort by source ID, and segments are kept in deterministic route order. IDs are compared as strings where possible to ensure consistent serialization.
- **Finite geometry only**: all projected coordinates/radii/angles must be finite numbers; explicit `-0` normalization is required in canonicalization.
- **Truth target and navigation focus separation**: `selectedTarget` and `navigationFocusTarget` are independent snapshots. Selected target visibility is always explicit; it is not inferred from focus marker visibility.
- **Target semantic contract**: selected target entries must expose `selected`, `locked`, and `truthBacked: true`.
- **Route/preview/lifecycle semantics**: preview and locked routes may differ in lifecycle state, but when `sourcePlanHash` matches, segment geometry and segment order must stay equal. `activeSegmentId` may remain null in preview and advance with executor-owned progression on the same route. Mismatched preview-lock combinations that cannot map to the same route must emit hidden/blocked proxy state instead of remapping geometry.
- **Route identity and executor ownership**: every distinct `sourcePlanHash` is a distinct route identity, even when geometry is identical.
- **Preview-to-executor transition rule**: same `sourcePlanHash` keeps segment geometry and order; `activeSegmentId` may advance from a preview-null state to an executor-owned progression on the same route.
- **Executor lifecycle/progress gating**: executor lifecycle/progress states (`completed`, `arrived`, `holding`, etc.) may only be applied when the executor plan hash OR matching completed-plan hash corresponds to the presented route.
- **Single beacon rule**: at most one truth-backed semantic beacon may be derived from `navigationFocusTarget`; all landmarks and decorative objects are explicitly `truthBacked:false`.
- **Obstacle retention and eligibility**: all runtime truth obstacles must be retained and exposed through presentation proxies with `renderEligible` and `truthObstacleProxyCount`; decorative objects are excluded and reported separately.
- **Explicit decorative and obstacle metadata**: non-truth visuals set `truthBacked:false`, `renderOnly:true`, `radarVisible:false`, `collisionRelevant:false`; truth obstacles include explicit `visualProxyStyle`.
- **Atomic canvas revision model**: renderer operations are represented as `add`, `update`, `remove`, `dispose` transitions, each tied to an atomically increasing `renderFrameRevision`. Runtime state writes are not performed in this layer.
- **Canonical route geometry guard**: identical hashes with geometry changes are rejected (same-hash/different-geometry); different hashes are treated as route replacement candidates.
- **Frozen input contract**: adapter output and route segment arrays are treated as readonly in the renderer; no write-back is allowed to runtime telemetry, route, target, or obstacle states.
- **Non-color-only route visuals**: route truth uses both width/shape/layering and route metadata (segment state + lifecycle), not visibility-only styling.
- **Query-gated tooling separation**: `?testBridge=1` remains evidence-only. Normal `/` runtime has no TestBridge and no planner/map debug dependency.

## Risk Management and Mitigations

1. **Hash collisions from unstable serialization**
   - Mitigation: `stableStringify` with explicit key sorting and float normalization, then `fnv1aHash`.
2. **Mismatched preview vs locked routing**
   - Mitigation: reject invalid combinations by forcing preview-hidden state and explicit blocker evidence.
3. **Decorative truth leakage**
   - Mitigation: required boolean contract (`truthBacked`, `collisionRelevant`, `radarVisible`) and dedicated evidence counters.
4. **Renderer drift**
   - Mitigation: deterministic add/update/remove/dispose transitions and unit tests asserting no write-back and no geometry mutation.
5. **Mode regression in normal path**
   - Mitigation: explicit `/` invariant: base truth proxies visible regardless of `debugHud` and with no TestBridge.

## Done-at-v1 Boundary

- No planner-map ownership edits.
- No planner/executor authority changes.
- No new map UI, no runtime/world engine rewrites, no Assets or package/lockfile edits.
- No additional product features beyond deterministic presentation projection and evidence gates.
