# Test Protocol: Browser Voxel Representation Ladder V2

## Deterministic evidence boundary

All tests run from the isolated worktree against base
`15f3550bd604856b25d40a7ac700ec4d5106b89e` using the repository-supported
Node-22 toolchain. Evidence contains no timestamp, generatedAt, duration,
machine path, user, random ID, or volatile browser value. Browser evidence is
regenerated twice with one worker and retries zero; both allowed files must be
byte-identical.

## Focused unit obligations

1. Accept a deterministic descriptor with at least 12 bands.
2. Reject more than 32 bands before copy/sort/hash work.
3. Reject duplicate IDs/ranks, rank gaps, non-monotone error, unknown keys,
   sparse/accessor/inherited/symbol input, NaN, Infinity, negative/unsafe values,
   and over-cap bindings/costs.
4. Preserve input bytes/shape; publish defensive recursively frozen results.
5. Pin unchanged Adaptive levels/table/quantum/key/hash/provenance vectors and
   prove representation bands are not Adaptive levels.
6. Bind object proxies to object/Structural/damage revisions and surface
   products to body/frame/region-or-tile/generator/source/edit/hash revisions.
7. Reject stale object, intact-after-damage, wrong Structural hash, and wrong
   surface edit revision; exclude camera/quality metadata from identity.
8. Verify focal-length, distance-to-bounds, projected-error, viewport, and FOV
   vectors; reject every non-finite/semantic-invalid input.
9. Prove distance monotonicity, insertion-order-independent tie-breaks,
   deterministic culling, repeatable decision hash, and hysteresis hold/refine/
   collapse transitions.
10. Prove separate render, simulation, Authority request, fallback, readiness,
    eviction, reasons, and hash outputs.
11. Prove Low/Ultra may differ visually but have identical Authority,
    edit, Structural, hard-pin, and simulation requirements.
12. Prove all six Adaptive hard reasons request L4 under every quality and a
    pin does not force L4 rendering.
13. Resolve proxy interactions only from explicit Authority coordinates; absent
    L4 coverage or budget returns NOT_READY/Blocked with no coarse/partial edit.
14. Prove dirty, solving, active rigid body, unsettled fragment, and pending
    handoff are not evictable; sleeping does not bypass handoff; explicit Settled
    may release derived products while retaining Authority/Structural sources.
15. Prove zero/partial/63-of-64/stale children retain parent and exactly 64
    current same-revision children replace parent atomically.
16. Exercise every named candidate/pin/binding/fallback/byte/work/upload cap and
    prove atomic rejection without partial results; use counters, not timing.
17. Migrate literal valid V1 settings to V2 preserving every old value; test
    missing, corrupt, invalid, and future storage without silent overwrite.
18. Prove Low < Medium <= High < Ultra visual detail/range/budget semantics,
    immutable policies, independent render/detail distance, and no quality
    effect on Authority/Structural outputs.

## Browser matrix

The focused Playwright spec shall:

- navigate only to normal `/`;
- assert `window.TestBridge` is neither an own property nor present via `in`;
- import `/src/voxel/representation/index.ts` through Vite;
- use a literal descriptor with at least 12 bands;
- compare Low and Ultra using identical Authority/Structural inputs;
- permit different render choices but require identical Authority/edit/source
  bindings and hard-pin requests;
- resolve a proxy hit to L4 requirements;
- prove hysteresis, stale rejection, and parent-to-64-child atomic transition;
- collect and require empty console-error, page-error, request-failure, and
  HTTP>=400 lists;
- write the approved JSON/Markdown evidence deterministically; and
- occur exactly once in `test:e2e:core`, nowhere in live/ui.

## Fresh verification matrix

1. `npm ci` with Node 22.
2. TypeScript/full build.
3. Each new representation unit file separately.
4. Focused graphics settings schema/preset/storage/policy tests.
5. Focused Adaptive contracts/planner and Structural contracts/commands/
   connectivity/mass/persistence regressions.
6. Full Vitest suite serially.
7. Production build.
8. E2E inventory exact-once check.
9. Focused ladder E2E twice, one worker, retries zero; compare both evidence
   files byte-for-byte and by SHA-256.
10. `npm run test:e2e:core`.
11. `npm run test:e2e:live`.
12. `npm run test:e2e:ui`.
13. Parse/validate the evidence JSON and scan evidence for volatile fields.
14. `git diff --check` and exact changed-path audit.
15. Secret scan of the diff.
16. Forbidden import/nondeterminism scans: no Three.js/DOM/browser globals,
    `Date.now`, `performance.now`, `Math.random`, worker/cache order, or second
    encoder/hash in the representation core.
17. Verify no Unity/`Assets/**`, dependency, `package-lock.json`, workflow,
    Playwright-config, Adaptive-level/key/hash, or Structural semantic drift.
18. DevToolbox `verify_plan`, `verify_run`/fresh results, completion preflight,
    and task toggles only after evidence.
19. One focused reviewer pass and affected reruns after fixes.
20. Final Plannotator review before commit/publication.

If a full gate fails on unchanged Main, reproduce against clean `origin/main`,
classify baseline versus regression, and never weaken tests. Do not mutate test
data, deploy, release, or merge.

## Publication and exact-head protocol

Before final push, fetch `origin --prune` and compare current `origin/main` to
the recorded base. If advanced, create a normal merge commit, preserve all Main
changes, resolve only in-scope conflicts, and rerun the full matrix. Push
without force, open the specified PR, and wait for current-head Browser Mainline
CI, repository policy, dependency review, and Codex review. Address valid P0-P3
findings and rerun affected gates. Never auto-merge.
