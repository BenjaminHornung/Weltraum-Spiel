# ExecPlan: Hestia Voxel Runtime V2 Coast/Lush Visual Parity V1

## Ziel

Ausgehend von `b9ba0e14d897ca2392013c456bd1b88b58934381` wird die bestehende
funktionale V2-Darstellung zu einer glaubwürdigen, weitläufigen Hestia-
Küsten-/Lush-Landschaft mit Makro-, Meso- und Mikroformen weiterentwickelt.
Die Near-Authority, Authority-Edits, DDA, Collision, Worker/Scheduler und
First-Person-Funktionen bleiben unverändert in ihrer Zuständigkeit. Abschluss
ist erst nach einer expliziten Owner-Freigabe der Candidate-Screenshots.

## Kontext

- Change: `browser-hestia-voxel-v2-coast-lush-visual-parity-v1`.
- Execution: `575ac1549fcd40a6b6a3948781eddb67`.
- Worktree: `.worktrees/browser-hestia-voxel-v2-coast-lush-visual-parity-v1`.
- Referenzen: `docs/Konzeptart/Hestia` im Quellcheckout; sechs ausgewählte
  Zielbilder und vier aktuelle Baselines liegen unter
  `apps/weltraum-browser/evidence/hestia-voxel-v2-coast-lush-visual-parity/reference/`.
- Gap-Matrix: `.devtoolbox/specs/changes/browser-hestia-voxel-v2-coast-lush-visual-parity-v1/tests/visual-gap-matrix.md`.
- Baseline capture: `evidence/.../iteration-00-baseline/`; 129 sichtbare
  Chunks, 207 Warmup-/197 Post-Cut-Draw-Calls, rAF p95 16.8ms,
  Cut-to-Visible p95 33.6ms, Long Tasks 0.
- Relevant baseline code: `src/voxel-v2/domain/**`,
  `src/voxel-v2/render-three/voxelV2Renderer.ts`,
  `src/voxel-v2/runtime/**`, `src/voxel-v2/demo/**`.

## Nicht-Ziele

- Kein Core-Neustart, keine zweite World-Truth, keine vollständige 0.25m-
  Welterweiterung, kein Surface Nets/Marching Cubes/Dual Contouring-
  Hauptpfad, keine Physik-/Collapse-/Fluid-/Multiplayer-/Save-Erweiterung.
- Keine Package-/Lockfile-/Unity-/`Assets/**`-Änderung, kein WebGPU-
  oder Raymarching-Umbau, keine externen/GPL-Assets oder kopierter Code.
- Keine generische 32-Band-LOD-Engine und kein Performance- oder Visual-PASS
  ohne Evidence/Owner-Gate.

## Architekturentscheidung

1. `MacroWorldDescriptor` ist pure, immutable Seed/Version/Koordinaten-
   abgeleitete Beschreibung. Er besitzt keine Zellen, Edits, Collision oder
   Renderer-Objekte.
2. Near nutzt weiterhin die bestehende 0.25m-Authority als einzige Gameplay-
   Wahrheit. Mid ist ein überlappender 0.5–1m Render-Proxy; Far ist ein
   2–4m radialer Proxy bis etwa 500m. Beide rekonstruieren aus demselben
   Descriptor und sind weder editierbar noch kollisionsrelevant.
3. Near-Terrain wird in bounded Render-Regions mit gemeinsamer
   palette-aware Materialpipeline projiziert. Ein Edit ersetzt nur betroffene
   Regionen; gemeinsames Material wird rendererweit besessen und erst bei
   Renderer-Dispose freigegeben.
4. Render-only Vegetation, Wasser, Sky, Wolken, Haze und Kamera-Presets gehören
   ausschließlich unter `src/voxel-v2/render-three/**`. Dirty-AABBs invalidieren
   unterstützte Dekoration, niemals Authority oder Collision.
5. Three.js bleibt aus Domain/Worker/Runtime heraus. `main.ts` und die
   bestehende Query-Gate bleiben unverändert, sofern kein zwingender
   Integrationsnachweis das Gegenteil zeigt.

## Implementierungsphasen

### Phase 0 — Baseline und Referenzen (PASS)

- 22 Referenzkandidaten und vier Baseline-PNGs dekodiert.
- Sechs Zielrollen gemappt, Hashes/Dimensionen dokumentiert und Zielbilder in
  den Evidence-Pfad kopiert.
- Baseline auf b9ba0e14 im Production Preview reproduziert; raw rAF,
  Worker/Meshing/Long-Task/Edit-Latenzen dokumentiert. Separate Main-Thread-
  App-Zeit ist im alten Runtime nicht messbar und bleibt offen.

### Phase 1 — Descriptor und Near (laufend)

