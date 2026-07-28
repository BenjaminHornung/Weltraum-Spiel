# ExecPlan: Browser Voxel Representation Ladder V2

## Goal

Publish a deterministic TypeScript foundation that selects among a validated,
versioned list of 1..32 derived representation bands while keeping the existing
five-level Adaptive Microvoxel Authority and Structural Authority unchanged.
Render choice, simulation requirements, authority requests, fallback,
readiness, eviction, reasons, and decision hash are separate outputs. The final
branch must be verified, reviewed, pushed, and opened as an unmerged PR.

## Context

- Base: `origin/main` at `15f3550bd604856b25d40a7ac700ec4d5106b89e`.
- Branch: `feature/browser-voxel-representation-ladder-v2`.
- Isolated worktree:
  `C:\IFI_SourceCode\Temp\Weltraum-Spiel-worktrees\browser-voxel-representation-ladder-v2`.
- Authority contracts:
  `apps/weltraum-browser/src/voxel/adaptive/**` and
  `apps/weltraum-browser/src/voxel/structural/**`.
- Settings contracts: `apps/weltraum-browser/src/settings/**`.
- Required new core: `apps/weltraum-browser/src/voxel/representation/**`.
- Browser proof:
  `apps/weltraum-browser/tests/e2e/voxel-representation-ladder-v2.spec.ts`.
- Deterministic evidence:
  `apps/weltraum-browser/evidence/browser-voxel-representation-ladder-v2.{md,json}`.

Current Main has pure Adaptive and Structural foundations but no production
planetary voxel streaming, broad proxy meshing, physics handoff, building
collapse, or live settings consumer. This change must state that gap honestly.

## Non-goals

- No new Authority, Adaptive level, key, canonical encoder, hash, journal,
  provenance, connectivity, mass, collision, persistence, gameplay, worker,
  renderer, Three.js, DOM, browser-global, or planet-runtime implementation.
- No dependency, lockfile, Unity, CI, Playwright-config, TestBridge, deployment,
  release, force-push, direct-main push, rebase, or merge.
- No benchmark-free claim that provisional preset distances are final product
  calibration.

## Architecture decision

### Descriptor and products

`RepresentationLadderDescriptor` is a strict schema-v2 plain-data value with
1..32 `RepresentationBand` entries. Rank zero is finest; ranks are unique,
contiguous, and canonical. Geometric error is strictly increasing with rank.
Each product band declares stable ID, product kind, algorithm/product version,
positive finite coverage bounds, required source binding kinds, readiness
requirements, allowed domains, optional visual Adaptive level, and bounded
byte/work/upload estimates. `Culled` is a selection outcome, never a product or
Authority source. Validation checks array/count caps before copies, sorting, or
hashing; rejects unknown/accessor/symbol/inherited/sparse input; copies first;
and publishes only deeply frozen values. Canonical descriptor and decision
hashes reuse `hashAdaptiveCanonical`.

### Proxy identity

Damage-aware object identity binds object ID/revision, Structural content hash,
damage digest, band ID, proxy algorithm version, and computed proxy content
hash. Surface-region/tile identity binds body/frame/region-or-tile,
generator/source/edit revisions, source hash, band, algorithm version, and
computed proxy hash. Camera, distance, viewport, FOV, quality, queue, worker,
cache, and timing metadata are excluded. Current-source comparison returns a
typed rejection for stale revisions or mismatched source hashes; no damaged
object may use an old intact proxy.

### Screen-space error and hysteresis

The pure projection uses validated finite camera/bounds inputs:

`focalLengthPixels = viewportHeight / (2 * tan(verticalFov / 2))`

`distanceToBounds = max(minimumDistance, distance(camera, center) - radius)`

`projectedErrorPixels = geometricErrorMeters * focalLengthPixels / distanceToBounds`

The candidate algorithm canonicalizes by validated rank and band ID, selects
the coarsest current/ready product within the visual policy, and never trusts
insertion order. A prior band affects only explicit hysteresis: refine when the
current coarse band exceeds the refine boundary; collapse only when the target
coarse band is below the lower collapse boundary. Culling has its own distance
and projected-bounds threshold. Every result has stable reasons and a decision
hash over canonical inputs/outcomes.

### Render, simulation, and readiness separation

The accepted result contains separate `renderSelection`,
`simulationRequirements`, `requiredAuthorityRequests`, `fallbackDecision`,
`readiness`, `evictionEligibility`, `decisionReasons`, and `decisionHash`.
Graphics policy filters only render products and render budgets. Interaction
and Structural requirements are computed independently and remain identical
for Low and Ultra. Selection reuses the Adaptive request validator, preserves
supported soft requests, and routes only hard interaction reasons through the
L4 requirement factory. Any required budget failure returns one typed,
side-effect-empty rejected result rather than partial acceptance.

### Interaction pins and lifecycle

Existing Adaptive reasons remain unchanged. `CollisionRequired`,
`ToolInteraction`, `Explosion`, `ProjectileImpact`, `MeteorImpact`, and
`StructuralFracture` always create Level-4 Authority requirements. Separate
representation runtime pins are `ActiveRigidBody`, `UnsettledFragment`,
`StructuralSolvePending`, and `PhysicsHandoffPending`. Proxy hit resolution
requires explicit Authority quantum coordinates and current Level-4 coverage;
missing coverage or authority budget returns `NOT_READY`/`Blocked`, never a
coarse edit. A pin may request fine visual detail but never forces it.

Dirty, solving, active-rigidbody, unsettled, or pending-handoff state is not
evictable. Only explicit Settled state with no active pin releases fine derived
products. Authority, journal, and Structural source bindings are always
retained.

