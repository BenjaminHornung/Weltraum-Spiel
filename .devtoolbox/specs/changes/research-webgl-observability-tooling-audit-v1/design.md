# Design

## Change

`research-webgl-observability-tooling-audit-v1`

## Evidence model

Every external project is pinned to an inspected commit and records canonical
URL, commit date, branch or tag, exact license path, inspected source paths,
build/test/demo/browser status, and known limits. Every material statement is
classified as one of:

- README Claim
- Code Evidence
- Test Evidence
- Benchmark Evidence
- Observed Demo Evidence
- Inference

Marketing language is not accepted without direct evidence.

## Evaluation model

Each project receives 1-5 scores for Problem Fit, Architecture Fit, Browser Fit,
Determinism, Testability, Performance Evidence, License Fit, Integration Cost,
and Maturity. For Integration Cost, 5 means low/easy. The verdict must be one of
the categories required by the task brief.

## Layered diagnostics model

The audit separates six evidence layers:

1. Playwright reproduces deterministic user and test-harness flows.
2. Chrome DevTools MCP explains browser scheduling, network, console, traces,
   screenshots, and selected heap behavior.
3. Spector.js explains WebGL frame commands and graphics resources.
4. stats-gl provides low-friction development timing indicators.
5. MemLab analyzes repeatable heap growth and retention.
6. Project-owned runtime telemetry reports domain queues, chunk state, mesh
   generation/upload counters, caches, frame timing, and Three.js object counts.

No layer is allowed to substitute for another layer's truth.

## Runtime telemetry boundary

The proposed diagnostics snapshot is read-only and versioned. It observes
owner-produced counters and gauges after state transitions; it cannot change
gameplay state, queue priority, simulation decisions, random seeds, or time.
Unsupported measurements are `null`, not fabricated zeroes. Diagnostics are
available through the normal diagnostics surface, while test bridges only
orchestrate and serialize the same source snapshot.

## Browser proof boundary

A visible demo proves only visible behavior. Source inspection proves APIs and
limits. A local WebGL capture, when feasible, records command/resource evidence
without adding a repository dependency. Temporary screenshots and captures stay
outside the repository.

## CI boundary

Deterministic telemetry invariants belong in normal PR CI. Hardware-sensitive
timing, Chrome traces, WebGL frame captures, and heap series run on pinned,
controlled lanes or on demand. Raw sensitive artifacts are not uploaded by
default and have explicit retention.
