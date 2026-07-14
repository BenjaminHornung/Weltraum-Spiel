# Tasks

## 1. Checkpoint 1 — Audit Hestia surface visual references

- [x] **Objective:** Materialize and visually audit the bounded source set, create the complete reference audit, and publish the early guidance commit.
- **Files:** `docs/design-audits/2026-07-14-hestia-surface-lab-visual-reference-audit-v1.md`; this change's `proposal.md`, `design.md`, `specs/default/spec.md`, `tasks.md`, and `tests/test-protocol.md`.
- **Search targets:** the exact required concept/architecture/research documents and additional Hestia/surface/voxel/biome/outpost/planet audits; ten real PNGs numbered 15, 17, 19, 23, 30, 36, 37, 38, 39, and actual 40.
- **Acceptance criteria:** per-image audit fields complete; five-primary-image matrix complete; twelve conflict questions answered; evidence labels explicit; requested image 41 recorded missing; no invented visual claims; no forbidden paths changed.
- **Implementation guidance:** use `ui-designer` for read-only visual analysis, explorer evidence for concept rules, then a bounded docs worker. Keep Direct Visual Evidence distinct from documented rules and inference.
- **Required skills/tools:** `devtoolbox-specs-execution`, `subagent-driven-development`, `ui-designer`, `verification-before-completion`, targeted Git LFS.
- **Verification:** execute the Checkpoint 1 section of `tests/test-protocol.md`, DevToolbox verify, completion preflight, and scope/staging audit.
- **Report back:** materialized/missing/visually reviewed images, key terrain decision, conflicts, changed files, verification result, and commit SHA.
- **Stopping rule:** stop without commit if any forbidden path is modified/staged, visual evidence is unverified, or required audit sections are missing.

## 2. Checkpoint 2 — Define the visual preset and agent handoff

- [ ] **Objective:** Create mutually consistent Markdown, JSON, and concise-agent guidance, review it, verify it, and publish the final preset commit.
- **Files:** `docs/concept-art/hestia-surface-lab-visual-preset-v1.md`, `docs/concept-art/hestia-surface-lab-visual-preset-v1.json`, `docs/concept-art/hestia-surface-lab-agent-handoff-v1.md`, and necessary updates within this change directory.
- **Acceptance criteria:** all user-mandated MUST/SHOULD/MAY/MUST NOT/DEFERRED items; numerical Initial Preview Targets marked Not Yet Performance-Proven; 13-color palette with purpose/dominance/provenance; five materials; three vegetation tiers; fog/water/light/camera/HUD contracts; twelve-row observable acceptance matrix; valid stable JSON; concise handoff matches full preset.
- **Implementation guidance:** treat the preset as design guidance only. Keep vegetation reconstructible presentation scatter, water non-authoritative presentation plane, fog defect-revealing, and the first 4×4 region traversable rather than spectacular.
- **Required skills/tools:** `devtoolbox-specs-execution`, `subagent-driven-development`, `verification-before-completion`, dual `reviewer`/`reviewer-glm`, `test-runner`.
- **Verification:** execute the Checkpoint 2 section of `tests/test-protocol.md`; parse JSON; validate links, values, provenance and cross-document consistency; DevToolbox verify and completion preflight; final scope/staging audit.
- **Report back:** preset decisions, palette, terrain/fog/water/vegetation/camera targets, acceptance summary, review findings/resolutions, changed files, verification result, and commit SHA.
- **Stopping rule:** stop without commit if JSON is invalid, handoffs disagree, a runtime/performance claim is unsupported, a required section is absent, or any forbidden path is modified/staged.
