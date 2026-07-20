# Surface Lab Generation Input Atomicity V1 — Test Protocol

## Scope and execution boundary

This protocol covers reproducible visible evidence for the existing
`hestia-microvoxel-surface-lab.spec.ts` route. It extends that spec without
changing the product, adding fault injection, changing the test count, or
introducing another E2E spec.

The Playwright run is responsible for generating five PNG screenshots, one
machine-readable manifest, and one Markdown run summary under this directory.
The retained evidence package has been generated; its execution and
visual-review results are recorded in the sibling `testfindings.md`.

## Acceptance criteria

- The existing Surface Lab entrypoint and assertions remain in the same
  `hestia-microvoxel-surface-lab.spec.ts` route.
- The test uses a `1920x1080` viewport, `fullPage: false`, and the existing PNG
  signature/dimension validation helper.
- Five retained PNGs are generated under `tests/screenshots/` with stable,
  repository-relative paths and names ending in `-1920x1080.png`.
- Each capture visibly contains the HUD, controls, technical telemetry,
  seed/resolution, extent, and terrain canvas.
- Timing labels, rows, and all other technical telemetry remain visible. After
  live text-contract and finite-number assertions, only the four volatile
  numeric performance timing glyphs for generation, meshing, upload, and frame
  time are normalized out of the retained screenshot pixels.
- The generated manifest records, for each screenshot, its normalized path and
  dimensions plus the observed lifecycle, seed, voxel-size resolution, extent,
  planning epoch, exposed request/readiness/failure/queue/running counters,
  relevant cancellation/stale/worker counters, ordered brick and mesh hashes,
  presentation state, and the asserted browser-health counters.
- The generated Markdown summary contains the same five state mappings and
  explicitly limits screenshots to visible UI evidence.
- No screenshot or generated summary claims that pixels prove internal
  exceptions, promise/epoch atomicity, stale-result suppression, or other
  failure semantics.
- Existing root evidence screenshot paths continue to be generated unchanged.
- No timestamps, machine-specific absolute paths, secrets, product changes,
  package changes, lockfile changes, test-data changes, or browser fault
  injection are introduced by this evidence contract.
- `npx tsc -p tsconfig.json` (using the specified portable Node 22.23.1
  executable) and `git diff --check` pass before handoff.

## Five UI scenarios

The successful live test captures these states in order:

1. **Initial default Ready** — default seed, `0.5 m` voxel size, default
   extent, settled lifecycle, and the unchanged default root evidence capture.
2. **Same-seed regeneration Ready** — visible Regenerate action with the same
   seed and cache bypass, after the new planning epoch settles and ordered
   brick/mesh hashes are asserted identical to the initial state.
3. **Changed-seed regeneration Ready before presentation toggles** — visible
   seed edit and Regenerate action, after the changed seed settles and hashes
   are asserted different from the initial state, before camera or presentation
   controls are changed.
4. **Changed-seed with wireframe/chunk boundaries and camera interaction** —
   real Fly keyboard input and Orbit pointer input, followed by visible
   Wireframe and Chunk boundaries controls, with Ready telemetry and preserved
   changed-seed hashes asserted.
5. **Quarter-meter resolution Ready** — visible voxel-size selection to
   `0.25 m`, after the changed-seed generation settles with its corresponding
   physical extent and different ordered hashes asserted.

Expected evidence dimensions for all five captures are exactly `1920x1080`
PNG images taken with `fullPage: false`. The generated manifest, summary, and
PNG files are evaluated as one evidence package; `testfindings.md` records the
execution and visual-inspection results.

Before each retained capture, the test asserts that the four exact timing value
elements exist, are visible, match their settled live UI text contracts, and
parse to finite millisecond values. Screenshot-scoped CSS then makes only those
four value glyphs transparent for byte reproducibility; it does not alter the
DOM, hide timing labels or rows, or normalize any other telemetry or product
pixels.

## Nonvisual atomicity mapping

Screenshots are intentionally limited to successful, visibly reachable Ready
states. Internal atomicity behavior is mapped to the existing focused unit-test
groups in `apps/weltraum-browser/tests/unit/surfaceLabController.test.ts`:

- **Stopped pool** — rejected regeneration/resolution attempts fail closed
  without mutating authoritative input or published state.
- **Preparation/setup/validation failure** — pre-admission failures preserve
  the prior authoritative state and telemetry relationship.
- **Ticket rejection** — defensive post-admission rejection preserves the
  admitted input and epoch/job semantics while using existing failure
  lifecycle behavior.
- **Cleanup/worker failure** — cleanup and worker failure semantics retain the
  existing failure/accounting contract.
- **Stale/rapid regeneration** — stale results and rapid replacement attempts
  cannot publish obsolete input or artifacts.
- **Replacement failure** — Failed/Stopped replacement behavior and
  post-failure input immutability remain unit-test concerns.

These unit-test groups are the proof for internal pre-admission,
post-admission, stale-result, and failure paths; the UI screenshots do not
invent or imply a visible failure contract.
