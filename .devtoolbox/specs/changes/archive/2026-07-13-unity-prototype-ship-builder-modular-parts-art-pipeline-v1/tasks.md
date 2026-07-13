# Tasks

## Phase 0: catalog and naming convention
- [x] Create `docs/spielkonzept/ship-builder-modular-parts.md` with concrete 8-category v0 catalog entries.
- [x] Standardize orientation, naming, socket, metadata, and marker conventions in the same document.
- [x] Document planning-only treatment of cargo and runtime stats.

## Phase 1: Blender MCP prototype prompts
- [x] Create `docs/art/blender-modular-ship-parts-guidelines.md` with Blender MCP and marker rules.
- [x] Create `docs/art/blender-mcp-part-generation-prompts.md` with one prompt per category and validation prompt.

## Phase 2: one part per category in throwaway branch/project
- [ ] Generate one reference part per category in throwaway environment.
- [ ] Verify naming and marker outputs in a throwaway scene.
- [ ] Iterate with MCP prompts based on validation failures.

## Phase 3: Unity import / binder validation
- [ ] Import generated assets into Art folder in implementation environment.
- [ ] Validate socket marker parsing and direction-role mapping for each part.
- [ ] Validate explicit failure behavior for missing required markers and removed fallback defaults.

## Phase 4: builder catalog metadata
- [ ] Add all v0 metadata rows to builder catalog data source.
- [ ] Link each catalog row to required socket names and material role tags.
- [ ] Validate metadata schema fields and consistency against expected catalog values.

## Phase 5: gameplay stats and balancing
- [ ] Define balancing ranges for thrust, RCS, HP, and cargo tiers in gameplay configs.
- [ ] Add balancing review pass and balancing sign-off step.
- [ ] Plan partial metadata tags for future runtime tuning.

## Phase 6: full 3-4 variants per category
- [ ] Produce all planned variants listed in v0 catalog with naming parity.
- [ ] Run full validation and reject assets that do not pass marker strictness.
- [ ] Update catalog for final v0 variant IDs and mass tiers.

## Phase 7: screenshots and evidence
- [ ] Add rendered evidence for each category and variant after import.
- [ ] Record validation results and known edge-case blockers.
- [ ] Store implementation evidence under planned implementation artifacts.
