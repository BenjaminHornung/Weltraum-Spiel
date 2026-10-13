# CRASH-ART-01 — source checkpoint

Base: `f0a901db4ea3cfc64061dca3a2a89cc92f38fc6e`; branch `codex/hestia-fp06-play-candidate-2026-10-12`; writer `/root` (serial art, sole Integrator). Owner: “So als Assetvorlage verwenden”. Native source and runtime product: `art/factory/crashsite-hybrid-v1`; public build candidate: `apps/weltraum-browser/public/factory/crashsite-hybrid-v1`.

| Gate | Result | Actual evidence |
| --- | --- | --- |
| Blender source production | PASS | Blender log, reopened 8 asset parts, native `.blend` bytes/hash |
| Static GLB | PASS | `STATIC_VALIDATION.json`: 4,208 triangles, 6 materials, finite/neutral coordinates, exactly 2 turret nodes, no animation |
| Browser import | PASS | Actual Three.js GLTFLoader, 29 primitives/draw calls, expected bounds, no page errors |
| Ordinary build payload | PASS | HTTP 200 from production build; 242,936 bytes and SHA-256 match manifest |
| Native World admission | NOT_RUN | Closed PlayLoader unchanged; candidate explicitly NOT_ADMITTED |
| Heavy route / depot / exit / support | NOT_RUN for new hull | Current admitted cargo site is unchanged; larger hull needs proof |
| Real defense / finite ammo custody | NOT_RUN | Static idle gun art only; no new C01–C28 inventory or combat state |
| Human visual approval | OWNER_REVIEW_PENDING | Actual three Blender renders and reference comparison supplied |

The existing in-game technical access segment remains 1.5 × 1.5 × 1 m. A decorative GLB cannot silently imply a larger native collision body or a protected starting area. The first native model is substantially simpler and cleaner than the generated target; further weathering/damage refinement and native admission remain open. No W12–W29 work was started.
