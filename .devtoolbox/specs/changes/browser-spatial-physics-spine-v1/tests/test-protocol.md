# Test Protocol: Browser Spatial Physics Spine V1

## Baseline and isolation

- Expected task baseline: `8bb98b1b084ce86fb262a4fee554a573d43b94f5`
- Actual fetched `origin/main`: `9f63c1cecda5a14563d4b6be3452b89d07055092`
- Deviation: two later commits affect only `.github/**`; current main is intentionally used.
- Branch: `feature/browser-spatial-physics-spine-v1`
- Isolated worktree: `C:\tmp\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-spatial-physics-spine-v1`
- DevToolbox: `workspace_prepare_for_agent` returned `unauthorized_path`. No override and no manual task closure.

## Required commands

From `apps/weltraum-browser`:

```text
npm ci
npx tsc -p tsconfig.json
npm run test -- tests/unit/spatialUniverseClock.test.ts
npm run test -- tests/unit/spatialFrameGraph.test.ts
npm run test -- tests/unit/spatialBodyFrames.test.ts
npm run test -- tests/unit/spatialSurfaceLocalFrame.test.ts
npm run test -- tests/unit/spatialTransforms.test.ts
npm run test -- tests/unit/physicsGravityField.test.ts
npm run test -- tests/unit/physicsProbeIntegrator.test.ts
npm run test -- tests/unit/physicsSpaceHandoff.test.ts
npm run test:e2e -- tests/e2e/spatial-physics-spine.spec.ts
npm run test
npm run build
npm run test:e2e
git diff --check
```

`npm ci` completed successfully before implementation. All remaining results must be recorded after fresh execution. Full E2E may rewrite unrelated tracked evidence; those changes are restored while retaining only task evidence.

## Behavioral matrix

- Frame graph: cycle, unknown parent, duplicate, sorting/signature.
- Body frames: deterministic time, full rotation period, explicit rotation epoch/angular velocity.
- Surface: radial Up, both poles finite, orthonormal EUS basis, all three handedness identities, actor orientation independence.
- Transforms: position, velocity with rotational term, orientation, angular velocity, full roundtrip, no mutation.
- Authority: floating-origin/render projection does not alter canonical IDs or states; no Three.js imports.
- Gravity/probe: frame independence, reproducibility, byte-stable fixed steps, canonical and frame-derived `dt` at early and multi-year ticks, fail-closed precision loss near the safe-integer boundary, invalid `dt`, NaN/Infinity rejection.
- Handoff: absolute pose/velocity preservation, exact epoch, immutable snapshots, explicit gravity-binding result.
- Browser: normal route, no TestBridge, Vite imports, full scenario twice, no browser/network errors.

## Evidence outputs

```text
apps/weltraum-browser/evidence/browser-spatial-physics-spine-v1-summary.json
apps/weltraum-browser/evidence/browser-spatial-physics-spine-v1.md
```

No screenshot is required because this slice has no visible presentation.

## Scope audit

Only the paths explicitly allowed by the task may differ from `origin/main`. Package files, current main/runtime/flight/navigation/render/presentation/workers/streaming/settings code, existing Core/Celestial/Persistence modules, roadmap, and `.github/**` must remain unchanged.

## Completion rule

Do not claim Done until fresh commands, browser evidence, `git diff --check`, and the allowlist audit succeed. Because DevToolbox rejected the isolated path, its task checkboxes remain open and the limitation is reported rather than bypassed.
