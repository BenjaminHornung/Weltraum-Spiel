# Design

## Change
`prototype-ship-builder-modular-parts-art-pipeline-v1`

This is a planning-only change and defines a v0 artifact and connector pipeline.

## Pipeline design (authoring and validation)

1. Plan part in docs
   - Finalize part definitions and naming in `docs/spielkonzept/ship-builder-modular-parts.md`.
   - Include metadata schema fields, marker requirements, and planned stats fields.

2. Generate with Blender MCP prompt
   - Use per-category prompts from `docs/art/blender-mcp-part-generation-prompts.md`.
   - Produce mesh, collider, and marker hierarchy only.
   - Keep metric, low-poly, and marker naming conventions from `docs/art/blender-modular-ship-parts-guidelines.md`.

3. Validate Blender hierarchy and naming
   - Validate socket naming, orientation, direction naming, and marker completeness.
   - Validate transform application and snap-grid compliance.
   - Fail on missing required markers; no implicit root fallbacks.

4. Export FBX
   - Export with clean hierarchy and no animation/extra render layers.
   - Keep export-safe hierarchy names and no absolute project paths.

5. Import into Unity Art folder
   - Stage generated FBX in planned Art folder (execution slice).
   - Verify material role assignment and import options (non-planar tangents acceptable for now).

6. Run/import binder validation
   - Validate socket import mapping against required functional sockets.
   - Verify imported compatibility names and aliases where supported.
   - Confirm missing markers create explicit failures, never root/zero fallbacks.

7. Add to builder catalog
   - Add planned metadata entry mapping to `docs/spielkonzept` schema.
   - Keep gameplay stats as planning defaults where gameplay code is not yet active.

8. Create runtime tests in later implementation slice
   - Tests and binding/runtime automation are deferred intentionally to later implementation slices.

## Reuse and compatibility decisions

- Reuse existing socket families and role naming instead of inventing a parallel set.
- Keep marker compatibility aliases for existing names (`THRUST_NOZZLE_MAIN*`, `RCS_NOZZLE_*`) where needed.
- Keep naming in existing project tone: `MAT_*` role materials, `Hardpoint` socket style, directional roles from current enums.
- Keep part metadata additive: old names and planned names coexist during transition.

## Risks

- Missing marker enforcement could let malformed assets through if manual review skips validation.
- Legacy content can include old directional labels that need alias checks.
- Auto-generated prompt output can drift from naming standards without strict review.
- Collider proxy planning and gameplay volumes may conflict with early art styling unless normalized.

## No hardcoded paths policy

- The plan explicitly avoids path-embedded logic and explicit engine-specific strings.
- Only standardized part and marker IDs are required in docs and validation checks.

## Error and recovery model

- If marker validation fails, asset generation fails early and requires regeneration.
- If compatibility mapping fails, keep compatibility aliases disabled until corrected and do not merge.
- If collider and marker overlap causes unclear bounds, mark part as blocked and send back to MCP generation iteration.
