# Tasks

## Phase 0: establish scope and source baseline

- [ ] Record the fetched `origin/main` SHA, isolated branch/worktree, repository
  guidance, current browser architecture, and applicable design evidence.
- [ ] Confirm the allowlist and temporary-directory rules before external work.

## Phase 1: external project and official-document research

- [ ] Pin and inspect Spector.js, Chrome DevTools MCP, stats-gl, MemLab, and
  Comlink, including scripts, licenses, source paths, and execution status.
- [ ] Review official Playwright, worker/canvas/transfer/shared-memory, Chrome
  Performance, WebGLRenderer, and WebGPURenderer documentation.

## Phase 2: browser and execution evidence

- [ ] Check available public demos with a real browser, including console,
  network, visible behavior, and temporary screenshots.
- [ ] Run a temporary current-app browser check and attempt a Spector.js WebGL
  proof without adding a repository dependency.

## Phase 3: write the decision package

- [ ] Write the research document with all eleven required result sections, tool
  adoption/scoring matrices, classified claims, risks, and no more than three
  tooling spikes.
- [ ] Define the machine-readable runtime telemetry contract and the repeatable
  MemLab streaming-leak scenario.
- [ ] Complete this DevToolbox change and test protocol.

## Phase 4: verify and publish the branch

- [ ] Run available spec validation and task completion preflights without
  bypassing blockers.
- [ ] Run `git diff --check`, inspect the complete diff, and verify the exact
  changed-file allowlist.
- [ ] Commit the documentation, push
  `research/webgl-observability-tooling-audit-v1`, and do not merge it.
