# Voxel World Decision and Supersession Index

Stand: 2026-09-06
Zweck: Navigation zwischen aktuellem Produktcode, scoped decision anchors,
Proposals und historischen Zielanweisungen. Dieses Dokument trifft keine neue
Architektur- oder Ownerentscheidung.

## Read This First

`main` at `15f3550bd604856b25d40a7ac700ec4d5106b89e` is the current
implementation truth for `Weltraum-Spiel`. A document pin can be a valid
design source, proposal, delta or patch source without being implemented on
that branch. In particular, neither this index nor its references ratify G18,
G18A, X01 or X02 as a whole.

The current Hestia visual target is fine, hard, axis-aligned block and
microvoxel geometry. It is a scoped design target, not evidence for a shipped
planet runtime. The normal browser route remains a local-space flight slice;
the separate Surface Lab remains a technical proving ground.

## Status Navigation

| Document or path | Pin or main SHA | Status | Affected topic | Current successor or pointer | What remains valid | Must not be used as a current target instruction |
| --- | --- | --- | --- | --- | --- | --- |
| [Current Mainline State](../current-mainline-state.md) | `main` `15f3550bd604856b25d40a7ac700ec4d5106b89e` | `CURRENT_IMPLEMENTATION_TRUTH` | Browser product state | This file and the code anchors below | Normal flight slice, query-gated Surface Lab, and explicitly bounded foundations | A proposal or a lab result is not product integration |
| [`src/main.ts`](../../apps/weltraum-browser/src/main.ts) and [`src/runtime/browserRuntime.ts`](../../apps/weltraum-browser/src/runtime/browserRuntime.ts) | `main` `15f3550…` | `CURRENT_IMPLEMENTATION_TRUTH` | Normal route composition | [Current Mainline State](../current-mainline-state.md#normal-browser-flight-path) | `/` creates the BrowserRuntime and Three.js presentation; `?surfaceLab=1` selects a separate route | A normal-route voxel, planet or player-save loop |
| [`src/voxel/adaptive`](../../apps/weltraum-browser/src/voxel/adaptive) | `main` `15f3550…` | `CURRENT_IMPLEMENTATION_TRUTH` | Adaptive microvoxel authority | [Adaptive Microvoxel Pure Core](../current-mainline-state.md#adaptive-microvoxel-pure-core) | Pure adaptive keys, revisions, edits, materialization, planning, residency and parent fallback | A global 0.125 m planet grid, a player loop or live planet streaming |
| [`src/voxel/structural`](../../apps/weltraum-browser/src/voxel/structural) | `main` `15f3550…` | `CURRENT_IMPLEMENTATION_TRUTH` | Structural microvoxel authority | [Structural Microvoxel Pure Core](../current-mainline-state.md#structural-microvoxel-pure-core) | Pure commands, connectivity, component/fragment descriptors, mass properties, greedy mesh products and codecs | Moving fragments, colliders, physics handoff or playable destruction |
| [`src/browser-storage/indexedDbSaveRepository.ts`](../../apps/weltraum-browser/src/browser-storage/indexedDbSaveRepository.ts) | `main` `15f3550…` | `CURRENT_IMPLEMENTATION_TRUTH` | Browser storage | [Browser IndexedDB Save Repository Core](../current-mainline-state.md#browser-indexeddb-save-repository-core) | Versioned repository operations, slot revisions and import/export | Player-, voxel-world- or Persistence-domain save/load composition |
| [Hestia Evidence, Conflict and Migration Register](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/f7828d186f9db52ac92961dbf6446fb10045605f/docs/art-direction/hestia/03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md) | `f7828d186f9db52ac92961dbf6446fb10045605f` | `ACCEPTED_SCOPED_ANCHOR` | Hestia visual language | Its conflict matrix and the scoped rules below | Fine hard-square microvoxels, block readability, macro/meso/micro hierarchy, and human visual review | Smooth low-poly terrain, faceted heightfields, visible Surface Nets style, primitive dioramas or an engine decision |
| [Hestia Surface Lab V1 Visual Target Audit](../design-audits/2026-07-14-hestia-surface-lab-visual-target.md) | `main` `15f3550…` | `HISTORICAL` | Earlier Surface Lab visual target | Hestia Visual Language pin and this index | Its technical-proving-ground boundary and historical reference provenance | Faceted low-poly shading, dark/petrol palette or a coherent Surface Nets landform as current Hestia art direction |
| [Hestia procedural voxel world](../spielkonzept/hestia-procedural-voxel-world.md) | `main` `15f3550…` | `SUPERSEDED_IN_PART` | Hestia world plan | Hestia Visual Language pin and this index | Representation ladder, authored-hotspot, world-authority and persistence intentions remain planning material | Its Low-Poly visual target wording, or an assertion that its plan is runtime-complete |
| [Procedural Voxel Planet Runtime](procedural-voxel-planet-runtime.md) | `main` `15f3550…` | `SUPERSEDED_IN_PART` | Planet runtime target architecture | This index plus the Visual Language pin | Authority separation, stable IDs, parent fallback, readiness and benchmark gates remain target architecture | SDF/density, Regular Cells or Transvoxel as a visible smooth Hestia target; any closed planet geometry or mesher choice |
| [Voxel Destruction, Mass, Rotation and Orbit](voxel-destruction-mass-rotation-orbit.md) | `main` `15f3550…` | `OPEN_DECISION` | Destruction and body dynamics | Current Mainline State and its own benchmark gates | Local deltas must not silently change planetary mass, rotation or orbit | A claim that an integrated edit, fragment, collider, save or orbit-coupling chain exists |
| [Surface Local Frame Architecture](surface-local-frame-architecture.md) | `main` `15f3550…` | `OPEN_DECISION` | Surface transition frames | Current Mainline State and future surface contracts | The need for a stable local-frame boundary | A claim that player surface gameplay or a planet-scale handoff is implemented |
| [G18 Master Synthesis V1](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/ef6d2b4b6589d93b69da7ced737aa16679610a2d/docs/research/g18-master-synthesis-v1/G18_MASTER_SYNTHESIS_REPORT_V1.md) | `ef6d2b4b6589d93b69da7ced737aa16679610a2d` | `PROPOSAL` | Product/authoring synthesis and gate queue | Its explicit `REQUIRES_OWNER_DECISION` status; current code remains `main` | Research synthesis, serial-gate rationale and its stated product/lab separation | Owner acceptance, product implementation or WP04/product integration |
| [G18A Post-Intake Addendum](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/17d6c0c9432f8f29ef6439107550b15cc3a87649/docs/research/g18a-post-intake-addendum-2026-08-12/G18A_POST_INTAKE_ADDENDUM_2026-08-12.md) | `17d6c0c9432f8f29ef6439107550b15cc3a87649` | `PROPOSAL` | Post-intake delta and status reconciliation | Its own `REQUIRES_OWNER_DECISION` boundary and the source-specific rows here | The delta's distinction between design target, Lab truth, product truth and open decisions | A second Master GDD, a blanket ratification, or a product-main implementation claim |
| [X01 Common Contract Vocabulary V1](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/e7f2aad3ede7f307cf80ddd5a118e8a19ad5cd30/docs/architecture/contracts/COMMON_CONTRACT_VOCABULARY_V1_PROPOSAL.md) | `e7f2aad3ede7f307cf80ddd5a118e8a19ad5cd30` | `PROPOSAL` | Common vocabulary, ownership and package boundaries | Its D-01 through D-17 owner-decision list | Conflict register and proposed package boundaries as review input | Existing packages, closed variants, accepted wire formats or implementation authority |
| [X02 Decision Log Patch Proposal](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/53a78b3465075f52bcaa44df1a48bdb2f28cbc7a/docs/research/DECISION_LOG_PATCH_PROPOSAL_2026-08-12.md) | `53a78b3465075f52bcaa44df1a48bdb2f28cbc7a` | `PROPOSAL` | Decision-log freeze and patch | Its explicit non-applied status; accepted anchors are scoped below | The document's mapping of previously accepted D-001/D-004/D-005/D-010/D-012/D-013/D-022 | Application of D-024 through D-048, or an invented Owner sign-off |
| Existing decision anchors recorded in X02 section A | X02 pin `53a78b…` | `ACCEPTED_SCOPED_ANCHOR` | Browser-first, hard voxels, provenance, serial gates, Lab boundary, scale profile and human art review | The exact X02 section-A mapping, without applying the patch | Only the named pre-existing anchors in their documented scope | A universal cell size, final engine choice, automatic Lab-to-product handoff or acceptance of every X02 row |
| [Voxel-Lab and visible progress](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/02e2e9e94e5d812b0105a902234e42dfd346cac0/docs/roadmap/voxel-lab-visible-progress-roadmap-2026-08-17.md) | `02e2e9e94e5d812b0105a902234e42dfd346cac0` | `SUPERSEDED_IN_PART` | Voxel-Lab coordination snapshot | The remote Lab process and the accepted serial-gate anchor D-005 | The BR01 → BR02 → BR03 → BR04 → WP05 → WP06 → WP07 → WP08 → WP09 → WP10 → WP11 → WP12 sequence and the Lab/product boundary, until an explicit amendment changes them | Its dated progress boxes as current product truth, or any product integration before WP12 and an explicit integration decision |
| [Living Master Plan](../roadmap/living-master-plan.md) | `main` `15f3550…` | `SUPERSEDED_IN_PART` | Planning waves and package index | [Current Mainline State](../current-mainline-state.md) and this index | Stable planning IDs, documented dependencies and the existing Lab/product boundary | Its plan entries as a current implementation inventory, a new work-package order or a freeze of engine/planet/destruction choices |

## Active Product Boundaries

### Hestia visual direction

- Hestia's design target is hard, small, axis-aligned microvoxels with
  block-readable near-field geometry.
- Density and field generators may remain macro inputs or technical inputs.
  They do not require visible smooth geometry and must not make a Surface Nets
  output the visual truth.
- The visible Surface Nets route on current `main` remains useful technical
  evidence. It is a technical lab product, not a Hestia beauty pass.
- Three.js remains the current browser renderer. It consumes derived scene and
  presentation data and is not material, world or voxel authority. This does
  not decide a final engine.

### Scoped measurements and unresolved world choices

- `0.25 m` is a scoped V1 reference profile recorded by the accepted D-012
  anchor. `0.125 m` is a local research or module-specific contract, including
  the current Adaptive core's base quantum. Neither value grants a universal
  planetary cell size.
- Cube-sphere metric, planetary shell, brick/chunk edge, visible LOD transition,
  mesher, hydrology authority and complete planet geometry remain open or
  benchmark-gated decisions.
- The current code contains isolated Adaptive, Structural and IndexedDB
  foundations. It contains no normal-route composition that joins them into a
  player-controlled voxel world, destructive fragment/collider chain or
  player/voxel-world save loop.

### Research, proposals and patches

- G18 is a read-only synthesis with `REQUIRES_OWNER_DECISION`; it does not
  accept its own recommendations.
- G18A is a delta, not a second Master GDD. It preserves the distinction
  between accepted scoped anchors and still-open decisions.
- X01 is a vocabulary and ownership proposal. Its proposed package names and
  unresolved variants are not assertions of existing code.
- X02 is a non-applied patch proposal. Its section A records named existing
  accepted anchors, while its later proposed patch rows remain non-operative
  without the required Owner sign-off.

## Lab and Product Sequence

The Voxel-Lab and `Weltraum-Spiel` are separate scopes. The existing Lab order
remains:

```text
BR01 -> BR02 -> BR03 -> BR04 -> WP05 -> WP06 -> WP07 -> WP08
-> WP09 -> WP10 -> WP11 -> WP12 -> explicit product-integration decision
```

This index does not start, reorder, accept or merge any of those packages. In
particular, no Lab kernel is product-integrated before WP12 and an explicit
integration decision. The dated visible-progress document is retained as
history and coordination context; remote commits, accepted reviews and the
explicit decision record have priority over it.

## Evidence Anchors for This Index

| Central statement | Source anchor |
| --- | --- |
| Normal flight path and separate Surface Lab query | [`main.ts`](../../apps/weltraum-browser/src/main.ts), [`surfaceLabQuery.ts`](../../apps/weltraum-browser/src/surface-lab/surfaceLabQuery.ts) and [`surfaceLabFailurePresenter.ts`](../../apps/weltraum-browser/src/surface-lab/surfaceLabFailurePresenter.ts) at `15f3550…` |
| Adaptive and Structural are isolated cores rather than normal-runtime composition | [`adaptive/index.ts`](../../apps/weltraum-browser/src/voxel/adaptive/index.ts), [`structural/index.ts`](../../apps/weltraum-browser/src/voxel/structural/index.ts), and the absence of those imports in [`main.ts`](../../apps/weltraum-browser/src/main.ts) and [`browserRuntime.ts`](../../apps/weltraum-browser/src/runtime/browserRuntime.ts) at `15f3550…` |
| IndexedDB repository is an independent storage core | [`saveRepository.ts`](../../apps/weltraum-browser/src/browser-storage/saveRepository.ts), [`indexedDbSaveRepository.ts`](../../apps/weltraum-browser/src/browser-storage/indexedDbSaveRepository.ts), and the absence of its imports in the normal entry/runtime at `15f3550…` |
| Fine hard microvoxel visual target and rejection of visible low-poly/Surface Nets | Visual Language migration register pin `f7828d…`, sections 1, 7 and 11; G18A visual-language delta pin `17d6c…`, sections 1 through 4 |
| Proposals versus accepted scoped anchors | G18 pin `ef6d2…`, sections 1, 6, 7 and 14; X01 pin `e7f2a…`, sections 1, 5 through 7; X02 pin `53a78…`, status and sections A through D |
| Lab sequence and product boundary | X02 section A, D-005/D-010/D-012; visible-progress roadmap pin `02e2e…`, sections 2 and 5 |

## Non-Changes

This is a documentation index only. It does not ratify a proposal, rewrite a
historical source, change BR/WP order, select an engine, select planetary
geometry, select a universal cell size, freeze destruction scope or claim new
runtime evidence.