### Atomic fallback

Fallback groups are bounded and revision-bound. The raw contract carries either
an absent parent or one parent record with ID, revision, and readiness. Zero,
partial, stale, invalid, cancelled, or incomplete children keep only a `Ready`
parent at the exact group revision. Exactly all required current, same-revision
children replace the parent atomically even when the parent is unavailable. If
neither full children nor a complete current parent exists, the resolver fails
closed with typed `InvalidFallback`; it does not publish settled coverage. Parent
and partial children are never published as settled mixed coverage. The helper
supports the required 64-child vector while staying count-driven. Selection
accepts the raw bounded fallback group and invokes that resolver itself; callers
cannot publish a hand-built child-coverage decision.

### Settings V2

`GraphicsSettingsV1` remains readable. Latest `GraphicsSettingsV2` adds a
strict `voxel` group containing `detail` (`Low|Medium|High|Ultra`), independent
positive `detailDistanceMeters`, and `streamingBudget`
(`Low|Medium|High|Ultra`). V1 migration copies every prior field and appends
deterministic voxel defaults. Concrete V1 presets reuse their existing V2 preset
voxel values so preset identity survives save/reload; Custom uses the default
voxel values. V2 validation remains exact-key and fail-closed;
future versions fail closed. Missing/corrupt/invalid/future storage is not
silently overwritten. `display.renderDistance` remains camera/culling state.

The settings adapter produces one immutable `VoxelQualityPolicy`. Low caps
normal visual Adaptive detail at L2; Medium and High at L3; Ultra at L4. High
has a larger detail range/budget than Medium. These are versioned provisional
policy values, not final benchmark claims. Because no product runtime consumes
the policy, controls remain out of player UI or are marked Planned; no Applied
claim is permitted.

### Finite limits

Named constants cap bands (32), selection candidates, active pins, source
bindings per band, fallback groups and children, estimated bytes, work units,
and upload units. Values are security/work bounds, not product-distance
calibration. Over-cap input rejects before expensive processing and publishes
no partial result.

## Implementation phases

1. Finalize and validate all six change artifacts; create exactly one
   DevToolbox execution.
2. Implement strict descriptor/types/quality-policy and revision-bound proxy
   identity using Adaptive canonical/freeze utilities.
3. Implement SSE, hysteresis, readiness, render/simulation split, pins,
   lifecycle eviction, budgets, and atomic fallback.
4. Implement schema-V2 settings types/defaults/presets/validation/storage
   migration plus pure policy adapter, without false live UI wiring.
5. Add focused descriptor/selection/pin/fallback/proxy/settings regressions and
   prove existing Adaptive/Structural contracts are unchanged.
6. Add the normal-route E2E exactly once to `test:e2e:core`; generate fixed,
   timestamp-free evidence and prove byte identity across two runs.
7. Update bounded architecture/current-state documentation with implemented
   foundation and explicit runtime gaps.
8. Run fresh verification, one technical review, fixes, DevToolbox preflights,
   final Plannotator review, commit, recheck `origin/main`, merge current Main
   only if it advanced, reverify, push, open PR, and process exact-head CI and
   review without merging.

## Tests and evidence

Use the current repository Node-22 toolchain. Run `npm ci`; focused new and
settings unit files; focused Adaptive/Structural regressions; full unit suite
serially; TypeScript/production build; exact E2E inventory; focused E2E twice
with one worker/no retries and byte comparisons; full core/live/ui E2E groups;
JSON parsing; `git diff --check`; secret, forbidden-import, nondeterminism,
scope, Unity, and lockfile scans; DevToolbox verification/preflight; reviewer;
and final human review. Performance assertions use deterministic candidate/work
counters and caps, never milliseconds.

## Risks

- Schema migration could drop old settings or overwrite corrupt storage.
- Hysteresis direction or rank semantics could invert and cause flapping.
- A stale proxy could be treated as ready if identity and readiness validation
  are split incorrectly.
- Quality settings could accidentally leak into simulation/Authority outputs.
- A partial fallback group could be exposed as complete.
- Documentation/UI could overclaim runtime integration.
- Main may advance before publication; integrate only by normal merge commit and
  rerun the entire matrix.

## Rollback / safe stop

All work is isolated to this worktree/branch. Stop without destructive action if
implementation needs Adaptive key/level/hash changes, a second Authority, a
dependency/lockfile, foreign worktree/branch edits, fake runtime/TestBridge,
coarse gameplay edits, test weakening, irrecoverable settings migration, or an
unresolved P0/P1. Revert only this branch through normal follow-up commits if
needed; never reset or clean another worktree.

## Progress log

- [x] Discovery: fetched `origin/main`, recorded base, verified no duplicate
  branch/worktree/PR, created the isolated worktree, and read mandatory canon.
- [x] Plan: authority/render boundary and implementation phases recorded.
- [ ] Artifacts validated and single execution created.
- [ ] Core and settings implemented.
- [ ] Unit/E2E/evidence/docs complete.
- [ ] Technical and human reviews clean.
- [ ] Fresh exact-head verification and open unmerged PR complete.

## Definition of Done

All user-specified deterministic ladder, 12+-band, max-32, SSE/hysteresis,
render/simulation separation, Level-4 pin, stale-rejection, structural lifecycle,
atomic fallback, settings migration, evidence, review, CI, exact-head, and PR
gates pass; no foreign worktree/branch, Adaptive Authority, gameplay truth,
main branch, force push, or merge is touched.