- Pure Descriptor mit Küsten-/Insel-/Massiv-/Tal-/Drainage-/Biome-Fakten.
- Generator ersetzt Sinus-/Ring-Komposition und Materialbänder.
- Vier verbundene Baum-Archetypen, Cluster-/Clearing-Platzierung und
  support-geprüfte Near-Flora.

### Phase 2 — Mid/Far und Environment

- Radiale Mid/Far-Geometrie mit identischer Descriptor-Quantisierung und
  occluded Near overlap.
- Horizon-scale circular water, channel/shore/depth facts, Fresnel/glint,
  sky dome, low-poly cloud batches, fog/haze und Warm-Key/Cool-Fill.
- Vier dokumentierte Beauty-/Player-Kameras.

### Phase 3 — Material, Batching, Vegetation

- Shared terrain material mit Material-ID/AO/Tint/Wetness und
  Roughness/Emissive-Klassen.
- Regionale Near-Geometrie statt Material+Geometry pro Chunk.
- Render-only Mid/Far Bäume/Flora mit bounded Instancing/Merging und Dirty-
  Support-Invalidierung.

### Phase 4 — Integration und Iteration

- Renderer-/Runtime-Port-Integration ohne Authority-Verschiebung.
- Screenshotserien `iteration-00-baseline` bis `iteration-04-final-candidate`
  mit identischen 1920×1080-Kameras sowie Side-by-Side Boards.
- Cut/Collision/Revision/Disposal und no-boundary E2E prüfen.

### Phase 5 — Review und Owner Gate

- Focused/full unit/build, Core/Live/UI E2E, V2 zweimal ohne Retry,
  Production Preview, 100 Cuts, JSON/PNG/Import/Lockfile/Assets/Disposal-
  Guards und getrennte App-Work-Telemetrie.
- Ein unabhängiger Technical Reviewer prüft Second Truth, Übergänge,
  Material-/Batching-Ownership, Water, Vegetation-Lifecycle,
  Determinismus und Resource Disposal.
- Candidate-Rubrik ausfüllen; Status bleibt
  `AWAITING_OWNER_VISUAL_APPROVAL`, bis der Repository Owner antwortet.

## Tests und Evidence

- Pure: Descriptor-Determinismus, Coastline agreement, River drainage,
  variable terraces/material facts, tree connectedness/archetypes, flora
  support invalidation, camera fixtures.
- Browser: normal/Surface route seam, V2 Ready/movement/fire/edit/collision,
  stale revision, no debug beauty HUD, no rectangular edge, 100-cut liveness.
- Production: 1920×1080/DPR1, main-thread app work p95 ≤10ms where measured,
  rAF p95 ≤18ms/p99 ≤25ms, no warm Long Task ≥50ms, Cut-to-visible ≤100ms,
  ≥35% Coast draw-call reduction or documented equivalent.
- Every evidence artifact carries the actual commit/branch/runtime and is
  parsed/decoded before task completion.

## Risiken

- Descriptor/Proxy mismatch can create seams or a second visual truth.
- Region rebuilding can regress edit latency; region size must be measured.
- Shared material and instanced resources can leak on replacement/dispose.
- Render-only flora can survive cuts without explicit support invalidation.
- Sky/water/cloud density can consume the narrow baseline budget.
- Concept-art similarity is judged by the owner, not by agent self-scoring.

## Rollback / Safe Stop

Stop and report `BLOCKED`/`NO-GO` if a second mutable authority is required,
Near collision must read proxy/renderer state, rectangular boundaries remain in
canonical beauty views, functional V2 regresses, packages/assets are needed,
Long Tasks appear, resource counts grow after dispose, or P0/P1 review findings
remain unresolved. Do not waive a failed gate.

## Fortschrittslog

- [x] Phase 0.1–0.3: references, strict gap matrix and baseline capture.
- [ ] Phase 1.1–1.3: descriptor, Near terrain, trees and flora.
- [ ] Phase 2.1–2.3: Mid/Far, water, sky, clouds and cameras.
- [ ] Phase 3.1–3.3: material pipeline, region batching, vegetation lifecycle.
- [ ] Phase 4.1–4.3: integration, screenshot iterations, functional regression.
- [ ] Phase 5.1–5.5: final verification, review, owner approval and publication.

## Definition of Done

- No slab/rectangle/void edge, gradient-only sky or debug-diorama Beauty view.
- Credible Near/Mid/Far coast/lagoon/river/archipelago composition with
  macro/meso/micro forms, grouped rooted vegetation and readable materials.
- Functional V2 authority/edit/collision/worker/first-person tests remain green.
- Performance/resource budgets are freshly measured and honestly reported.
- All candidate screenshots score ≥4/5 with no category ≤2, and the repository
  owner explicitly accepts the candidate series. Otherwise status is
  `AWAITING_OWNER_VISUAL_APPROVAL` or `NO-GO`.
