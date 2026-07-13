# Browser Mainline CI Hardening v2

## Why

The current TypeScript 7 browser mainline has 21 Playwright spec files and a latest green 44-test CI baseline, but the single aggregate E2E step makes failures slow to localize and allows one failure to hide diagnostics from later areas. The old CI-hardening branch targeted a smaller TypeScript 6 suite and cannot be merged safely.

## What Changes

- Partition all current E2E specs into three required package scripts while preserving aggregate discovery.
- Fail CI when recursive spec discovery and group membership differ.
- Run core/autopilot, live runtime/objectives, and UI/layout independently in one job.
- Isolate group reports and automatic failure artifacts.
- Add current tool, GLB, evidence JSON, selective LFS, and documentation checks.

## Non-Goals

- No gameplay, rendering, GLB binding, or Unity changes.
- No E2E acceptance, retry, worker, or test timeout weakening.
- No package, dependency, lockfile, or GitHub Action version changes.
- No CI matrix or multi-job redesign.
