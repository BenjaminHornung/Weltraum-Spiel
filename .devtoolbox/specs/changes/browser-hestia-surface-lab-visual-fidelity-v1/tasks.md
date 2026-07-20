# Tasks: Browser Hestia Surface Lab Visual Fidelity V1

## Phase 1 — Re-establish visual baseline

- [ ] 1.1 Capture and annotate the committed pipeline baseline
  - Objective: Preserve exact visual failures and the approved concept-direction constraints before tuning.
  - Files/search targets: pipeline-baseline screenshots; visual-target audit; concept screenshots 23, 30, 36, 38 and 40.
  - Acceptance: Findings cover landform, material, water, fog, vegetation, overlays, quarter-meter readability, typography and focus without treating concept composition as binding.
  - Verification: Independent ui-designer review and screenshot metadata check.
  - Stop: no product edit before the baseline is agreed.

## Phase 2 — Presentation-only fidelity

- [ ] 2.1 Improve terrain, atmosphere, shoreline and overlay readability
  - Objective: Make the existing accepted mesh products visually inspectable and Hestia-directed.
  - Files/search targets: apps/weltraum-browser/src/surface-lab/surfaceLabEnvironment.ts; surfaceLabController.ts presentation mapping; focused tests.
  - Acceptance: readable elevation/material bands, restrained waterline, depth-preserving fog and non-dominant wireframe/boundaries; canonical hashes unchanged.
  - Verification: focused tests, build, live same-hash comparison and screenshot matrix.
  - Stop: replan if generator, topology or backend changes appear necessary.

- [ ] 2.2 Improve grouped scatter and quarter-meter composition
  - Objective: Show reconstructable vegetation and fine surface detail without visual walls or camera-dependent authority.
  - Files/search targets: surfaceLabEnvironment.ts and approved shared camera fixture/tests.
  - Acceptance: grouped patches with open ground and a readable quarter-meter capture; no canonical data change.
  - Verification: deterministic scatter/hash regression and reviewed screenshots.
  - Stop: no quarter-only hidden data or nondeterminism.

- [ ] 2.3 Repair technical HUD typography and focus appearance
  - Objective: Remove font decode warnings and provide visible keyboard focus while preserving compact responsive layout.
  - Files/search targets: apps/weltraum-browser/src/style.css; local font assets; focused browser checks.
  - Acceptance: no font decoding/OTS errors, visible focus, no overflow at 1280x720, center unobstructed.
  - Verification: console/network inventory, keyboard traversal and screenshot evidence.
  - Stop: no gameplay HUD expansion.

## Phase 3 — Acceptance

- [ ] 3.1 Complete independent visual review and full regression
  - Objective: Accept the visual direction without weakening the deterministic pipeline.
  - Acceptance: ui-designer and paired correctness review have no open P0-P2; default/wireframe/quarter-meter and responsive captures pass; full pipeline hashes and grouped E2E remain green.
  - Verification: fresh reviewer, ui-designer, test-runner and DevToolbox verification.
  - Stop: wait for explicit approval before commit, push, PR or archive.
