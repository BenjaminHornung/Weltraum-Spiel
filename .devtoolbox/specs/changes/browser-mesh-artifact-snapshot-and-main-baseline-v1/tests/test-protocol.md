# Test Protocol: Browser MeshArtifact Snapshot And Main Baseline V1

## Baseline and tooling

Run from the isolated worktree. The authoritative current `origin/main` SHA is
`69984c5caa9d9414bac1f5d1032fa362988cd899`, matching the requested expected
value. The initial pre-worktree fetch exposed stale `979f3db6...` output while
.git/FETCH_HEAD was permission-blocked; the branch was fast-forwarded to the
authoritative remote before implementation review.

The DevToolbox workspace preflight returned `unauthorized_path` for this
nested worktree. No DevToolbox preflight, execution, verification, or task
completion is claimed. Equivalent manual spec, diff, command, evidence, and
completion gates are required.

Node 22 is mandatory. Record:

```text
node --version
npm --version
```

## Focused tests

From `apps/weltraum-browser` after `npm ci`:

```text
npx tsc -p tsconfig.json
npm run test -- tests/unit/presentationMeshArtifact.test.ts
npm run test -- tests/unit/presentationCommands.test.ts
npm run test -- tests/unit/renderBackendLifecycle.test.ts
npm run test -- tests/unit/renderBackendRevision.test.ts
npm run test -- tests/unit/renderBackendBoundary.test.ts
```

Required assertions include:

1. normal factory copies positions, normals, indices, UV, and color exactly
   once; caller arrays remain attached;
2. caller mutation after creation cannot change artifact data or hash;
3. snapshot and caller buffer identities differ;
4. adoption uses the exact input buffer identities without copying;
5. invalid adoption rejects subviews/aliases/shared/resizable or malformed
   buffers before ownership changes;
6. same revision/hash with a separate snapshot is `AlreadyApplied` and does not
   allocate a second geometry; same revision/different content is conflict;
7. backend never mutates snapshot or adopted arrays;
8. remove/reset/dispose release backend resources without detaching buffers;
9. public exports visibly name `SnapshotOwned`, `AdoptedExclusive`, and both
   factory functions.

## Full local verification

```text
npm ci
node --version
npm --version
npx tsc -p tsconfig.json
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
npm run test:e2e
```

If a known-load E2E flakes once, repeat the same test exactly once, record both
results and the cause, and stop on a reproduced failure. Do not change
timeouts/assertions.

## Recorded verification evidence

The fresh verification used portable Node v22.23.1 and npm 10.9.8 in this
worktree. npm ci completed with 59 packages added and no reported
vulnerabilities. The TypeScript check passed. The five focused unit commands
passed with 36 tests. The full unit suite passed with 86 files and 820 tests.
The production build passed; Vite emitted only its existing large-chunk
warning.

The focused browser groups passed: core 30 passed, live 12 passed, and UI
12 passed. The full E2E run on
69984c5caa9d9414bac1f5d1032fa362988cd899 completed with 51 passed and three
page.goto load failures (net::ERR_ABORTED) under eight workers. The exact
three failed tests were repeated without changes and passed 3 passed under
three workers. No timeout or assertion was changed. The installed Chrome
executable was used because the bundled Playwright browser cannot launch in
this Windows environment (spawn UNKNOWN).

git diff --check passed with GIT_LFS_SKIP_SMUDGE=1. The final scope check
listed only the seven tracked product/document files and the five files in
this change directory. The DevToolbox workspace preflight returned
unauthorized_path for this nested isolated worktree; no blocked preflight was
bypassed and the equivalent manual gates above were used.

## Scope and diff gates

```text
git diff --check
git diff --name-only <base-sha>...HEAD
git status --short
```

The changed-path list must contain only the two allowed source trees, the two
required docs, the six focused unit-test paths as applicable, and this change
directory. `package.json`, `package-lock.json`, `main.ts`, all prohibited
domains, workers/streaming/world/runtime paths, `.github/**`, and roadmap files
must remain unchanged.

## PR and merge gates

1. Fresh exact-head review reports no P0-P2 findings.
2. Push branch
   `fix/browser-mesh-artifact-snapshot-and-main-baseline-v1` without force.
3. Open PR with title
   `#WELTRAUM-000 Harden mesh artifact snapshot ownership`.
4. Wait for Browser Mainline CI on the exact PR head and require green checks.
5. Merge with commit message
   `#WELTRAUM-000 Merge mesh artifact snapshot ownership`.
6. Fetch/re-resolve `main`, run Browser Mainline CI on final main, and record
   its SHA and result.

No task checkbox is complete until its fresh command/evidence and completion
preflight equivalent are recorded.
