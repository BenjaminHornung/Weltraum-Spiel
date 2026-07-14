# Change: Browser Render Backend Mesh Artifact Lifecycle V1

## Goal

Introduce a narrow backend-neutral presentation boundary and a real Three.js adapter for validated, revisioned mesh artifacts. The boundary owns only presentation inputs and derived CPU/GPU resources; world, voxel, physics, navigation, flight, persistence, and gameplay state remain outside it.

## Scope

- Add immutable presentation contracts for identities, revisions, mesh artifacts, material profiles, commands, visibility plans, frame projection, validation, canonical signatures, results, and backend capabilities.
- Add a Three.js `ThreeRenderBackend` with atomic replacement, explicit resource ownership, reference-counted material sharing, idempotent removal, eviction protection, reset/rebuild, and read-only diagnostics.
- Add a standalone deterministic 640 x 360 harness without `main.ts`, product UI, animation, lighting, or TestBridge integration.
- Add focused Vitest suites, a real normal-route Playwright lifecycle test, exact canvas baselines, deterministic JSON/Markdown evidence, and this architecture record.

## Hard boundaries

- Three.js SHALL remain the current adapter and SHALL NOT become world, voxel, physics, flight, navigation, persistence, or gameplay authority.
- Presentation modules SHALL NOT import or publicly expose Three.js types or domain objects.
- Renderer diagnostics SHALL be observation only and SHALL NOT feed gameplay decisions.
- Commands SHALL fail closed on invalid input, content conflicts, unsupported capabilities, wrong backend generation, or stale revision.
- No package/lockfile, `main.ts`, existing `render/three/**` module, simulation/domain, roadmap, CI, WebGPU, WASM, Shared Memory, or general engine abstraction change is in scope.

## Deliverables

- `.devtoolbox/specs/changes/browser-render-backend-mesh-artifact-lifecycle-v1/**`.
- `apps/weltraum-browser/src/presentation/**` and `apps/weltraum-browser/src/render/three/backend/**`.
- The six requested unit suites and the standalone lifecycle Playwright test with three exact PNG baselines.
- Deterministic evidence under `apps/weltraum-browser/evidence/**` and `docs/browser-mainline/render-backend-mesh-artifact-lifecycle-v1.md`.

## Success

The focused and complete browser verification commands pass under Node 22, the three canvas states are visibly non-empty and stable, the required ownership/revision/fallback/resource invariants are proven, every changed path matches the allowlist, and the feature branch is committed and pushed without a pull request or merge.

## DevToolbox exception

The configured DevToolbox server rejects this isolated Temp worktree with `unauthorized_path`. The user explicitly instructed the implementation to continue without that service. This exception waives only MCP orchestration calls; it does not waive spec-first work, the task checklist, fresh verification, scope audit, or completion evidence. Equivalent checks are recorded manually in `tests/test-protocol.md`.
