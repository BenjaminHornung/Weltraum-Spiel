# Proposal

## Change

`research-webgl-observability-tooling-audit-v1`

## Goal

Define an evidence-backed observability toolchain for the browser mainline so
agents and developers can investigate chunk streaming, WebGL/WebGPU rendering,
workers, memory growth, LOD transitions, mesh uploads, frame spikes, and leaks.

## Motivation

The current browser app uses Three.js `WebGLRenderer`, already has deterministic
world-streaming contracts, and exposes gameplay telemetry through explicit
snapshots. It does not yet expose a stable performance-diagnostics contract, and
no single external tool can prove domain state, browser scheduling, GPU command
state, and heap retention at once.

## Scope

- Research and documentation only.
- Pin and inspect Spector.js, Chrome DevTools MCP, stats-gl, MemLab, and Comlink.
- Review official Playwright, Web Worker, OffscreenCanvas, Transferable,
  SharedArrayBuffer, Chrome Performance, and Three.js renderer documentation.
- Run safe temporary browser checks when possible.
- Specify a read-only runtime telemetry contract and a bounded CI strategy.

## Outcomes

- `docs/research/webgl-observability-tooling-audit-v1.md`
- This DevToolbox change with proposal, design, capability spec, tasks, and test
  protocol.
- At most three later tooling spikes. This change does not implement them.

## Non-goals

- No runtime, test, app, package, asset, workflow, binary, image, or evidence
  changes.
- No dependency addition to Weltraum-Spiel.
- No permanent MCP, browser, or user configuration change.
- No adoption claim based only on README wording or a visible demo.

## Risks

- Profilers perturb the workload they measure.
- Chrome-only evidence can be mistaken for cross-browser proof.
- Heap snapshots, traces, screenshots, URLs, shaders, and textures can contain
  sensitive data.
- GPU timing and frame thresholds can become flaky when hardware, drivers,
  browser versions, or background load are not controlled.
